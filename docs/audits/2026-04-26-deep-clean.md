# Deep Clean Audit Report — 2026-04-26

**Branch:** `deep-clean-fixes-2026-04-26` (32 commits, 56 files changed, +2,058 / −447 lines), fast-forward merged into `master` at `372b22d`.

## Summary

Second-cycle health audit (the first was 2026-04-07) executed against the post-feature-request codebase. The audit catalogued **3 Critical, 35 Important, 30 Minor** findings across 7 domains: architecture, security, performance, code quality, test quality, documentation, and data flow. **49 of those 68 findings were fixed across 32 commits**, organized into 8 dependency-ordered chunks; **18 findings were deferred** as out of scope. The final commit passed the quality gate (`tsc --noEmit && pnpm lint && pnpm test`) with **66/66 tests passing across 11 files** (up from 34/7 pre-plan).

Plan: `docs/superpowers/plans/2026-04-26-deep-clean-fixes.md`. Skipped live-environment verification: `docs/superpowers/plans/2026-04-26-deep-clean-fixes-skipped.md` (12 bullets — Turso `drizzle-kit push`, S3 round-trips, Playwright e2e, manual public+admin smoke).

## Findings by Category

### Architecture (5 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| A1 | Important | Public pages reached straight into the DB and over-fetched image columns | Routed `portfolio/[slug]` through new `getPublishedGalleryBySlugWithImages` lib helper with `PublicGalleryImage` projection |
| A2 | Minor | `DeleteGalleryButton` baked layout (`mt-12 pt-8 border-t`) into the component, coupling it to one call site | Extracted layout to call sites; component now renders just the button |
| A4 | Minor | `/portfolio` redirect implemented as a Next page that calls `redirect()` — extra render cost and runtime cookie-bypass risk | Replaced with a `next.config.ts` `redirects()` rule (307); deleted the page |
| A6 | Minor | SES client created at module load, unlike `s3.ts` which lazy-inits | Lazy-init `getSesClient()` to mirror the S3 pattern |
| A7 | Minor | Proxy did cookie-presence check only; route-handler validation was the second line, but neither file documented the split | Added explicit defense-in-depth comments at both layers |

### Security (5 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| S1 | Important | About-image presign accepted any `contentType` the client sent | Allowlist of `image/jpeg`, `image/png`, `image/webp`; 400 otherwise |
| S2 | Critical | Admin login route had no rate limiting — open to credential-stuffing | Per-IP exponential backoff with cleanup on success; bad-cleanup logged via `console.error` |
| S6 | Important | Upload presign had no `content-length-range` — clients could PUT arbitrary-size objects to S3 | Presign now signs a `[0, maxBytes]` range; admin upload-url route caps registered uploads at 30 MB and deletes oversized orphans |
| S8 | Important | Contact-form rate limit keyed on raw `email`, so case-different submissions bypassed the limiter | Lowercase email before key lookup |
| S9 | Important | Contact-form `sessionType` accepted arbitrary strings into the DB | Allowlist enum; reject otherwise |

### Performance (6 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| P1 | Important | Homepage image grid pulled every published image into JS, then `.slice(0, 12)` | DB-side `ORDER BY RANDOM() LIMIT 12` with column-projected select |
| P2 | Important | `images.gallery_id` had no index; gallery-detail and homepage queries scanned the table | Composite index `images_gallery_id_idx (gallery_id, sort_order)` |
| P3 | Important | `(public)/galleries`, `portfolio/[slug]`, `contact` all carried `force-dynamic` and never cached | Removed `force-dynamic`; pages now statically render and revalidate on demand |
| P4 | Important | Admin mutations (gallery POST/PUT/DELETE, image upload, settings PUT) didn't `revalidatePath` the affected public page | Added `revalidatePath` calls across admin route handlers |
| P6 | Important | Image-registration step fetched the just-uploaded file back from CloudFront (CDN miss → S3) instead of S3 directly | New `getObjectBuffer(s3Key)` helper; routes read from S3 in-region |
| P7 | Minor | Bulk image-assign issued one UPDATE per image in a loop | `db.batch()` of N statements (libsql native); `inArray` fallback documented if driver regresses |

### Code Quality (15 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| C1 | Critical | Sharp pipeline read `metadata.width/height` before `.rotate()` ran, so EXIF-rotated portraits stored swapped dimensions | Read dimensions from the post-rotate pipeline; collapsed duplicated landscape/portrait resize branches |
| C2 | Critical | `slugify` duplicated in client `gallery-form.tsx` and server route — drift between them produced different slugs | Single canonical `src/lib/slugify`; client imports it; PUT body sanitizes via the same function |
| C3, C4 | Important | Two reorder routes (`galleries/[id]/images/PUT`, `galleries/PUT`) had no client callers and no tests | Deleted both endpoints |
| C5 | Important | `galleries.category` column was unused (replaced by tag-style organization in earlier feature work) | Schema column removed; migration generated |
| C6 | Important | Root metadata was hardcoded — `siteTitle`/`tagline` admin edits never reached `<head>` | `app/layout.tsx` now uses `generateMetadata()` sourcing from `getSettings()` |
| C7 | Important | `images.altText` existed in schema but had no admin UI to set it | New per-image alt-text editor in `gallery-image-manager.tsx` + `PUT /api/admin/images/[id]` |
| C8 | Minor | Footer redeclared a local `SocialLink` type that already lives in `src/lib/settings` | Type-only import from lib |
| C9 | Important | Every admin route handler reimplemented `validateSession` + JSON parse + 401/400 boilerplate (~12 routes) | New `withAdminAuth(handler)` and `parseJsonBody(req)` helpers in `src/lib/api-helpers`; applied across all admin routes |
| C10 | Minor | `db` was exported as a Proxy with no comment explaining why (fragile to "fix") | Added comment warning against replacing with top-level `await initDb()` |
| C11 | Minor | Login route had a swallowed `.catch(() => {})` on session-cleanup | Replaced with `console.error` (Task 16) |
| C14 | Minor | Resize logic had near-identical landscape/portrait branches | Single branch; sharp resize handles both |
| C16 | Minor | Several admin client components ignored failed `fetch` responses and silently `router.refresh()` | Surface `data.error` via `alert()` before refreshing |
| C17 | Minor | `gallery-form.tsx` had several 3-blank-line gaps from earlier edits | Collapsed to single blank lines |
| C18 | Minor | `db/seed.ts` used the literal string `"default"` instead of `SETTINGS_ID` constant | Imported and used the constant |
| C20 | Minor | `aboutText` was `?.trim()`-ed at read time in the contact page; should normalize at write time | Trim in `PUT /api/admin/settings`; removed the read-side trim |

### Test Quality (10 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| T1 | Important | `parseSocialLinks` had no malformed-JSON tests | Added 4 cases (null, non-array, missing fields, mixed valid/invalid) |
| T2 | Important | `validateSession` had no test coverage (deferred from prior audit) | New tests cover expiry refresh, deletion of expired sessions, missing-cookie short-circuit |
| T3 | Important | `proxy.ts` had no tests | New tests cover `/admin/login` pass-through, `/admin/*` redirect when no cookie, public-path pass-through |
| T4 | Important | `submitContactForm` server action had no tests (deferred from prior audit) | New tests cover sessionType allowlist, lowercase-email rate limit, disabled-form rejection |
| T5 | Important | Login route handler had no tests | New tests cover bad credentials, missing fields, rate-limit lockout, success path |
| T6, T7 | Important | `galleries.test.ts` had only happy-path tests | Added multi-gallery mapping, null-cover, empty-galleries cases |
| T8 | Important | No EXIF-orientation test for `processImage` (matches C1 fix) | Added test: portrait JPEG with `Orientation=6` returns dimensions matching displayed aspect |
| T11, T12 | Minor | Playwright smoke spec used brittle text selectors that broke on minor copy changes | Tightened to `getByRole("heading", ...)` for `/contact` and `/galleries` |

### Data Flow (3 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| D1 | Important | `Gallery`/`Image` types redeclared in 4 places, drifting from schema | Centralized `Gallery`, `Image`, `GalleryWithCover`, `PublicGalleryImage`, `HomepageGridImage` in `src/lib/galleries` |
| D2 | Important | `settings-form.tsx` parsed the `socialLinks` JSON string client-side and never validated shape | `parseSocialLinks` shape-validates server-side; form receives `SocialLink[]` directly |
| D3 | Minor | Public surfaces fetched and passed full `images.*` rows; only thumbnail/cdn/dims/alt were ever read | Public projection type `PublicGalleryImage`; `gallery-grid` and `lightbox` consume it |

## Test Impact

- **Before:** 7 files, 34 tests (all passing)
- **After:** 11 files, 66 tests (all passing)
- **New test files:** `api-helpers.test.ts`, `login-route.test.ts`, `contact-actions.test.ts`, `proxy.test.ts`
- **Enhanced test files:** `auth.test.ts` (+5 `validateSession` tests), `galleries.test.ts` (+5 mapping/cover/empty cases), `images.test.ts` (+1 EXIF test), `settings.test.ts` (+4 malformed-JSON tests)

## New Modules

| File | Purpose |
|------|---------|
| `src/lib/api-helpers.ts` | `withAdminAuth(handler)` and `parseJsonBody(req)` — eliminates ~12× duplicated session/parse boilerplate in admin routes |
| `drizzle/0000_gray_sphinx.sql`, `drizzle/0001_groovy_deadpool.sql` (+ snapshots) | First migrations checked in (project previously had no `drizzle/` directory). Baseline schema + `images_gallery_id_idx`. Apply via `drizzle-kit push` — see skipped doc. |

## Not Addressed

Per the plan's "Out of scope" section, deferred to a future cycle:

| Item | Reason |
|------|--------|
| A3, A5 | Larger refactors (route reorganization, layout split) — defer until a feature pulls them in |
| S3, S4, S7 | Lower-priority hardening for a single-admin tool with low traffic |
| P5, P8, P9 | Premature optimization for current scale (image CDN warm-up, query batching at the request boundary) |
| C12, C13, C15, C19 | Cosmetic / micro-style; not worth a dedicated commit |
| D4, D5, D6 | Type duplication in admin-only surfaces — chase when the next feature touches them |
| T9, T10, T13, T14 | Admin-route unit tests require a heavier test harness (real DB or richer mocks); ROI low for a single-admin tool |

Live-environment verification (Turso `drizzle-kit push`, S3 upload round-trip with the new 30 MB cap, `revalidatePath` behavior under `pnpm build && pnpm start`, Playwright e2e, full admin+public smoke) is captured in `docs/superpowers/plans/2026-04-26-deep-clean-fixes-skipped.md` and must be run before this branch is deployed.

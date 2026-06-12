# Deep Clean Audit Report — 2026-06-12

**Branch:** `deep-clean-3` (14 commits: 1 plan + 13 fix tasks; 49 code files changed, +1,699 / −462 lines excluding docs)

## Summary

Third deep-clean audit of the portfolio site, run with 7 parallel review agents (architecture, security, performance, code quality, test quality, documentation, data flow) against a fully green baseline (tsc, eslint, 66 tests, knip). The audit found 2 critical and 15 important issues — notably **three regressions of fixes recorded in the 2026-04-26 audit** (P1 homepage query, P5 image-dimension probing, C16 admin error-handling convention) — plus ~25 minors. All criticals and importants were fixed, along with the cheap consistency/dead-code minors; security-hardening minors were deferred consistent with prior audits' posture for a single-admin site. The largest functional addition is a 2048px WebP "display" rendition generated at upload time so the lightbox no longer pushes 30 MB originals through the image optimizer.

## Findings by Category

### Architecture (4 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Important | Cover-image invariant enforced client-side via a non-atomic two-fetch chain (`clearCoverIfMatches` → assign), unlike the server-side precedent in image DELETE | Assign route now clears dangling `coverImageId` references inside its `db.batch`; client helper deleted |
| 2 | Important | Dead endpoint `GET /api/admin/messages` — no callers, duplicated the page query, invisible to knip | Deleted |
| 3 | Minor | `withAdminAuth` optional `params` forced unreachable `if (!params)` guards in 4 dynamic routes; `sessionId` context unused by all 13 handlers | Wrapper passes `RouteContext<TParams>` through; 5 guards and the `sessionId` context removed |
| 4 | Minor | `HomepageGridImage` module-private and re-declared in `homepage-grid.tsx` | Type exported and imported |

### Security (3 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Important | Contact form (the only unauthenticated write path) had no length caps; ~1 MB payloads stored verbatim and forwarded via SES | Caps added (name 200, email 254, phone 50, message 5000) in shared `CONTACT_FIELD_LIMITS`, enforced server-side and mirrored as `maxLength` client-side |
| 2 | Important | Login rate limiter was per-process (resets per serverless instance), never evicted idle IPs, counted successes toward lockout — and diverged from the S2 description in the 04-26 audit record | Replaced with a `login_attempts` table: failures counted in a 15-min window before verification, only failures recorded, cleared on success with lazy stale-row cleanup. Migration `0003` |
| 3 | Minor | `formData.get(...) as string` casts could throw a 500 on crafted multipart requests with File entries | `getStringField` typeof guard rejects non-string entries |

### Performance (4 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Important | Homepage query regression (P1 from 04-26): sequential galleries query + 60-full-row sample + statistically-redundant Fisher-Yates re-shuffle on a `force-dynamic` page | Single joined, column-projected `ORDER BY RANDOM() LIMIT 12` query |
| 2 | Important | `processImage` regression (P5 from 04-07, reintroduced by the 04-26 C1 EXIF fix): full decode+re-encode of the original just to read dimensions | Header-only `metadata()` read with orientation 5–8 axis swap; thumbnail and display renditions generated from one shared pipeline via `Promise.all` |
| 3 | Important | Lightbox served the untouched original (up to 30 MB) with no adjacent preload — cold multi-second waits on the core interaction | New 2048px WebP display rendition (`display/<id>.webp`, schema column `display_url`, migration `0002`) used as lightbox src with `cdnUrl` fallback for legacy rows; prev/next neighbors preloaded |
| 4 | Important | Above-the-fold images lazy-loaded on homepage and portfolio pages (LCP) | First-row homepage tiles get `fetchPriority="high"` (correct for the CSS-hidden breakpoint variants); first 3 portfolio images get `preload` (Next 16's replacement for deprecated `priority`) |

### Code Quality (6 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Critical | Catch-all around the S3 fetch in image registration misreported **every** failure as "exceeds size limit" (413) and deleted the uploaded original, destroying retryability on transient errors | New `ObjectTooLargeError` class; only it triggers 413 + delete, other errors log and return 502 leaving the upload intact |
| 2 | Important | Image MIME allowlist duplicated in 3 files with 3 shapes | Shared `IMAGE_EXT_BY_TYPE` / `ACCEPTED_IMAGE_TYPES` in `src/lib/image-types.ts` |
| 3 | Important | Contact notification email was a floating promise in a server action — serverless instances can freeze before it resolves | Awaited (the function never throws; it catches and logs internally) |
| 4 | Important | `revalidatePath` two-line block copy-pasted across 7 sites | `revalidatePublicGalleryPages()` helper in `api-helpers.ts` |
| 5 | Minor | Dead writes/data: gallery DELETE nulled `coverImageId` on the row it then deleted; `ext` field threaded client→server but never read; login route re-implemented `parseJsonBody` | All removed; login route uses `parseJsonBody` |
| 6 | Minor | Session-type allowlist mirrored by comment; hardcoded nav Instagram link and SES recipient read like oversights | `SESSION_TYPES` shared constant renders the form options; intentional hardcodes documented with comments |

### Test Quality (5 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Important | Contact rate-limit branch had zero coverage — despite the 04-26 audit (T4) recording it as covered | Test added (5 seeded submissions → rejection, nothing inserted) plus over-length, File-entry, and success-path/notification-payload tests |
| 2 | Important | `getPublishedGalleryBySlugWithImages` untested — its `isPublished` guard is what keeps draft galleries off the public site, and `toPublicImage` strips `s3Key` | 3 tests: unknown slug, unpublished gallery, projection (asserts no `s3Key` leaks) |
| 3 | Minor | `bcrypt.test.ts` exercised only the third-party library; `SETTINGS_ID` test was tautological | Both deleted |
| 4 | Minor | `vi.doUnmock` inside test bodies leaked mocks on assertion failure; login mock never exercised the unknown-user branch | doUnmock moved to `afterEach`; unknown-email 401 test added; 30 MB size-cap branch now unit-tested with a mocked SDK |
| 5 | Minor | Brittle `text=Admin` e2e selector | `getByRole("heading", { name: "Admin Login" })` |

### Documentation (3 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Important | No README anywhere: install, env vars, migrations, the required seed step, and the pre-commit gate were undocumented | README.md added (setup, commands table, architecture notes, gate behavior) |
| 2 | Minor | `NEXT_PUBLIC_SITE_URL` missing from `.env.example` | Added |
| 3 | Minor | No e2e npm script; `playwright.config.ts` webServer still ran `npm run dev` post-pnpm-migration | `test:e2e` script added; webServer uses `pnpm dev` |

### Data Flow (3 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Critical | All four `GalleryImageManager` mutation helpers ignored `res.ok` (silent edit reversion) and lacked try/finally (network error left the tile permanently stuck busy) — regression of the 04-26 C16 convention | Shared `mutate` helper: `res.ok` check, `alert` on failure, `finally` busy-clear; alt editor stays open on failure; Enter+blur double-fire guarded |
| 2 | Minor | Post-update re-SELECTs in images/[id], galleries/[id], settings routes; settings row accessed 4 different ways | `.returning()` everywhere; all settings access keyed by `SETTINGS_ID` (contact action via `getSettings()`, admin page/PUT by ID) |
| 3 | Minor | Write-time vs read-time trim inconsistency; `isPublished`/`contactFormEnabled` accepted any integer while `isRead` was 0/1-validated | All settings text fields trimmed at write (read-site trims removed); 0/1 validation parity; settings PUT also gained string-type guards |

## Test Impact

- **Before:** 66 tests, 11 files (all passing)
- **After:** 74 tests, 10 files (all passing)
- **Removed:** `src/db/__tests__/bcrypt.test.ts` (2 library-only tests), `SETTINGS_ID` tautology (1)
- **New/enhanced test files:** `s3.test.ts` (+2 size-cap), `images.test.ts` (+2 display rendition), `galleries.test.ts` (rewritten homepage mocks, +3 slug-helper), `contact-actions.test.ts` (+4), `login-route.test.ts` (rewritten mock, +1 unknown-user, 6 total), `api-helpers.test.ts` (params passthrough), `e2e/smoke.spec.ts` (selector)

## New Modules

| File | Purpose |
|------|---------|
| `src/lib/image-types.ts` | Single source of truth for accepted image MIME types and extensions |
| `src/lib/contact.ts` | `SESSION_TYPES` and `CONTACT_FIELD_LIMITS` shared by the contact form and server action |
| `drizzle/0002_fine_taskmaster.sql` | Adds nullable `images.display_url` |
| `drizzle/0003_adorable_richard_fisk.sql` | Creates `login_attempts` table with `(ip, attempted_at)` index |
| `README.md` | Project setup, commands, and architecture documentation |

## Deploy Notes

- **Migrations 0002 and 0003 must be applied** (`pnpm exec drizzle-kit push`) before deploying this branch — the sandbox has no production DB access.
- Existing images have `displayUrl = null` and fall back to the original in the lightbox; re-uploading older hero images would give them the fast rendition. No backfill is required for correctness.
- The images `[id]` endpoint changed verb PATCH → PUT (client updated in the same commit; no third-party consumers exist).

## Not Addressed

| Item | Reason |
|------|--------|
| Social-link URL scheme validation, login timing equalization, client-supplied `s3Key` shape validation, session-token hashing, CSP header | Security-hardening minors; consistent with prior audits' posture for a single-admin site with `SameSite=Strict` sessions |
| About-image S3 orphan cleanup | Minor, invisible accumulation; needs a deliberate lifecycle design (deferred like prior D-items) |
| Bounded-concurrency multi-file uploads | Admin-only workflow; serialization is acceptable and simpler |
| Messages page pagination / galleries-index cover column projection | Negligible at current scale |
| Per-IP contact rate limiting, conditional session refresh, CDN warm-up | Previously deferred (04-07 S5, P6; 04-26 P9); nothing changed the calculus |
| Sandbox-skipped verification | E2e suite and a live upload/lightbox pass against a running server remain pre-deploy steps, as in prior audits |

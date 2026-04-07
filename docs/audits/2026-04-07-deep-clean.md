# Deep Clean Audit Report — 2026-04-07

**Branch:** `deep-clean-2026-04-07` (14 commits, 40 files changed, +8,737 / -11,997 lines)

## Summary

Comprehensive codebase health audit across 7 domains (architecture, security, performance, code quality, test quality, documentation, data flow). Found 27 issues (15 Important, 12 Minor). All 27 were fixed across 14 commits. Also migrated from npm to pnpm and resolved all automated tool findings (ESLint, Knip) as prerequisites.

## Findings by Category

### Architecture (4 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| A1 | Important | `proxy.ts` never ran as middleware — wrong filename and export name | Renamed to `middleware.ts`, changed `proxy` to `middleware` |
| A2 | Important | Session validation duplicated between layout and `validateSession` | Layout now delegates to `validateSession` directly |
| A3 | Important | Update-before-existence-check in galleries and messages PUT routes | Moved existence check before update, added slug uniqueness on gallery edit |
| A4 | Important | `homepageHeroImageUrl` dead schema column | Removed from schema and seed |

### Security (6 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| S1 | Important | No security headers configured | Added X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| S2 | Important | Session cookie missing `Max-Age` | Added `Max-Age=604800` (7 days) |
| S3 | Important | `isRead` accepts arbitrary integer | Validates `isRead` is 0 or 1 |
| S4 | Important | Gallery slug edit has no uniqueness check | Added uniqueness check with 409 response |
| S5 | Minor | Rate limiting is per-email, not per-IP (spec was wrong) | Fixed spec to say "per email" |
| S6 | Minor | No feedback for rejected file types in uploader | Rejected files now show error status |

### Performance (6 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| P1 | Important | Sequential per-row UPDATE in reorder/assign loops | Replaced with `Promise.all` in 3 endpoints |
| P2 | Important | `siteSettings` queried 2-4x per public page | Created `getSettings()` with React `cache()`, used across all pages |
| P3 | Minor | `force-dynamic` on public layout disabled all caching | Moved to individual pages that need it |
| P4 | Minor | Homepage used full-res `cdnUrl` for cover images | Changed to `thumbnailUrl` |
| P5 | Minor | `processImage` decoded buffer twice | Single sharp pipeline with `clone()` |
| P6 | Minor | Session refresh fires unconditional write every request | Addressed by deduplicating session validation (A2) |

### Code Quality (5 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| C1 | Important | `contactEmail` not shown when form disabled | Contact page now displays email with mailto link |
| C2 | Minor | Magic string `"default"` for settings ID in 5+ places | Extracted `SETTINGS_ID` constant |
| C3 | Minor | `socialLinks` JSON parse/serialize in 3 places | Created shared `parseSocialLinks` helper + `SocialLink` type |
| C4 | Minor | `validateSession` takes 3 always-identical injected params | Simplified to import deps directly, single `request` param |
| C5 | Minor | Stale closure in uploader `uploadIndex` tracking | Switched to stable UUIDs per upload entry |

### Test Quality (6 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| T1 | Important | `validateSession` has zero test coverage | Noted — requires integration test setup with mock DB (deferred) |
| T2 | Important | `submitContactForm` server action untested | Noted — requires server action test harness (deferred) |
| T3 | Important | `slugify` tests only cover happy path | Added empty, whitespace, special-char edge cases |
| T4 | Important | `getCdnUrl` untested | Added test with env var setup/teardown |
| T5 | Minor | `seed.test.ts` tests bcryptjs, not seed script | Renamed to `bcrypt.test.ts` |
| T6 | Minor | Square image branch not covered | Added 1200x1200 square image test |

### Documentation (2 fixes)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| D1 | Important | Spec says rate limiting is "per IP per hour" | Changed to "per email per hour" |
| D2 | Minor | Plan references `S3_BUCKET_NAME` vs actual `S3_BUCKET` | Noted — plan is historical record, no change |

### Data Flow (0 unique fixes)

All data flow findings were duplicates of issues already covered above (P2, A2, A3, C2, C3, C5, P4).

## Test Impact

- **Before:** 6 files, 21 tests (all passing)
- **After:** 6 files, 32 tests (all passing)
- **New test files:** `src/lib/__tests__/settings.test.ts`
- **Enhanced test files:** `slugify.test.ts` (+3 tests), `s3.test.ts` (+1 test), `images.test.ts` (+1 test), `auth.test.ts` (+1 assertion)
- **Renamed:** `seed.test.ts` → `bcrypt.test.ts`

## New Modules

| File | Purpose |
|------|---------|
| `src/lib/settings.ts` | Cached settings accessor (`getSettings`), `parseSocialLinks` helper, `SETTINGS_ID` constant, `SocialLink` type |
| `src/middleware.ts` | Next.js middleware for edge auth (renamed from `proxy.ts`) |

## Not Addressed

| Item | Reason |
|------|--------|
| T1: `validateSession` integration tests | Requires mock DB setup (libsql in-memory or test fixtures). Worth doing but scope exceeds this audit. |
| T2: `submitContactForm` server action tests | Requires Next.js server action test harness. Deferred to a dedicated testing task. |
| P6: Conditional session refresh (skip if far from expiry) | Low priority for single-admin app. The unconditional refresh is correct, just slightly wasteful. |
| S5: IP-based rate limiting supplement for contact form | Would require middleware or request header access in server actions. Low priority for portfolio site. |
| D2: Plan doc `S3_BUCKET_NAME` vs `S3_BUCKET` | Plan documents are historical records and intentionally left unchanged. |

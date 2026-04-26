# Skipped Verification — 2026-04-26 Mindy Feature Requests

Sandbox environment lacked `.env` (Turso/S3 credentials), Chrome DevTools MCP, Vercel CLI, and the docs referenced at `~/.claude/CLAUDE.md`. All code, type-check, lint, and pure-unit-test steps were executed; the items below need to be run locally before merge.

Format: `[Chunk N / Task M / Step K]` followed by what to do.

## Pending verification

- [Chunk 1 / Task 1 / Step 3] Manual Chrome DevTools MCP verification of cache invalidation: in admin, edit a published gallery and uncheck Published, save; navigate to `/portfolio` and confirm the gallery disappears immediately (no reload). Navigate to `/portfolio/<unpublished-slug>` and expect a 404. Re-publish, navigate back to `/portfolio`, and confirm the gallery reappears.
- [Chunk 2 / Task 3 / Step 2] Apply the additive `category` column to the live DB with `pnpm exec drizzle-kit push`; expected output is a single `ADD COLUMN` for `galleries.category`. Reject any drop/rename suggestion. Sanity-check row count before and after with `pnpm exec tsx -e "import {db} from './src/db/client'; import {galleries} from './src/db/schema'; db.select().from(galleries).then(r => console.log(r.length, 'galleries'))"` — count must be unchanged.
- [Chunk 2 / Task 3 / Step 3] Restart the dev server (`pnpm dev`) and visit `/admin/galleries/<any-id>` to confirm the page still renders without `column not found` errors after the schema push.
- [Chunk 2 / Task 4 / Step 3] Smoke-test the gallery API after deploying the column: log into `/admin/login`, then in the browser devtools console POST `{ title: "TEST CATEGORY", category: "places" }` to `/api/admin/galleries` and confirm the response includes `category: "places"`. PUT `{ category: "people" }` to that gallery's id and verify the field changes. DELETE the test gallery to clean up.
- [Chunk 2 / Task 5 / Step 5] Manual verification of the category dropdown: with the dev server running, visit `/admin/galleries/new`, create a gallery with category=Places, verify it persists. Then edit it, change to People, save, reload, confirm the dropdown reflects the saved value.
- [Chunk 3 / Task 8 / Step 4] Visit `/people`, `/places`, and `/prints` in the browser. Each should render its heading; if any galleries from Task 5 have a matching category, they appear in the grid.
- [Chunk 3 / Task 9 / Step 2] Visit `/portfolio` in the browser; it should redirect to `/`.
- [Chunk 4 / Task 10 / Step 2] Visual verification with Chrome DevTools MCP: navigate to `/`, `/people`, `/places`, `/prints`, `/contact`. On each, confirm the wordmark reads "MINDY HU", the corresponding link is underlined with `underline-offset-8`, and the nav background is light (`bg-white/90` with backdrop blur). Note: the homepage background changes in Chunk 5, so until that lands the homepage may look odd against the still-existing slideshow.

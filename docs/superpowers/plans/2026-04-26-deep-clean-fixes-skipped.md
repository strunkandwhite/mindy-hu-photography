# Skipped Verification — 2026-04-26 Deep Clean Fixes

Sandbox environment lacked `.env` (Turso/S3 credentials), Chrome DevTools MCP, and live S3. The chunk plan also explicitly forbids `drizzle-kit push`. The items below need to be run locally before merge.

Format: `[Chunk N / Task M / Step K]` followed by what to do.

## Pending verification

- [Chunk 1 / Task 1 / Step 2] Apply the schema change to the live DB. The repo previously had no `drizzle/` directory, so `pnpm exec drizzle-kit generate` produced a baseline `0000_gray_sphinx.sql` (full schema, already excluding `category`) rather than an `ALTER TABLE … DROP COLUMN category` migration. Before merge, run `pnpm exec drizzle-kit push` against the live Turso DB and confirm Drizzle proposes only `DROP COLUMN category` (reject any other destructive change).
- [Chunk 1 / Task 2 / Step 2] Apply the index migration via `pnpm exec drizzle-kit push`; expect the generated `drizzle/0001_groovy_deadpool.sql` (`CREATE INDEX images_gallery_id_idx ON images (gallery_id, sort_order)`) to be the only change. Reject any drop/rename suggestion.
- [Chunk 2 / Task 7 / Step 4] Manual smoke test of admin alt text editor: `pnpm dev`, visit `/admin/galleries/<some-id>`, click "+ alt" on an image, type, hit Enter, refresh page, confirm the alt text persisted. Sandbox lacks `.env` and a running dev server.
- [Chunk 3 / Task 8 / Step 1] Verify SQLite `ORDER BY RANDOM() LIMIT` works against the live Turso DB by hitting `/` and confirming the homepage grid still renders 12 randomized images per visit. Sandbox lacks `.env` and a running dev server.
- [Chunk 3 / Task 9 / Step 3] Verify `revalidatePath` actually invalidates the now-statically-rendered `/galleries`, `/portfolio/[slug]`, and `/contact` pages: run `pnpm build && pnpm start`, mutate via the admin UI (create/update gallery, add image, change settings), then reload the corresponding public page and confirm the change is visible. Sandbox lacks `.env`, a build target, and a running server.
- [Chunk 3 / Task 10 / Step 2] Verify image registration end-to-end against live S3: upload via admin UI and confirm the new `getObjectBuffer` path replaces the prior CloudFront fetch without errors. Sandbox lacks `.env` and AWS credentials.
- [Chunk 5 / Task 15 / Step 2] Manual smoke: with `.env` and admin auth, POST to `/api/admin/settings/about-image` with `{ contentType: "image/jpeg" }` and confirm a presigned URL is returned; repeat with `{ contentType: "application/octet-stream" }` and confirm 400. Sandbox lacks `.env` and a running dev server.
- [Chunk 5 / Task 18 / Step 2] Verify the 30 MB cap end-to-end against live S3: upload an oversized object via the presigned URL, then call the registration endpoint and confirm a 413 response plus the orphan is deleted from S3. Sandbox lacks `.env` and AWS credentials.

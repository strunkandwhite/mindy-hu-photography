# Skipped Verification — 2026-04-26 Deep Clean Fixes

Sandbox environment lacked `.env` (Turso/S3 credentials), Chrome DevTools MCP, and live S3. The chunk plan also explicitly forbids `drizzle-kit push`. The items below need to be run locally before merge.

Format: `[Chunk N / Task M / Step K]` followed by what to do.

## Pending verification

- [Chunk 1 / Task 1 / Step 2] Apply the schema change to the live DB. The repo previously had no `drizzle/` directory, so `pnpm exec drizzle-kit generate` produced a baseline `0000_gray_sphinx.sql` (full schema, already excluding `category`) rather than an `ALTER TABLE … DROP COLUMN category` migration. Before merge, run `pnpm exec drizzle-kit push` against the live Turso DB and confirm Drizzle proposes only `DROP COLUMN category` (reject any other destructive change).
- [Chunk 1 / Task 2 / Step 2] Apply the index migration via `pnpm exec drizzle-kit push`; expect the generated `drizzle/0001_groovy_deadpool.sql` (`CREATE INDEX images_gallery_id_idx ON images (gallery_id, sort_order)`) to be the only change. Reject any drop/rename suggestion.

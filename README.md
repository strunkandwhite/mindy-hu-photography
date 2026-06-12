# Mindy Hu Photography

Photography portfolio site: a public side (homepage mosaic, galleries, lightbox, contact form) and a single-admin CMS (gallery/image/message/settings management).

**Stack:** Next.js 16 (App Router) · TypeScript · Drizzle ORM + Turso (libsql) · S3 + CloudFront for images (sharp renditions) · SES for contact notifications · Tailwind CSS 4 · vitest + Playwright.

## Setup

```bash
pnpm install
cp .env.example .env   # fill in real values (see below)
pnpm exec drizzle-kit push        # apply schema to the Turso database
pnpm db:seed <admin-email> <password>  # creates the admin user + settings row (required)
pnpm dev
```

The app is unusable without the seed step — the admin UI and settings reads expect the seeded `site_settings` row.

## Environment variables

See `.env.example` for the full list. All are required except `NEXT_PUBLIC_SITE_URL` (defaults to the production domain) and `TURSO_AUTH_TOKEN` (optional for local file DBs).

## Development

| Command | Purpose |
|---------|---------|
| `pnpm dev` | dev server |
| `pnpm build` / `pnpm start` | production build / serve |
| `pnpm test` | vitest unit suite |
| `pnpm test:e2e` | Playwright smoke tests (starts the dev server itself) |
| `pnpm lint` / `pnpm lint:knip` | ESLint / dead-code detection |
| `pnpm exec drizzle-kit generate` | generate a migration after editing `src/db/schema.ts` |

A husky pre-commit hook runs `tsc --noEmit`, `lint`, `test`, and `knip` — commits fail unless all four pass. Note knip's strictness: intermediate states with temporarily-unused exports won't commit.

## Architecture notes

- Public pages read through `src/lib/galleries.ts` / `src/lib/settings.ts`; admin server components query the DB directly.
- Admin API routes under `src/app/api/admin/` are wrapped by `withAdminAuth` (`src/lib/api-helpers.ts`); auth is cookie-session based (`src/lib/auth.ts`), with a route-level check in `src/proxy.ts`.
- Image uploads: presigned S3 PUT → register endpoint generates thumbnail (800px) and display (2048px) WebP renditions via sharp.
- Audit history lives in `docs/audits/`; implementation plans in `docs/superpowers/plans/`.

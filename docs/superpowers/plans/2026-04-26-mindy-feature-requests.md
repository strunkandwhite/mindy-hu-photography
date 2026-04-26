# Mindy Feature Requests Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three publishing/settings bugs and ship four feature requests from Mindy: gallery delete, per-image management inside galleries, an about-with-image block on the contact page, and a redesigned homepage + nav matching her reference screenshots (Overview / People / Places / Prints / Contact).

**Architecture:** All bugs share one root cause — public pages are statically rendered and admin API routes don't revalidate. Fix by adding `export const dynamic = "force-dynamic"` to public pages (matches the existing pattern at `src/app/(public)/page.tsx:1` and `src/app/(public)/contact/page.tsx:1`). Categories are introduced as a nullable `category` text column on `galleries` (values `"people" | "places" | "prints"`, validated in app code). Each category gets its own public route reusing one shared listing component. Homepage replaces the Ken Burns slideshow with a randomized varied-aspect grid. Contact page combines about-image + bio + email + form. Per-image management reuses existing API routes (`PUT /api/admin/images/assign`, `PUT /api/admin/galleries/[id]` for cover, `DELETE /api/admin/galleries/[id]`) — all already implemented.

**Tech Stack:** Next.js 16.2.1 App Router, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM 0.45.1 + Turso/libSQL, AWS S3 + CloudFront for images, Vitest 4 for unit tests, Playwright 1.58 for e2e, pnpm.

**Verification access:** App is running locally; Chrome DevTools MCP available for visual checks.

**Execution context:** Implementation will be done in a sandbox environment (with Chrome DevTools MCP, Vercel preview-deployment verification, and the full sandbox toolchain available — see `~/.claude/CLAUDE.md` "Vercel Preview Deployment Verification" section). The implementer should commit each task as the plan specifies, push to a feature branch, and use the Vercel preview to verify visual changes before merging. After sandbox work completes, the user will pull the branch locally for a final round of in-the-browser verification and any UX tweaks before merging to master.

---

## Context (background for the implementer)

Three concrete bugs reported:
1. Unpublishing a gallery in admin: it stays visible on `/portfolio` but 404s on click.
2. Newly-published gallery doesn't appear on `/portfolio`.
3. Settings save (about text, contact email) but those values render nowhere on the public site.

Root causes (verified by reading source):
- `src/app/(public)/portfolio/page.tsx` and `src/app/(public)/portfolio/[slug]/page.tsx` are not marked dynamic. No `revalidatePath` calls anywhere in `src/app/api/admin/`. Next.js statically caches both.
- `siteSettings.aboutText` is written by `src/components/admin/settings-form.tsx` and saved by `src/app/api/admin/settings/route.ts`, but no public component reads it. `siteSettings.aboutImageUrl` exists in schema (`src/db/schema.ts:24`) but has no admin UI to set it.
- `siteSettings.contactEmail` only renders in `src/app/(public)/contact/page.tsx` when `contactFormEnabled === 0` (the form-disabled fallback). With form enabled, the email is invisible.

Four features requested:
4. Delete a gallery — `DELETE /api/admin/galleries/[id]` exists at `src/app/api/admin/galleries/[id]/route.ts:74` but no UI.
5. Remove / reassign images inside a gallery edit page — `PUT /api/admin/images/assign` (sets `galleryId` to anything including `null`) exists at `src/app/api/admin/images/assign/route.ts` but no UI.
6. About-image upload + display on Contact page combining bio + email (matches `~/Downloads/mindy-2.png`).
7. Homepage as a randomized varied-aspect grid + nav with category tabs (Overview / People / Places / Prints / Contact, matches `~/Downloads/mindy-1.png`).

Decisions confirmed with user before planning:
- About lives on the Contact page (no separate `/about` route).
- Homepage replaces (not augments) the slideshow with a grid.
- Image reordering inside a gallery is **out of scope** — only remove / move-to-other-gallery / set-as-cover.
- Nav matches reference exactly: Overview, People, Places, Prints, Contact. Galleries get a category field.

---

## File map

**New files:**
- `src/app/(public)/people/page.tsx` — People category listing
- `src/app/(public)/places/page.tsx` — Places category listing
- `src/app/(public)/prints/page.tsx` — Prints category listing
- `src/components/public/category-grid.tsx` — Shared listing component (formerly the body of `/portfolio/page.tsx`)
- `src/components/public/homepage-grid.tsx` — Varied-aspect tile grid for `/`
- `src/components/admin/delete-gallery-button.tsx` — Confirm-and-delete client component
- `src/components/admin/gallery-image-manager.tsx` — Per-image actions (set cover, remove, move)
- `src/components/admin/about-image-uploader.tsx` — Picks a file, uses presigned URL flow, posts URL to settings
- `src/app/api/admin/settings/about-image/route.ts` — Returns `{ uploadUrl, cdnUrl }` (presigned PUT) for about image; does not touch the `images` table
- `src/lib/__tests__/galleries.test.ts` — Unit tests for new lib functions
- `src/lib/categories.ts` — Single source of truth for category constants and validation

**Modified files:**
- `src/db/schema.ts` — Add `category` column to `galleries`
- `drizzle/<new>.sql` — Generated migration
- `src/lib/galleries.ts` — Add `getPublishedGalleriesByCategory`, `getHomepageGridImages`
- `src/app/api/admin/galleries/route.ts` — Accept `category` in POST body
- `src/app/api/admin/galleries/[id]/route.ts` — Accept `category` in PUT body
- `src/components/admin/gallery-form.tsx` — Add category dropdown
- `src/app/admin/(authenticated)/galleries/[id]/page.tsx` — Mount `<DeleteGalleryButton>` + `<GalleryImageManager>`; pass other galleries as prop
- `src/components/admin/settings-form.tsx` — Mount `<AboutImageUploader>`
- `src/app/api/admin/settings/route.ts` — (no change needed; already accepts `aboutImageUrl`)
- `src/app/(public)/portfolio/page.tsx` — Convert to a redirect to `/`
- `src/app/(public)/portfolio/[slug]/page.tsx` — Add `force-dynamic`
- `src/app/(public)/page.tsx` — Replace `<HeroSlideshow>` with `<HomepageGrid>`
- `src/app/(public)/contact/page.tsx` — Add about block (image + bio + email) above form
- `src/components/public/nav.tsx` — Wordmark + 5 links + active underline + always-light theme
- `src/app/(public)/layout.tsx` — Remove `<ConditionalFooter>` wrapper, render `<Footer>` always
- `e2e/smoke.spec.ts` — Update for new homepage + nav

**Deleted files:**
- `src/components/public/hero-slideshow.tsx` — No longer used
- `src/components/public/conditional-footer.tsx` — Footer now shows on every page
- `getHeroImages` export removed from `src/lib/galleries.ts`

---

## Chunk 1: Bug fixes (cache invalidation)

The smallest possible fix and highest-leverage. One commit; resolves bugs 1 and 2.

### Task 1: Force-dynamic on portfolio pages

**Files:**
- Modify: `src/app/(public)/portfolio/page.tsx` (add line at top)
- Modify: `src/app/(public)/portfolio/[slug]/page.tsx` (add line at top)

- [ ] **Step 1: Add `force-dynamic` to portfolio listing**

At the very top of `src/app/(public)/portfolio/page.tsx`, before any `import`:

```ts
export const dynamic = "force-dynamic";
```

- [ ] **Step 2: Add `force-dynamic` to gallery slug page**

At the very top of `src/app/(public)/portfolio/[slug]/page.tsx`, before any `import`:

```ts
export const dynamic = "force-dynamic";
```

- [ ] **Step 3: Manual verification with Chrome DevTools MCP**

App is already running. With `mcp__chrome-devtools__navigate_page`:
- Open admin, edit any published gallery, uncheck Published, save.
- Navigate to `/portfolio`. Expected: that gallery is gone immediately (no reload needed).
- Navigate to `/portfolio/<unpublished-slug>`. Expected: 404.
- Re-publish, navigate to `/portfolio`. Expected: gallery is back.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(public\)/portfolio/page.tsx src/app/\(public\)/portfolio/\[slug\]/page.tsx
git commit -m "Fix stale portfolio cache by forcing dynamic rendering"
```

---

## Chunk 2: Categories — schema, lib, API, admin form

Add the category column and wire it through admin so we can categorize galleries before the public category routes need data.

### Task 2: Single source of truth for categories

**Files:**
- Create: `src/lib/categories.ts`
- Create: `src/lib/__tests__/categories.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/__tests__/categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CATEGORIES, isCategory, type Category } from "../categories";

describe("categories", () => {
  it("exposes the canonical list", () => {
    expect(CATEGORIES).toEqual(["people", "places", "prints"]);
  });

  it("isCategory accepts valid values", () => {
    expect(isCategory("people")).toBe(true);
    expect(isCategory("places")).toBe(true);
    expect(isCategory("prints")).toBe(true);
  });

  it("isCategory rejects invalid values", () => {
    expect(isCategory("portraits")).toBe(false);
    expect(isCategory("")).toBe(false);
    expect(isCategory(null)).toBe(false);
    expect(isCategory(undefined)).toBe(false);
    expect(isCategory(42)).toBe(false);
  });

  it("Category type narrows to the literal union", () => {
    const c: Category = "people";
    expect(CATEGORIES).toContain(c);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm test src/lib/__tests__/categories.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the module**

`src/lib/categories.ts`:

```ts
export const CATEGORIES = ["people", "places", "prints"] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export const CATEGORY_LABELS: Record<Category, string> = {
  people: "People",
  places: "Places",
  prints: "Prints",
};
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm test src/lib/__tests__/categories.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.ts src/lib/__tests__/categories.test.ts
git commit -m "Add category constants and validation helper"
```

### Task 3: Add `category` column to galleries schema + migration

**Files:**
- Modify: `src/db/schema.ts:30-40`
- Generated: `drizzle/<timestamp>_<name>.sql`

- [ ] **Step 1: Edit the schema**

In `src/db/schema.ts`, inside the `galleries` table definition, add a `category` column. After line `description: text("description"),` add:

```ts
  category: text("category"),
```

The column is nullable — existing galleries become "uncategorized" until edited.

- [ ] **Step 2: Apply the additive change with `drizzle-kit push`**

This repo has **no migration history** (no `drizzle/` directory). `drizzle-kit generate` would emit a baseline migration containing `CREATE TABLE` for every existing table, and `drizzle-kit migrate` would then fail against the live DB ("table already exists"). For an additive nullable column, the safe path is `drizzle-kit push`:

Run: `pnpm exec drizzle-kit push`
Expected output: prompts to add `category` column to `galleries` (no destructive changes). Confirm.

If `push` reports anything other than a single `ADD COLUMN`, abort and ask for review — do not accept any drop/rename suggestions.

Sanity-check before and after:
```bash
pnpm exec tsx -e "import {db} from './src/db/client'; import {galleries} from './src/db/schema'; db.select().from(galleries).then(r => console.log(r.length, 'galleries'))"
```
Row count must be unchanged after `push`.

- [ ] **Step 3: Verify in dev**

Restart the dev server (`pnpm dev`). Navigate to `/admin/galleries/<any-id>` — page should still render (no `column not found` errors).

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "Add nullable category column to galleries"
```

### Task 4: Accept `category` in gallery API routes

**Files:**
- Modify: `src/app/api/admin/galleries/route.ts:7-61` (POST)
- Modify: `src/app/api/admin/galleries/[id]/route.ts:6-72` (PUT)

- [ ] **Step 1: Update POST body type and writes**

In `src/app/api/admin/galleries/route.ts`:

Change body type (around line 13):
```ts
let body: { title?: string; description?: string; category?: string | null };
```

Add the import at the **top** of the file alongside the existing imports (do not paste the comment block from this plan literally):
```ts
import { isCategory } from "@/lib/categories";
```

After validating `title`, validate category:
```ts
const category =
  body.category === null || body.category === undefined || body.category === ""
    ? null
    : isCategory(body.category)
      ? body.category
      : null;
if (body.category && !isCategory(body.category)) {
  return Response.json({ error: "Invalid category" }, { status: 400 });
}
```

Add `category` to the inserted record (around line 47):
```ts
const record = {
  id,
  title,
  slug,
  description: description ?? null,
  category,
  sortOrder: nextSortOrder,
  isPublished: 0,
  createdAt: now,
  updatedAt: now,
};
```

- [ ] **Step 2: Update PUT to accept category**

In `src/app/api/admin/galleries/[id]/route.ts`:

Extend body type (line 28):
```ts
let body: {
  title?: string;
  slug?: string;
  description?: string;
  isPublished?: number;
  coverImageId?: string | null;
  category?: string | null;
};
```

Add `import { isCategory } from "@/lib/categories";` at the **top** of the file with the other imports.

After the existing `coverImageId` mapping (after line 61), add:
```ts
if (body.category !== undefined) {
  if (body.category === null || body.category === "") {
    updates.category = null;
  } else if (isCategory(body.category)) {
    updates.category = body.category;
  } else {
    return Response.json({ error: "Invalid category" }, { status: 400 });
  }
}
```

- [ ] **Step 3: Smoke-test the API**

With the dev server running, log in to admin (`/admin/login`) using credentials. Use the browser devtools console to:

```js
await fetch("/api/admin/galleries", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "TEST CATEGORY", category: "places" }),
}).then(r => r.json());
```

Expected: response object includes `category: "places"`.

Then PUT with `{ category: "people" }` to that gallery's id and verify the field changes. Then DELETE to clean up (call `DELETE /api/admin/galleries/<id>`).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/galleries/
git commit -m "Accept and validate category in gallery API"
```

### Task 5: Category dropdown in admin gallery form

**Files:**
- Modify: `src/components/admin/gallery-form.tsx`

- [ ] **Step 1: Extend GalleryData type and state**

At the top of `src/components/admin/gallery-form.tsx`, import categories:
```ts
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/categories";
```

Extend the `GalleryData` type (line 6):
```ts
type GalleryData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isPublished: number;
  category: Category | null;
};
```

Add state below `isPublished` state (line 27):
```ts
const [category, setCategory] = useState<Category | "">(gallery?.category ?? "");
```

- [ ] **Step 2: Send category in submit body**

Modify the `body` object construction (line 36) so both create and edit send category. Replace lines 36-44 with:

```ts
const body: Record<string, unknown> = {
  title,
  description: description || null,
  category: category === "" ? null : category,
};

if (isEdit) {
  body.slug = slug;
  body.isPublished = isPublished ? 1 : 0;
}
```

- [ ] **Step 3: Render the dropdown**

Add this `<div>` between the description textarea (ends line 125) and the published checkbox (line 127):

```tsx
<div>
  <label htmlFor="category" className="block text-sm text-gray-700 mb-1">
    Category
  </label>
  <select
    id="category"
    value={category}
    onChange={(e) => setCategory(e.target.value as Category | "")}
    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
  >
    <option value="">— None —</option>
    {CATEGORIES.map((c) => (
      <option key={c} value={c}>
        {CATEGORY_LABELS[c]}
      </option>
    ))}
  </select>
</div>
```

- [ ] **Step 4: Pass category from edit page**

In `src/app/admin/(authenticated)/galleries/[id]/page.tsx`, the `<GalleryForm gallery={...}>` prop object (line 35-41) needs a `category` field. After line 40 add:

```ts
          category: gallery.category as Category | null,
```

Add the import:
```ts
import type { Category } from "@/lib/categories";
```

- [ ] **Step 5: Manual verification**

`pnpm dev` (if not running). Navigate to `/admin/galleries/new`, create a gallery with category=Places, verify it persists. Then edit it, change to People, save, reload, confirm.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/gallery-form.tsx src/app/admin/\(authenticated\)/galleries/\[id\]/page.tsx
git commit -m "Add category dropdown to gallery admin form"
```

---

## Chunk 3: Public category pages

### Task 6: `getPublishedGalleriesByCategory` data loader

**Files:**
- Modify: `src/lib/galleries.ts`
- Create: `src/lib/__tests__/galleries.test.ts`

- [ ] **Step 1: Write the test (mock-based, matches project style for non-pure helpers)**

Existing tests in `src/lib/__tests__/` are all pure-function tests (no DB mocking). For data loaders we need to mock `@/db/client`. Create `src/lib/__tests__/galleries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyGalleries = vi.fn();
const findManyImages = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    query: {
      galleries: { findMany: findManyGalleries },
      images: { findMany: findManyImages },
    },
  },
}));

import { getPublishedGalleriesByCategory } from "../galleries";

describe("getPublishedGalleriesByCategory", () => {
  beforeEach(() => {
    findManyGalleries.mockReset();
    findManyImages.mockReset();
  });

  it("returns empty array when no galleries match", async () => {
    findManyGalleries.mockResolvedValue([]);
    const result = await getPublishedGalleriesByCategory("places");
    expect(result).toEqual([]);
    expect(findManyImages).not.toHaveBeenCalled();
  });

  it("attaches cover image when coverImageId is set", async () => {
    findManyGalleries.mockResolvedValue([
      { id: "g1", title: "G1", slug: "g1", coverImageId: "i1", category: "places", isPublished: 1, sortOrder: 0 },
      { id: "g2", title: "G2", slug: "g2", coverImageId: null, category: "places", isPublished: 1, sortOrder: 1 },
    ]);
    findManyImages.mockResolvedValue([
      { id: "i1", thumbnailUrl: "https://cdn/i1.webp", width: 800, height: 1000, altText: null },
    ]);
    const result = await getPublishedGalleriesByCategory("places");
    expect(result[0].coverImage?.id).toBe("i1");
    expect(result[1].coverImage).toBeNull();
  });
});
```

This pattern (top-level `vi.mock` of `@/db/client` with named `vi.fn()` instances) will be reused for `getHomepageGridImages` in Task 11.

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/lib/__tests__/galleries.test.ts`
Expected: FAIL — `getPublishedGalleriesByCategory` is not exported.

- [ ] **Step 3: Add the function**

In `src/lib/galleries.ts`, after `getPublishedGalleriesWithCovers` (ends line 28), add:

```ts
import type { Category } from "./categories";

export async function getPublishedGalleriesByCategory(category: Category) {
  const publishedGalleries = await db.query.galleries.findMany({
    where: and(eq(galleries.isPublished, 1), eq(galleries.category, category)),
    orderBy: asc(galleries.sortOrder),
  });

  const coverIds = publishedGalleries
    .map((g) => g.coverImageId)
    .filter((id): id is string => id !== null);

  const coverImages =
    coverIds.length > 0
      ? await db.query.images.findMany({ where: inArray(images.id, coverIds) })
      : [];

  const coverMap = new Map(coverImages.map((img) => [img.id, img]));

  return publishedGalleries.map((gallery) => ({
    ...gallery,
    coverImage: gallery.coverImageId ? coverMap.get(gallery.coverImageId) ?? null : null,
  }));
}
```

`and`, `eq`, `asc`, `inArray` are already imported at line 3.

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm test src/lib/__tests__/galleries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/galleries.ts src/lib/__tests__/galleries.test.ts
git commit -m "Add getPublishedGalleriesByCategory data loader"
```

### Task 7: Shared category-grid component

**Files:**
- Create: `src/components/public/category-grid.tsx`

- [ ] **Step 1: Extract the existing grid markup**

Copy the JSX from `src/app/(public)/portfolio/page.tsx` (the `<div className="max-w-6xl mx-auto grid ...">` block at lines 12-36) into a new server component:

```tsx
import Link from "next/link";
import Image from "next/image";

type GalleryCard = {
  id: string;
  slug: string;
  title: string;
  coverImage: {
    thumbnailUrl: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
};

export function CategoryGrid({ galleries }: { galleries: GalleryCard[] }) {
  if (galleries.length === 0) {
    return <p className="text-center text-sm text-gray-400">No galleries yet.</p>;
  }
  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {galleries.map((gallery) => (
        <Link key={gallery.id} href={`/portfolio/${gallery.slug}`} className="group block">
          {gallery.coverImage ? (
            <div className="relative overflow-hidden">
              <Image
                src={gallery.coverImage.thumbnailUrl}
                alt={gallery.coverImage.altText || gallery.title}
                width={gallery.coverImage.width}
                height={gallery.coverImage.height}
                className="w-full object-cover aspect-[3/4] transition-all duration-500 group-hover:scale-[1.03] group-hover:brightness-[0.85]"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="absolute inset-0 flex items-end p-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300">
                <h2 className="text-xs text-white tracking-widest">
                  {gallery.title.toUpperCase()}
                </h2>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 aspect-[3/4]" />
          )}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/public/category-grid.tsx
git commit -m "Extract shared CategoryGrid component"
```

### Task 8: Three category routes

**Files:**
- Create: `src/app/(public)/people/page.tsx`
- Create: `src/app/(public)/places/page.tsx`
- Create: `src/app/(public)/prints/page.tsx`

- [ ] **Step 1: Create `/people` page**

`src/app/(public)/people/page.tsx`:

```tsx
export const dynamic = "force-dynamic";

import { getPublishedGalleriesByCategory } from "@/lib/galleries";
import { CategoryGrid } from "@/components/public/category-grid";

export default async function PeoplePage() {
  const galleriesWithCovers = await getPublishedGalleriesByCategory("people");
  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <h1 className="text-center font-heading text-2xl text-gray-900 mb-10">People</h1>
        <CategoryGrid galleries={galleriesWithCovers} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `/places` page**

Same content but `getPublishedGalleriesByCategory("places")` and `<h1>Places</h1>` and exported function `PlacesPage`.

- [ ] **Step 3: Create `/prints` page**

Same content but `getPublishedGalleriesByCategory("prints")` and `<h1>Prints</h1>` and exported function `PrintsPage`.

- [ ] **Step 4: Verify in browser**

Visit `/places`, `/people`, `/prints`. Each should render the heading; if you've categorized any galleries from Task 5, the matching ones appear.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(public\)/people src/app/\(public\)/places src/app/\(public\)/prints
git commit -m "Add People / Places / Prints category routes"
```

### Task 9: Convert `/portfolio` to redirect

**Files:**
- Modify: `src/app/(public)/portfolio/page.tsx` (full rewrite)

- [ ] **Step 1: Replace the file with a redirect**

Overwrite `src/app/(public)/portfolio/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function PortfolioPage() {
  redirect("/");
}
```

The slug page `src/app/(public)/portfolio/[slug]/page.tsx` stays — it's the canonical individual-gallery URL.

- [ ] **Step 2: Verify**

Visit `/portfolio` — should land on `/`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/portfolio/page.tsx
git commit -m "Redirect /portfolio to homepage; categories are the new entry points"
```

---

## Chunk 4: Nav redesign

### Task 10: Wordmark + 5 links + always-light theme + active underline

**Files:**
- Modify: `src/components/public/nav.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the nav**

Overwrite `src/components/public/nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Overview" },
  { href: "/people", label: "People" },
  { href: "/places", label: "Places" },
  { href: "/prints", label: "Prints" },
  { href: "/contact", label: "Contact" },
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 py-5 bg-white/90 backdrop-blur-sm">
      <Link href="/" className="font-heading text-base tracking-[0.3em] text-gray-900">
        MINDY HU
      </Link>

      <div className="hidden md:flex gap-8">
        {links.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-xs tracking-widest transition-colors ${
                active ? "text-gray-900 underline underline-offset-8" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <button
        className="md:hidden text-gray-700"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          {menuOpen ? (
            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
          ) : (
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" fill="none" />
          )}
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-sm py-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-6 py-2 text-sm text-gray-600 tracking-wider"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Visual verification with Chrome DevTools MCP**

Navigate to `/`, `/people`, `/places`, `/prints`, `/contact`. On each, confirm: the wordmark reads "MINDY HU", the corresponding link is underlined, and the nav background is light (not transparent over a dark image — but the homepage background changes in Chunk 5, so for this commit the homepage will look odd until the grid lands).

- [ ] **Step 3: Commit**

```bash
git add src/components/public/nav.tsx
git commit -m "Redesign nav: MINDY HU wordmark, category links, active underline"
```

---

## Chunk 5: Homepage redesign

### Task 11: `getHomepageGridImages` data loader

**Files:**
- Modify: `src/lib/galleries.ts`
- Modify: `src/lib/__tests__/galleries.test.ts`

- [ ] **Step 1: Write failing test**

Append to `src/lib/__tests__/galleries.test.ts` (reuse the same `findManyGalleries` / `findManyImages` mocks defined at top of the file from Task 6):

```ts
import { getHomepageGridImages } from "../galleries";

describe("getHomepageGridImages", () => {
  beforeEach(() => {
    findManyGalleries.mockReset();
    findManyImages.mockReset();
  });

  it("returns empty array when no published galleries exist", async () => {
    findManyGalleries.mockResolvedValue([]);
    const result = await getHomepageGridImages();
    expect(result).toEqual([]);
  });

  it("caps results at 12 and attaches gallerySlug for each image", async () => {
    findManyGalleries.mockResolvedValue([
      { id: "g1", slug: "places-trip", isPublished: 1 },
    ]);
    const fakeImages = Array.from({ length: 20 }, (_, i) => ({
      id: `i${i}`,
      galleryId: "g1",
      thumbnailUrl: `https://cdn/i${i}.webp`,
      width: 800,
      height: 600,
      altText: null,
      filename: `i${i}.jpg`,
    }));
    findManyImages.mockResolvedValue(fakeImages);

    const result = await getHomepageGridImages();
    expect(result).toHaveLength(12);
    expect(result.every((r) => r.gallerySlug === "places-trip")).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm test src/lib/__tests__/galleries.test.ts`
Expected: FAIL — `getHomepageGridImages` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/galleries.ts`:

```ts
const HOMEPAGE_GRID_MAX = 12;

export async function getHomepageGridImages() {
  const publishedGalleries = await db.query.galleries.findMany({
    where: eq(galleries.isPublished, 1),
  });

  const galleryMap = new Map(publishedGalleries.map((g) => [g.id, g.slug]));
  const galleryIds = publishedGalleries.map((g) => g.id);
  if (galleryIds.length === 0) return [];

  const allImages = await db.query.images.findMany({
    where: inArray(images.galleryId, galleryIds),
  });

  // Shuffle (Fisher–Yates) so each visit re-orders.
  for (let i = allImages.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
  }

  return allImages.slice(0, HOMEPAGE_GRID_MAX).map((img) => ({
    id: img.id,
    thumbnailUrl: img.thumbnailUrl,
    width: img.width,
    height: img.height,
    altText: img.altText,
    filename: img.filename,
    gallerySlug: img.galleryId ? galleryMap.get(img.galleryId) ?? null : null,
  }));
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm test src/lib/__tests__/galleries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/galleries.ts src/lib/__tests__/galleries.test.ts
git commit -m "Add getHomepageGridImages data loader"
```

### Task 12: HomepageGrid component

**Files:**
- Create: `src/components/public/homepage-grid.tsx`

- [ ] **Step 1: Implement the grid**

The reference (`~/Downloads/mindy-1.png`) shows ~9 tiles in two rows: row 1 is 4 tiles with the rightmost ~2x wider, row 2 is 5 tiles. To approximate without overengineering:

`src/components/public/homepage-grid.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";

type GridImage = {
  id: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  altText: string | null;
  filename: string;
  gallerySlug: string | null;
};

// Deterministic span pattern matching the reference rhythm.
// Row sums: each row's col-spans add up to 12. Tiles cycle through this pattern.
const SPANS = [
  "col-span-3",      // tile 0
  "col-span-3",      // 1
  "col-span-3",      // 2
  "col-span-3",      // 3
  "col-span-2",      // 4
  "col-span-3",      // 5
  "col-span-2",      // 6
  "col-span-3",      // 7
  "col-span-2",      // 8
  "col-span-3",      // 9
  "col-span-3",      // 10
  "col-span-3",      // 11
];

export function HomepageGrid({ images }: { images: GridImage[] }) {
  if (images.length === 0) {
    return (
      <div className="pt-32 text-center text-gray-400 text-sm">
        No images yet — publish a gallery from the admin to see the homepage grid.
      </div>
    );
  }
  return (
    <div className="pt-20 px-3 max-w-7xl mx-auto">
      <div className="grid grid-cols-12 gap-2 auto-rows-[180px] md:auto-rows-[220px]">
        {images.map((img, i) => {
          const span = SPANS[i % SPANS.length];
          const tile = (
            <Image
              src={img.thumbnailUrl}
              alt={img.altText || img.filename}
              width={img.width}
              height={img.height}
              className="w-full h-full object-cover transition-opacity duration-300 hover:opacity-90"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          );
          return (
            <div key={img.id} className={`${span} relative overflow-hidden`}>
              {img.gallerySlug ? (
                <Link href={`/portfolio/${img.gallerySlug}`} className="block w-full h-full">
                  {tile}
                </Link>
              ) : (
                tile
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/public/homepage-grid.tsx
git commit -m "Add HomepageGrid component"
```

### Task 13: Replace homepage with grid

**Files:**
- Modify: `src/app/(public)/page.tsx` (full rewrite)
- Modify: `src/app/(public)/layout.tsx` (drop ConditionalFooter)

- [ ] **Step 1: Rewrite the page**

Overwrite `src/app/(public)/page.tsx`:

```tsx
export const dynamic = "force-dynamic";

import { getHomepageGridImages } from "@/lib/galleries";
import { HomepageGrid } from "@/components/public/homepage-grid";

export default async function HomePage() {
  const images = await getHomepageGridImages();
  return <HomepageGrid images={images} />;
}
```

- [ ] **Step 2: Always show the footer**

Read `src/app/(public)/layout.tsx`. Replace the `<ConditionalFooter />` (or whatever wrapper hides the footer on `/`) with a direct `<Footer />` import. Delete the `ConditionalFooter` import.

- [ ] **Step 3: Visual verification**

`mcp__chrome-devtools__navigate_page` to `/`. Take a screenshot. Compare to `~/Downloads/mindy-1.png` (the reference). The layout should be visually similar — varied tile sizes, light background, MINDY HU header, "Overview" underlined, footer at the bottom.

If tiles look too tall/short, adjust `auto-rows-[Npx]` in `homepage-grid.tsx` and re-screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(public\)/page.tsx src/app/\(public\)/layout.tsx
git commit -m "Replace homepage slideshow with randomized photo grid"
```

### Task 14: Delete unused homepage code

**Files:**
- Delete: `src/components/public/hero-slideshow.tsx`
- Delete: `src/components/public/conditional-footer.tsx`
- Modify: `src/lib/galleries.ts` (remove `getHeroImages`)

- [ ] **Step 1: Verify nothing imports the removed modules**

Run:
```bash
grep -r "hero-slideshow" src/
grep -r "ConditionalFooter" src/
grep -r "getHeroImages" src/
```
Expected: zero matches (after the changes above).

- [ ] **Step 2: Delete files and remove function**

```bash
rm src/components/public/hero-slideshow.tsx src/components/public/conditional-footer.tsx
```

In `src/lib/galleries.ts`, remove the `HERO_MIN_WIDTH`, `HERO_MAX_IMAGES`, and `getHeroImages` exports (lines 30-63 of the original file). Also drop the now-unused `gte` import from line 3 (`and` and `inArray` stay — they're used by the new functions).

- [ ] **Step 3: Verify type-check**

Run `pnpm tsc --noEmit` (project doesn't have a `typecheck` script — invoke `tsc` directly).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -u src/components/public src/lib/galleries.ts
git commit -m "Remove unused HeroSlideshow, ConditionalFooter, getHeroImages"
```

---

## Chunk 6: Contact page (about block + image upload)

### Task 15: Presigned-URL route for the about image

The about image bypasses the `images` table — it's a single asset on `siteSettings.aboutImageUrl`, not a portfolio photo. We don't want it polluting the "Unsorted" admin view.

**Files:**
- Create: `src/app/api/admin/settings/about-image/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { validateSession } from "@/lib/auth";
import { createPresignedUploadUrl, getCdnUrl } from "@/lib/s3";

export async function POST(request: Request) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { contentType?: string; ext?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { contentType, ext } = body;
  if (!contentType || !ext) {
    return Response.json(
      { error: "contentType and ext are required" },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9]{1,5}$/i.test(ext)) {
    return Response.json({ error: "Invalid extension" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const s3Key = `about/${id}.${ext}`;
  const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);
  const cdnUrl = getCdnUrl(s3Key);

  return Response.json({ uploadUrl, cdnUrl });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/settings/about-image/route.ts
git commit -m "Add presigned-URL endpoint for about-image upload"
```

### Task 16: AboutImageUploader component

**Files:**
- Create: `src/components/admin/about-image-uploader.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";

export function AboutImageUploader({
  initialUrl,
  onChange,
}: {
  initialUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const presignRes = await fetch("/api/admin/settings/about-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, ext }),
      });
      if (!presignRes.ok) throw new Error("Could not get upload URL");
      const { uploadUrl, cdnUrl } = await presignRes.json();

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");

      setPreview(cdnUrl);
      onChange(cdnUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">About Image</label>
      {preview && (
        <div className="mb-2 relative w-32 aspect-[3/4] bg-gray-100 overflow-hidden rounded">
          <Image src={preview} alt="About" fill className="object-cover" sizes="128px" />
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        className="text-sm"
      />
      {preview && (
        <button
          type="button"
          onClick={() => {
            setPreview(null);
            onChange(null);
          }}
          className="ml-3 text-xs text-gray-500 hover:text-red-600"
        >
          Remove
        </button>
      )}
      {uploading && <p className="text-xs text-gray-500 mt-1">Uploading…</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/about-image-uploader.tsx
git commit -m "Add AboutImageUploader admin component"
```

### Task 17: Wire AboutImageUploader into settings form

**Files:**
- Modify: `src/components/admin/settings-form.tsx`
- Modify: `src/app/admin/(authenticated)/settings/page.tsx` (verify it passes `aboutImageUrl` into `<SettingsForm>`)

- [ ] **Step 1: Extend SettingsData type and state**

In `src/components/admin/settings-form.tsx`:

Extend the type (line 6):
```ts
type SettingsData = {
  siteTitle: string;
  tagline: string;
  aboutText: string;
  aboutImageUrl: string | null;
  contactEmail: string;
  contactFormEnabled: number;
  socialLinks: string;
};
```

Add state (after line 23):
```ts
const [aboutImageUrl, setAboutImageUrl] = useState<string | null>(settings.aboutImageUrl);
```

In the PUT body (line 62-71), include:
```ts
aboutImageUrl,
```

- [ ] **Step 2: Render the uploader**

Import:
```tsx
import { AboutImageUploader } from "./about-image-uploader";
```

Add the uploader between the About Text textarea (ends line 145) and the Contact Email field (line 147):
```tsx
<AboutImageUploader initialUrl={aboutImageUrl} onChange={setAboutImageUrl} />
```

- [ ] **Step 3: Update the settings page to pass `aboutImageUrl`**

`src/app/admin/(authenticated)/settings/page.tsx` currently does NOT include `aboutImageUrl` in the props it forwards to `<SettingsForm>` (verified). Add it to the destructuring and the `settings={...}` prop object so the new field round-trips. The DB row already contains `aboutImageUrl` from the schema — just expose it.

- [ ] **Step 4: Manual verification**

Admin → Settings. Upload a small image. Confirm preview appears. Save. Reload the page. Confirm preview still shows (proving the URL persisted to DB).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings-form.tsx src/app/admin/\(authenticated\)/settings/page.tsx
git commit -m "Wire about-image upload into settings form"
```

### Task 18: Contact page redesign

**Files:**
- Modify: `src/app/(public)/contact/page.tsx` (full rewrite)

- [ ] **Step 1: Replace the page**

```tsx
export const dynamic = "force-dynamic";

import Image from "next/image";
import { getSettings } from "@/lib/settings";
import { ContactForm } from "@/components/public/contact-form";

export default async function ContactPage() {
  const settings = await getSettings();
  const aboutText = settings?.aboutText?.trim();
  const aboutImageUrl = settings?.aboutImageUrl ?? null;
  const contactEmail = settings?.contactEmail?.trim();

  return (
    <div className="min-h-screen pt-20 px-6">
      {(aboutText || aboutImageUrl || contactEmail) && (
        <section className="max-w-5xl mx-auto py-10 grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-8 md:gap-12 items-start">
          {aboutImageUrl ? (
            <div className="relative aspect-[3/4] w-full bg-gray-100 overflow-hidden">
              <Image
                src={aboutImageUrl}
                alt="Mindy Hu"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            </div>
          ) : (
            <div />
          )}
          <div className="text-sm text-gray-700 leading-7 space-y-4 md:pt-12">
            {aboutText && <p className="whitespace-pre-line">{aboutText}</p>}
            {contactEmail && (
              <p>
                For inquiries and rates, please contact{" "}
                <a href={`mailto:${contactEmail}`} className="underline text-gray-900">
                  {contactEmail}
                </a>
                .
              </p>
            )}
          </div>
        </section>
      )}

      {settings?.contactFormEnabled === 1 && (
        <section className="max-w-2xl mx-auto py-12 border-t border-gray-100">
          <h2 className="text-center font-heading text-xl text-gray-900 mb-8">
            Send a message
          </h2>
          <ContactForm />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Visual verification**

Visit `/contact`. With about text, image, and email all set, the layout should mirror `~/Downloads/mindy-2.png` (image left, bio right with the email link). The contact form (if enabled) sits below.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/contact/page.tsx
git commit -m "Redesign contact page with about image, bio, and email"
```

---

## Chunk 7: Gallery management UX

### Task 19: Delete gallery button

**Files:**
- Create: `src/components/admin/delete-gallery-button.tsx`
- Modify: `src/app/admin/(authenticated)/galleries/[id]/page.tsx`

- [ ] **Step 1: Implement the button**

`src/components/admin/delete-gallery-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteGalleryButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm(`Delete gallery "${title}"? Images will be moved to Unsorted.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/galleries/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      router.push("/admin/galleries");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 pt-8 border-t border-gray-200">
      <button
        onClick={handleDelete}
        disabled={busy}
        className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete gallery"}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Mount on the edit page**

In `src/app/admin/(authenticated)/galleries/[id]/page.tsx`, import and render at the bottom of the page (after the images grid section):

```tsx
import { DeleteGalleryButton } from "@/components/admin/delete-gallery-button";
// ...
<DeleteGalleryButton id={gallery.id} title={gallery.title} />
```

- [ ] **Step 3: Manual verification**

Create a throwaway gallery, add an image to it, click Delete, confirm. Verify: redirected to galleries list, gallery is gone, image now appears in `/admin/images` Unsorted.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/delete-gallery-button.tsx src/app/admin/\(authenticated\)/galleries/\[id\]/page.tsx
git commit -m "Add delete-gallery button to admin edit page"
```

### Task 20: Gallery image manager (set cover, remove, move)

**Files:**
- Create: `src/components/admin/gallery-image-manager.tsx`
- Modify: `src/app/admin/(authenticated)/galleries/[id]/page.tsx`

- [ ] **Step 1: Implement the manager**

`src/components/admin/gallery-image-manager.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type ImageRow = {
  id: string;
  thumbnailUrl: string;
  filename: string;
  altText: string | null;
};

type GalleryOption = { id: string; title: string };

export function GalleryImageManager({
  galleryId,
  images,
  coverImageId,
  otherGalleries,
}: {
  galleryId: string;
  images: ImageRow[];
  coverImageId: string | null;
  otherGalleries: GalleryOption[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setCover(imageId: string) {
    setBusyId(imageId);
    await fetch(`/api/admin/galleries/${galleryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverImageId: imageId }),
    });
    setBusyId(null);
    router.refresh();
  }

  async function clearCoverIfMatches(imageId: string) {
    if (coverImageId !== imageId) return;
    await fetch(`/api/admin/galleries/${galleryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverImageId: null }),
    });
  }

  async function removeFromGallery(imageId: string) {
    if (!confirm("Remove this image from the gallery? It will move to Unsorted.")) return;
    setBusyId(imageId);
    await clearCoverIfMatches(imageId);
    await fetch("/api/admin/images/assign", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: [imageId], galleryId: null }),
    });
    setBusyId(null);
    router.refresh();
  }

  async function moveTo(imageId: string, targetGalleryId: string) {
    if (!targetGalleryId) return;
    setBusyId(imageId);
    await clearCoverIfMatches(imageId);
    await fetch("/api/admin/images/assign", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: [imageId], galleryId: targetGalleryId }),
    });
    setBusyId(null);
    router.refresh();
  }

  if (images.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No images in this gallery. Upload images from the Images page and assign them here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {images.map((img) => (
        <div key={img.id} className="relative group">
          <div className="aspect-square relative rounded overflow-hidden bg-gray-100">
            <Image
              src={img.thumbnailUrl}
              alt={img.altText ?? img.filename}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            />
            {coverImageId === img.id && (
              <span className="absolute top-1 left-1 text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded">
                Cover
              </span>
            )}
            {busyId === img.id && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center text-xs">
                …
              </div>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
            {coverImageId !== img.id && (
              <button onClick={() => setCover(img.id)} className="text-gray-600 hover:text-gray-900">
                Set cover
              </button>
            )}
            <button
              onClick={() => removeFromGallery(img.id)}
              className="text-gray-600 hover:text-red-600"
            >
              Remove
            </button>
            {otherGalleries.length > 0 && (
              <select
                onChange={(e) => {
                  const v = e.target.value;
                  e.target.value = "";
                  if (v) moveTo(img.id, v);
                }}
                defaultValue=""
                className="text-xs border border-gray-200 rounded px-1 py-0.5"
              >
                <option value="">Move to…</option>
                {otherGalleries.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire into edit page**

In `src/app/admin/(authenticated)/galleries/[id]/page.tsx`:

Replace the existing `{galleryImages.length === 0 ? ... : <div className="grid ...">...</div>}` block (lines 49-75) with:

```tsx
<GalleryImageManager
  galleryId={gallery.id}
  coverImageId={gallery.coverImageId}
  images={galleryImages.map((img) => ({
    id: img.id,
    thumbnailUrl: img.thumbnailUrl,
    filename: img.filename,
    altText: img.altText,
  }))}
  otherGalleries={otherGalleries}
/>
```

Add the imports and the data fetch for other galleries (use `Promise.all` to keep it parallel with the existing queries):

```ts
import { GalleryImageManager } from "@/components/admin/gallery-image-manager";
// near the top of the function body, replace the two awaited calls with a Promise.all:

const [rows, galleryImages, otherGalleries] = await Promise.all([
  db.select().from(galleries).where(eq(galleries.id, id)).limit(1),
  db.select().from(images).where(eq(images.galleryId, id)).orderBy(asc(images.sortOrder)),
  db
    .select({ id: galleries.id, title: galleries.title })
    .from(galleries)
    .where(ne(galleries.id, id))
    .orderBy(asc(galleries.sortOrder)),
]);
```

Add the import for `ne`:
```ts
import { eq, asc, ne } from "drizzle-orm";
```

- [ ] **Step 3: Manual verification**

Open a gallery with several images. For each action:
- Click "Set cover" on a non-cover image → Cover badge moves.
- Click "Remove" on an image → image disappears from the grid; visit `/admin/images`, confirm it's in Unsorted.
- Use "Move to…" → image disappears here; open the destination gallery, confirm it's there.
- Visit the public category page after a cover change → cover image updated.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/gallery-image-manager.tsx src/app/admin/\(authenticated\)/galleries/\[id\]/page.tsx
git commit -m "Add per-image actions (set cover, remove, move) to gallery edit"
```

---

## Chunk 8: Cleanup + verification

### Task 21: Update e2e smoke test

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: Read the current smoke test**

Run `cat e2e/smoke.spec.ts` and review what it asserts. Likely it checks that `/`, `/portfolio`, `/contact` load with status 200. Update so:
- `/portfolio` is expected to redirect to `/`.
- `/people`, `/places`, `/prints` are added as smoke targets returning 200.
- The homepage assertion no longer expects `Hero` markup; instead asserts the nav contains "MINDY HU".

- [ ] **Step 2: Run the test**

Run: `pnpm exec playwright test e2e/smoke.spec.ts`
Expected: PASS (after edits).

- [ ] **Step 3: Commit**

```bash
git add e2e/smoke.spec.ts
git commit -m "Update smoke test for new homepage, nav, and category routes"
```

### Task 22: Final type-check, lint, and end-to-end verification

- [ ] **Step 1: Type-check the whole project**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS or only existing pre-task warnings.

- [ ] **Step 3: Full unit test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 4: E2E walkthrough via Chrome DevTools MCP**

For each scenario, navigate and screenshot via `mcp__chrome-devtools__navigate_page` and `mcp__chrome-devtools__take_screenshot`. Each should match expectation:

1. `/` — varied photo grid, randomized; nav with "MINDY HU" wordmark; "Overview" underlined; footer at bottom.
2. `/people` — heading "People"; only People-categorized published galleries appear.
3. `/places` — heading "Places"; same pattern.
4. `/prints` — heading "Prints"; same pattern.
5. `/portfolio` — redirects to `/`.
6. `/portfolio/<slug>` — gallery detail loads (still works).
7. `/contact` — about image left, bio + email right, contact form below if enabled.
8. Admin → unpublish a gallery → category page no longer shows it (no reload trick needed).
9. Admin → publish a new gallery → it appears immediately on its category page.
10. Admin → settings → upload about image, change about text → reflected on `/contact`.
11. Admin → gallery edit → delete button works; remove/move/set-cover all work.

- [ ] **Step 5: Final commit (if any cleanup needed)**

If the verification surfaced last-mile fixes (typos, color tweaks), commit them with a descriptive message. Otherwise skip.

---

## Out of scope (intentionally deferred)

- Drag-to-reorder images inside a gallery (Mindy didn't ask).
- Drag-to-reorder galleries within a category.
- Pagination on category pages (current scale doesn't need it).
- Backfilling existing galleries with categories — Mindy assigns them via the new dropdown when she next edits each.
- Showing "uncategorized" published galleries anywhere on the public site (Mindy has to pick a category for them to surface).
- An RSS/JSON feed of new galleries.
- Per-image alt-text editing UI.

---

## Risks and mitigations

- **Drizzle migration tooling unfamiliar in this repo** (no `db:migrate` script). Mitigation: in Task 3 Step 3, choose between `drizzle-kit migrate` (preferred, tracked migrations) and `drizzle-kit push` (direct schema sync), and confirm row count is preserved before/after.
- **About-image uploader bypasses the `images` table** — if Mindy ever wants to switch to a registered image, this won't surface in admin. Acceptable: about-image is a single asset, not part of the portfolio.
- **Homepage shuffle uses `Math.random()` server-side** — every hit recomputes the order, which is fine for a small site but means CDN caching must stay disabled (`force-dynamic` already enforces this).
- **`GalleryImageManager` uses `confirm()` and no toast on success** — keeps scope tight. If Mindy wants nicer feedback later, a separate task.

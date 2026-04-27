# Deep Clean Fixes Implementation Plan — 2026-04-26

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 60-finding deep-clean audit (3 Critical, 35 Important, 30 Minor) across architecture, security, performance, code quality, test quality, and data flow. The audit is in this conversation; finding IDs (C1, P3, S2, etc.) refer to that table.

**Architecture:** Sequential tasks, one commit per task. Tasks are ordered by dependency — migrations and shared utilities first, then consumers, then tests. Each commit must pass `pnpm exec tsc --noEmit && pnpm lint && pnpm test`.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM (libsql/Turso), React 19, Vitest, sharp 0.34, bcryptjs, AWS S3, Playwright

**Out of scope (deferred to audit "Not Addressed" section):** A3, A5, S3, S4, S7, P5, P8, P9, C12, C13, C15, C19, D4, D5, D6, T9, T10, T13, T14. See triage in conversation.

---

## File Structure

### New files

- `src/lib/api-helpers.ts` — `withAdminAuth(handler)` and `parseJsonBody(request)` for admin route handlers
- `src/lib/galleries-types.ts` — shared `Gallery`, `PublicGalleryImage`, `GalleryWithCover` types (or inline in existing `src/lib/galleries.ts` — see Task 3)
- `drizzle/0001_drop_category.sql` — migration dropping `galleries.category`
- `drizzle/0002_index_images_gallery_id.sql` — migration adding index on `images.gallery_id`
- `src/lib/__tests__/api-helpers.test.ts`
- `src/lib/__tests__/proxy.test.ts`
- `src/lib/__tests__/contact-actions.test.ts`
- `src/lib/__tests__/login-route.test.ts`

### Modified files

- `src/db/schema.ts` — drop `category`; declare `galleryIdIdx` on `images`
- `src/lib/images.ts` — read dimensions from rotated pipeline; collapse resize branches
- `src/lib/__tests__/images.test.ts` — add EXIF orientation test
- `src/lib/galleries.ts` — DB-side limit + sample for homepage; export shared types; add `getPublishedGalleryBySlugWithImages`
- `src/lib/__tests__/galleries.test.ts` — multi-gallery mapping; null-cover; empty-galleries
- `src/lib/auth.ts` — no signature change; export `SESSION_DURATION_MS` (used by tests if not already)
- `src/lib/__tests__/auth.test.ts` — `validateSession` tests
- `src/lib/settings.ts` — shape-validate `parseSocialLinks`; export `SOCIAL_LINK_PLATFORMS` const if used
- `src/lib/__tests__/settings.test.ts` — malformed-JSON cases
- `src/lib/email.ts` — lazy SES init to match S3 pattern
- `src/lib/s3.ts` — `createPresignedUploadUrl` accepts `maxBytes` parameter; expose `getOriginalBuffer(s3Key)` helper
- `src/lib/slugify.ts` — no change (canonical lives here)
- `src/db/client.ts` — add comment explaining lazy Proxy
- `src/proxy.ts` — minor: add comment about defense-in-depth split (A7)
- `src/app/layout.tsx` — pull metadata from settings via `getSettings()`
- `src/app/(public)/layout.tsx` — drop `force-dynamic` (inherited)
- `src/app/(public)/galleries/page.tsx` — drop `force-dynamic`
- `src/app/(public)/portfolio/[slug]/page.tsx` — drop `force-dynamic`; use lib helper + `PublicGalleryImage` projection
- `src/app/(public)/contact/page.tsx` — drop `force-dynamic`
- `src/app/(public)/contact/actions.ts` — lowercase email; allowlist `sessionType`; revalidate
- `src/app/(public)/portfolio/page.tsx` — DELETE (replaced by `next.config.ts` redirect)
- `next.config.ts` — add `redirects()` for `/portfolio` → `/`
- `src/app/api/admin/auth/login/route.ts` — rate limit, console.error on cleanup failure
- `src/app/api/admin/galleries/route.ts` — DELETE the unused PUT handler; refactor POST to `withAdminAuth`
- `src/app/api/admin/galleries/[id]/route.ts` — `slugify()` body.slug; revalidatePath; refactor to `withAdminAuth`
- `src/app/api/admin/galleries/[id]/images/route.ts` — DELETE entire file
- `src/app/api/admin/images/route.ts` — read original from S3 not CDN; revalidatePath; refactor to `withAdminAuth`
- `src/app/api/admin/images/assign/route.ts` — `db.batch()`; revalidatePath; refactor
- `src/app/api/admin/images/upload-url/route.ts` — pass `maxBytes` to presign; refactor
- `src/app/api/admin/messages/route.ts`, `messages/[id]/route.ts` — refactor to `withAdminAuth`
- `src/app/api/admin/settings/route.ts` — refactor to `withAdminAuth`; revalidatePath
- `src/app/api/admin/settings/about-image/route.ts` — content-type allowlist; refactor
- `src/components/admin/gallery-form.tsx` — remove local `slugify` (import from lib); make slug field reflect server behavior
- `src/components/admin/settings-form.tsx` — accept `socialLinks: SocialLink[]` (parsed server-side)
- `src/components/admin/gallery-image-manager.tsx` — wire `altText` editor
- `src/components/admin/delete-gallery-button.tsx` — drop layout wrapper from component
- `src/app/admin/(authenticated)/galleries/page.tsx` — wrap delete button in row layout
- `src/app/admin/(authenticated)/galleries/[id]/page.tsx` — wrap delete button in form-bottom layout; pass parsed socialLinks if applicable
- `src/app/admin/(authenticated)/settings/page.tsx` — parse socialLinks server-side
- `src/components/public/footer.tsx` — import `SocialLink` from lib
- `src/db/seed.ts` — import `SETTINGS_ID`
- `e2e/smoke.spec.ts` — tighten selectors

---

## Chunk 1: Foundation (Tasks 1–4)

These tasks create migrations, types, and helpers that later tasks depend on. Land them first.

### Task 1: Migration — drop `galleries.category` (C5)

**Files:**
- Modify: `src/db/schema.ts:35`
- Create: `drizzle/0001_drop_category.sql` (drizzle-kit will generate)

- [ ] **Step 1: Remove the column from schema**

In `src/db/schema.ts`, delete line 35 (`category: text("category"),`).

- [ ] **Step 2: Generate the migration**

```bash
pnpm exec drizzle-kit generate
```

Verify the generated SQL drops the column:
```sql
ALTER TABLE galleries DROP COLUMN category;
```

- [ ] **Step 3: Run typecheck and tests**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
```

Expected: PASS. (No code referenced `category` per the audit.)

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "Drop unused galleries.category column"
```

---

### Task 2: Migration — index on `images.gallery_id` (P2)

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0002_*.sql` (generated)

- [ ] **Step 1: Declare the index in schema**

Replace the `images` table declaration in `src/db/schema.ts` with:

```ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ...

export const images = sqliteTable(
  "images",
  {
    id: text("id").primaryKey(),
    galleryId: text("gallery_id").references(() => galleries.id),
    filename: text("filename").notNull(),
    s3Key: text("s3_key").notNull(),
    cdnUrl: text("cdn_url").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    galleryIdIdx: index("images_gallery_id_idx").on(table.galleryId, table.sortOrder),
  }),
);
```

- [ ] **Step 2: Generate migration & run quality gate**

```bash
pnpm exec drizzle-kit generate && pnpm exec tsc --noEmit && pnpm lint && pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "Index images.gallery_id (composite with sort_order)"
```

---

### Task 3: Shared Gallery types + PublicGalleryImage projection (D1, D3, A1 prep)

**Files:**
- Modify: `src/lib/galleries.ts`

- [ ] **Step 1: Add types and `getPublishedGalleryBySlugWithImages`**

Add to `src/lib/galleries.ts`:

```ts
import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";

export type Gallery = typeof galleries.$inferSelect;
export type Image = typeof images.$inferSelect;

export type GalleryWithCover = Gallery & { coverImage: Image | null };

export type PublicGalleryImage = {
  id: string;
  thumbnailUrl: string;
  cdnUrl: string;
  width: number;
  height: number;
  altText: string | null;
  filename: string;
};

export type HomepageGridImage = PublicGalleryImage & {
  gallerySlug: string | null;
};

function toPublicImage(img: Image): PublicGalleryImage {
  return {
    id: img.id,
    thumbnailUrl: img.thumbnailUrl,
    cdnUrl: img.cdnUrl,
    width: img.width,
    height: img.height,
    altText: img.altText,
    filename: img.filename,
  };
}

export async function getPublishedGalleryBySlugWithImages(
  slug: string,
): Promise<{ gallery: Gallery; images: PublicGalleryImage[] } | null> {
  const gallery = await db.query.galleries.findFirst({
    where: eq(galleries.slug, slug),
  });
  if (!gallery || !gallery.isPublished) return null;

  const galleryImages = await db.query.images.findMany({
    where: eq(images.galleryId, gallery.id),
    orderBy: asc(images.sortOrder),
  });

  return { gallery, images: galleryImages.map(toPublicImage) };
}
```

Then update existing `getPublishedGalleriesWithCovers` and `getHomepageGridImages` return types to reference `GalleryWithCover` and `HomepageGridImage` respectively (rename annotations only, no behavior change).

- [ ] **Step 2: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/galleries.ts
git commit -m "Add shared Gallery types and getPublishedGalleryBySlugWithImages helper"
```

---

### Task 4: Admin route helpers (`withAdminAuth`, `parseJsonBody`) (C9 setup)

**Files:**
- Create: `src/lib/api-helpers.ts`
- Create: `src/lib/__tests__/api-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/api-helpers.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { parseJsonBody, withAdminAuth } from "@/lib/api-helpers";

describe("parseJsonBody", () => {
  it("returns parsed object on valid JSON", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
      headers: { "content-type": "application/json" },
    });
    const result = await parseJsonBody<{ a: number }>(req);
    expect(result).toEqual({ ok: true, body: { a: 1 } });
  });

  it("returns error on invalid JSON", async () => {
    const req = new Request("http://x", { method: "POST", body: "not json" });
    const result = await parseJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });
});

describe("withAdminAuth", () => {
  it("returns 401 when validateSession returns null", async () => {
    vi.doMock("@/lib/auth", () => ({ validateSession: async () => null }));
    const { withAdminAuth } = await import("@/lib/api-helpers");
    const handler = withAdminAuth(async () => Response.json({ ok: true }));
    const res = await handler(new Request("http://x"));
    expect(res.status).toBe(401);
    vi.doUnmock("@/lib/auth");
  });

  it("calls handler with sessionId when authenticated", async () => {
    vi.doMock("@/lib/auth", () => ({ validateSession: async () => "sid-123" }));
    const { withAdminAuth } = await import("@/lib/api-helpers");
    const handler = withAdminAuth(async (_req, ctx) =>
      Response.json({ sid: ctx.sessionId }),
    );
    const res = await handler(new Request("http://x"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sid: "sid-123" });
    vi.doUnmock("@/lib/auth");
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm test src/lib/__tests__/api-helpers.test.ts`)

- [ ] **Step 3: Implement `src/lib/api-helpers.ts`**

```ts
import { validateSession } from "@/lib/auth";

export type ParseResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: Response };

export async function parseJsonBody<T>(request: Request): Promise<ParseResult<T>> {
  try {
    const body = (await request.json()) as T;
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid request body" }, { status: 400 }),
    };
  }
}

type AdminContext = { sessionId: string };
type RouteContext = { params: Promise<Record<string, string>> };

export function withAdminAuth<TParams extends Record<string, string> = Record<string, string>>(
  handler: (
    request: Request,
    ctx: AdminContext & { params?: Promise<TParams> },
  ) => Promise<Response>,
) {
  return async (request: Request, routeCtx?: { params: Promise<TParams> }) => {
    const sessionId = await validateSession(request);
    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(request, { sessionId, params: routeCtx?.params });
  };
}
```

- [ ] **Step 4: Run — expect PASS, run full quality gate, commit**

```bash
pnpm test src/lib/__tests__/api-helpers.test.ts
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/api-helpers.ts src/lib/__tests__/api-helpers.test.ts
git commit -m "Add withAdminAuth and parseJsonBody helpers for admin routes"
```

---

## Chunk 2: Critical fixes (Tasks 5–7)

User-visible correctness and accessibility issues. Land before any cosmetic refactors.

### Task 5: Fix EXIF rotation; collapse resize branches; add EXIF test (C1, C14, T8)

**Files:**
- Modify: `src/lib/images.ts`
- Modify: `src/lib/__tests__/images.test.ts`

- [ ] **Step 1: Add a failing EXIF orientation test**

Append to `src/lib/__tests__/images.test.ts`:

```ts
import sharp from "sharp";

it("returns post-rotation dimensions for EXIF orientation 6 (rotated 90° CW)", async () => {
  // Generate a 200x100 image with EXIF orientation 6 (visually 100x200 portrait)
  const buffer = await sharp({
    create: { width: 200, height: 100, channels: 3, background: "red" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();

  const result = await processImage(buffer);
  // After auto-rotate, the visible image is 100 wide × 200 tall
  expect(result.width).toBe(100);
  expect(result.height).toBe(200);
});
```

- [ ] **Step 2: Run — expect FAIL** (current code reports 200×100)

- [ ] **Step 3: Fix `src/lib/images.ts`**

Replace the body of `processImage`:

```ts
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  // sharp(...).rotate() with no args applies EXIF auto-orientation. Reading
  // metadata BEFORE pipeline ops returns input dimensions, which are wrong
  // for orientation 5/6/7/8. Use toBuffer({ resolveWithObject: true }) on
  // the rotated pipeline so info reflects post-rotation dimensions.
  const rotated = sharp(buffer).rotate();
  const { info: srcInfo } = await rotated
    .clone()
    .toBuffer({ resolveWithObject: true });

  const width = srcInfo.width;
  const height = srcInfo.height;

  const longEdge = Math.max(width, height);
  const needsResize = longEdge > THUMBNAIL_MAX_EDGE;

  let pipeline = sharp(buffer).rotate();
  if (needsResize) {
    pipeline = pipeline.resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const thumbnail = await pipeline
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  return { width, height, thumbnail };
}
```

- [ ] **Step 4: Run — expect PASS, full quality gate, commit**

```bash
pnpm test src/lib/__tests__/images.test.ts
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/images.ts src/lib/__tests__/images.test.ts
git commit -m "Fix EXIF-rotated images storing pre-rotation width/height"
```

---

### Task 6: Slugify deduplication + reconcile client/server slug behavior (C2)

The audit notes the client form's slug field is decorative because the server re-slugifies the title from scratch on POST. We'll align them: client imports the lib slugify, **and** the server PUT runs `slugify()` on incoming `body.slug` (also addresses S5).

**Files:**
- Modify: `src/components/admin/gallery-form.tsx`
- Modify: `src/app/api/admin/galleries/[id]/route.ts`

- [ ] **Step 1: Replace local `slugify` in gallery-form**

Delete lines 6–11 of `src/components/admin/gallery-form.tsx` (the local `slugify` function) and add at the top:

```ts
import { slugify } from "@/lib/slugify";
```

- [ ] **Step 2: Sanitize slug on PUT in `[id]/route.ts`**

In `src/app/api/admin/galleries/[id]/route.ts`, at the top:

```ts
import { slugify } from "@/lib/slugify";
```

Replace the slug uniqueness block (lines 42–54) with:

```ts
let normalizedSlug: string | undefined;
if (body.slug !== undefined) {
  normalizedSlug = slugify(body.slug);
  if (!normalizedSlug) {
    return Response.json(
      { error: "Slug cannot be empty after normalization" },
      { status: 400 },
    );
  }
  if (normalizedSlug !== existing[0].slug) {
    const slugConflict = await db
      .select({ id: galleries.id })
      .from(galleries)
      .where(eq(galleries.slug, normalizedSlug))
      .limit(1);
    if (slugConflict.length > 0) {
      return Response.json(
        { error: "A gallery with this slug already exists" },
        { status: 409 },
      );
    }
  }
}
```

And in the `updates` block:

```ts
if (normalizedSlug !== undefined) updates.slug = normalizedSlug;
```

(Replace the old `if (body.slug !== undefined) updates.slug = body.slug;` line.)

- [ ] **Step 3: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/components/admin/gallery-form.tsx src/app/api/admin/galleries/[id]/route.ts
git commit -m "Use canonical slugify in client form and sanitize PUT slug body"
```

---

### Task 7: altText admin UI + API write path (C7)

**Files:**
- Modify: `src/components/admin/gallery-image-manager.tsx`
- Create: `src/app/api/admin/images/[id]/route.ts` (PATCH endpoint)
- Modify: `src/app/admin/(authenticated)/galleries/[id]/page.tsx` (pass altText through)

- [ ] **Step 1: Add PATCH endpoint for image metadata**

Create `src/app/api/admin/images/[id]/route.ts`:

```ts
import { db } from "@/db/client";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";

export const PATCH = withAdminAuth(async (request, { params }) => {
  if (!params) return Response.json({ error: "Missing id" }, { status: 400 });
  const { id } = await params;

  const parsed = await parseJsonBody<{ altText?: string | null }>(request);
  if (!parsed.ok) return parsed.response;

  const existing = await db.select().from(images).where(eq(images.id, id)).limit(1);
  if (!existing[0]) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  const altText =
    parsed.body.altText === undefined
      ? existing[0].altText
      : parsed.body.altText?.trim() || null;

  await db.update(images).set({ altText }).where(eq(images.id, id));
  const rows = await db.select().from(images).where(eq(images.id, id)).limit(1);
  return Response.json(rows[0]);
});
```

- [ ] **Step 2: Wire altText editing into `GalleryImageManager`**

In `src/components/admin/gallery-image-manager.tsx`, add an inline-editable alt text field per image. Keep the change small — a single edit-on-click pattern:

Add to component state:
```ts
const [editingAltId, setEditingAltId] = useState<string | null>(null);
const [altDraft, setAltDraft] = useState("");

async function saveAlt(imageId: string) {
  setBusyId(imageId);
  await fetch(`/api/admin/images/${imageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ altText: altDraft }),
  });
  setEditingAltId(null);
  setBusyId(null);
  router.refresh();
}
```

In the per-image render block (around line 107 where buttons live), add:

```tsx
{editingAltId === img.id ? (
  <input
    autoFocus
    type="text"
    value={altDraft}
    onChange={(e) => setAltDraft(e.target.value)}
    onBlur={() => saveAlt(img.id)}
    onKeyDown={(e) => {
      if (e.key === "Enter") saveAlt(img.id);
      if (e.key === "Escape") setEditingAltId(null);
    }}
    className="text-xs border border-gray-300 rounded px-1 py-0.5 w-full"
    placeholder="Alt text"
  />
) : (
  <button
    onClick={() => {
      setAltDraft(img.altText ?? "");
      setEditingAltId(img.id);
    }}
    className="text-gray-600 hover:text-gray-900 truncate text-left"
    title={img.altText ?? "No alt text"}
  >
    {img.altText ? "✎ alt" : "+ alt"}
  </button>
)}
```

- [ ] **Step 3: Verify altText flows through to component prop**

Open `src/app/admin/(authenticated)/galleries/[id]/page.tsx` and confirm the images projected into `GalleryImageManager` already include `altText` (per `ImageRow` type). It should already.

- [ ] **Step 4: Manual smoke test**

```bash
pnpm dev
# Visit /admin/galleries/<some-id>, click "+ alt" on an image, type, hit Enter, refresh page, confirm persisted.
```

- [ ] **Step 5: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/api/admin/images/\[id\]/route.ts src/components/admin/gallery-image-manager.tsx
git commit -m "Add admin UI for image alt text"
```

---

## Chunk 3: Performance (Tasks 8–10)

### Task 8: DB-side homepage image cap (P1)

**Files:**
- Modify: `src/lib/galleries.ts`

- [ ] **Step 1: Replace `getHomepageGridImages`**

```ts
import { sql } from "drizzle-orm";

const HOMEPAGE_GRID_MAX = 12;
const HOMEPAGE_SAMPLE_SIZE = 60; // shuffle pool size

export async function getHomepageGridImages(): Promise<HomepageGridImage[]> {
  const publishedGalleries = await db.query.galleries.findMany({
    where: eq(galleries.isPublished, 1),
  });
  if (publishedGalleries.length === 0) return [];

  const galleryMap = new Map(publishedGalleries.map((g) => [g.id, g.slug]));
  const galleryIds = publishedGalleries.map((g) => g.id);

  // Sample at the DB layer instead of fetching every image.
  const sampled = await db
    .select()
    .from(images)
    .where(inArray(images.galleryId, galleryIds))
    .orderBy(sql`RANDOM()`)
    .limit(HOMEPAGE_SAMPLE_SIZE);

  // Shuffle the smaller sample (cheap) then slice.
  for (let i = sampled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sampled[i], sampled[j]] = [sampled[j], sampled[i]];
  }

  return sampled.slice(0, HOMEPAGE_GRID_MAX).map((img) => ({
    id: img.id,
    thumbnailUrl: img.thumbnailUrl,
    cdnUrl: img.cdnUrl,
    width: img.width,
    height: img.height,
    altText: img.altText,
    filename: img.filename,
    gallerySlug: img.galleryId ? galleryMap.get(img.galleryId) ?? null : null,
  }));
}
```

(Note: `RANDOM()` is the SQLite syntax — drizzle's `sql` template passes through. Verify in dev.)

- [ ] **Step 2: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/galleries.ts
git commit -m "Cap homepage image fetch at DB layer with ORDER BY RANDOM() LIMIT"
```

---

### Task 9: Drop `force-dynamic` from non-homepage public pages + revalidatePath in admin mutations (P3, P4)

**Files:**
- Modify: `src/app/(public)/galleries/page.tsx`
- Modify: `src/app/(public)/portfolio/[slug]/page.tsx`
- Modify: `src/app/(public)/contact/page.tsx`
- Modify: `src/app/api/admin/galleries/route.ts`
- Modify: `src/app/api/admin/galleries/[id]/route.ts`
- Modify: `src/app/api/admin/galleries/[id]/images/route.ts` (if not deleted yet — see Task 11)
- Modify: `src/app/api/admin/images/route.ts`
- Modify: `src/app/api/admin/images/assign/route.ts`
- Modify: `src/app/api/admin/images/[id]/route.ts` (from Task 7)
- Modify: `src/app/api/admin/settings/route.ts`
- Modify: `src/app/api/admin/settings/about-image/route.ts`

- [ ] **Step 1: Verify Next.js 16 revalidatePath API**

```bash
ls node_modules/next/dist/docs/01-app/03-api-reference/04-functions/ | grep -i revalidate
```

Read the `revalidatePath.md` doc to confirm signature (should still be `revalidatePath(path: string, type?: "page" | "layout")`).

- [ ] **Step 2: Replace `force-dynamic` lines**

In each of the three files (`galleries/page.tsx`, `portfolio/[slug]/page.tsx`, `contact/page.tsx`), remove `export const dynamic = "force-dynamic";` (the first line). Add nothing — these will become statically rendered at build time and revalidate when admin endpoints call `revalidatePath`.

For `portfolio/[slug]/page.tsx`, also add `generateStaticParams` so the per-slug routes are pre-rendered:

```ts
import { db } from "@/db/client";
import { galleries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function generateStaticParams() {
  const published = await db
    .select({ slug: galleries.slug })
    .from(galleries)
    .where(eq(galleries.isPublished, 1));
  return published.map((g) => ({ slug: g.slug }));
}
```

(Leave `force-dynamic` on `src/app/(public)/page.tsx` — homepage shuffle still needs it.)

- [ ] **Step 3: Add `revalidatePath` calls to mutating admin routes**

In every admin mutating handler, after successful DB mutation and before the `Response.json(...)`, add the relevant revalidations:

```ts
import { revalidatePath } from "next/cache";

// ... inside POST/PUT/DELETE/PATCH:
revalidatePath("/galleries");
revalidatePath("/portfolio/[slug]", "page");
```

For settings mutations, also revalidate `/contact`:
```ts
revalidatePath("/contact");
revalidatePath("/", "layout"); // settings affects the public layout footer
```

- [ ] **Step 4: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/\(public\)/ src/app/api/admin/
git commit -m "Drop force-dynamic from non-homepage public pages; revalidatePath in admin mutations"
```

---

### Task 10: Image registration reads from S3 directly (P6)

**Files:**
- Modify: `src/lib/s3.ts`
- Modify: `src/app/api/admin/images/route.ts`

- [ ] **Step 1: Add `getOriginalBuffer` helper to `src/lib/s3.ts`**

```ts
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function getObjectBuffer(s3Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
  });
  const response = await getClient().send(command);
  if (!response.Body) throw new Error(`No body for s3://${getBucket()}/${s3Key}`);
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

- [ ] **Step 2: Replace CloudFront fetch in `src/app/api/admin/images/route.ts`**

Replace lines 34–44 (the `fetch(cdnUrl)` block) with:

```ts
import { getCdnUrl, getThumbnailKey, uploadBuffer, deleteS3Object, getObjectBuffer } from "@/lib/s3";

// ...
const buffer = await getObjectBuffer(s3Key);
const { width, height, thumbnail } = await processImage(buffer);
const cdnUrl = getCdnUrl(s3Key);
```

- [ ] **Step 3: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/s3.ts src/app/api/admin/images/route.ts
git commit -m "Read uploaded original from S3 directly instead of CloudFront"
```

---

## Chunk 4: Dead code + metadata + admin refactor (Tasks 11–14)

### Task 11: Delete unused reorder routes (C3, C4)

**Files:**
- Modify: `src/app/api/admin/galleries/route.ts` — delete `PUT` handler (lines 63–96)
- Delete: `src/app/api/admin/galleries/[id]/images/route.ts`

- [ ] **Step 1: Verify no callers**

```bash
grep -r "PUT.*api/admin/galleries" src/ --include='*.ts' --include='*.tsx'
grep -r "/api/admin/galleries/.*/images" src/ --include='*.ts' --include='*.tsx'
```

Both should produce no client-side results (the route definitions themselves will match — that's expected).

- [ ] **Step 2: Delete the code**

```bash
git rm src/app/api/admin/galleries/\[id\]/images/route.ts
```

In `src/app/api/admin/galleries/route.ts`, delete the `PUT` export (lines 63–96).

- [ ] **Step 3: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/api/admin/galleries/
git commit -m "Remove unused gallery and image reorder PUT routes"
```

---

### Task 12: Wire `siteTitle`/`tagline` into root metadata (C6)

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/lib/settings.ts` (add a stable getter that handles missing settings row)

- [ ] **Step 1: Use `generateMetadata` in `src/app/layout.tsx`**

Verify Next.js 16 supports `generateMetadata` in the root layout (it does — confirm in `node_modules/next/dist/docs/01-app/.../metadata.md`).

Replace the static `metadata` export in `src/app/layout.tsx` with:

```ts
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = settings?.siteTitle?.trim() || "Mindy Hu Photography";
  const description = settings?.tagline?.trim() || "Portrait photography by Mindy Hu";
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}
```

(Keep any existing icon/font/etc. in the static metadata if needed — merge into the returned object.)

- [ ] **Step 2: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/layout.tsx
git commit -m "Pull root metadata from siteSettings"
```

---

### Task 13: Apply `withAdminAuth` + `parseJsonBody` to all admin routes (C9)

**Files:** all `src/app/api/admin/**/route.ts` except `auth/login/route.ts` (different shape) and any that already use the helpers (Task 7's `[id]/route.ts`).

- [ ] **Step 1: Refactor each handler**

Pattern — convert this:

```ts
export async function POST(request: Request) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { ... };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  // ... rest
}
```

Into:

```ts
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ ... }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  // ... rest
});
```

For routes with `params`:

```ts
export const PUT = withAdminAuth(async (request, { params }) => {
  if (!params) return Response.json({ error: "Missing id" }, { status: 400 });
  const { id } = await params;
  // ...
});
```

Files to convert (skip `auth/logout/route.ts` if it doesn't take a body):
- `galleries/route.ts` (POST only — PUT was deleted)
- `galleries/[id]/route.ts` (PUT, DELETE)
- `images/route.ts` (POST, DELETE)
- `images/assign/route.ts` (PUT)
- `images/upload-url/route.ts` (POST)
- `messages/route.ts` (GET — no body parse, but auth wrapper applies)
- `messages/[id]/route.ts` (PUT, DELETE)
- `settings/route.ts` (PUT)
- `settings/about-image/route.ts` (POST)
- `auth/logout/route.ts` (POST — keep or convert as appropriate)

- [ ] **Step 2: Quality gate & commit (single commit, all routes)**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/api/admin/
git commit -m "Refactor admin routes to use withAdminAuth and parseJsonBody"
```

---

### Task 14: Footer imports `SocialLink` from lib (C8)

**Files:**
- Modify: `src/components/public/footer.tsx`

- [ ] **Step 1: Replace local interface with import**

Delete the local `SocialLink` interface (lines 1–4) and replace with:

```ts
import type { SocialLink } from "@/lib/settings";
```

- [ ] **Step 2: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/components/public/footer.tsx
git commit -m "Footer imports SocialLink type from lib"
```

---

## Chunk 5: Security (Tasks 15–19)

### Task 15: about-image content-type allowlist (S1)

**Files:**
- Modify: `src/app/api/admin/settings/about-image/route.ts`

- [ ] **Step 1: Mirror the allowlist from `images/upload-url/route.ts`**

Replace the route body:

```ts
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";
import { getS3Key, createPresignedUploadUrl } from "@/lib/s3";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ contentType?: string }>(request);
  if (!parsed.ok) return parsed.response;
  const { contentType } = parsed.body;
  if (!contentType || !(contentType in ALLOWED_TYPES)) {
    return Response.json(
      { error: "Unsupported content type. Allowed: jpeg, png, webp" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const ext = ALLOWED_TYPES[contentType];
  const s3Key = `about/${id}.${ext}`;
  const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);
  return Response.json({ uploadUrl, s3Key });
});
```

(Verify the about-image upload client doesn't pass `ext` — adjust if it does.)

- [ ] **Step 2: Manual smoke** — try uploading an `image/jpeg`; try with `application/octet-stream` and confirm 400.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/settings/about-image/route.ts
git commit -m "Allowlist content types on about-image presign"
```

---

### Task 16: Login rate-limiting + login route tests (S2, T5)

**Files:**
- Modify: `src/app/api/admin/auth/login/route.ts`
- Create: `src/lib/__tests__/login-route.test.ts`

- [ ] **Step 1: Add an in-memory IP-based rate limiter to login**

```ts
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_MAX = 10;
const attempts = new Map<string, number[]>();

function recordAttempt(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - LOGIN_ATTEMPT_WINDOW_MS;
  const list = (attempts.get(ip) ?? []).filter((t) => t > windowStart);
  list.push(now);
  attempts.set(ip, list);
  return list.length <= LOGIN_ATTEMPT_MAX;
}

function getIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
```

In the `POST` handler, near the top:

```ts
const ip = getIp(request);
if (!recordAttempt(ip)) {
  return Response.json(
    { error: "Too many login attempts. Try again in 15 minutes." },
    { status: 429 },
  );
}
```

Also update the empty-`.catch` on session cleanup:

```ts
db.delete(sessions)
  .where(lt(sessions.expiresAt, new Date().toISOString()))
  .then(() => {})
  .catch((err) => console.error("Failed to clean expired sessions:", err));
```

- [ ] **Step 2: Add tests**

Create `src/lib/__tests__/login-route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/db/client", () => {
  const sessions: any[] = [];
  const adminUsers: any[] = [
    { id: "u1", email: "admin@x", passwordHash: "$2a$10$validhash" },
  ];
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => adminUsers,
          }),
        }),
      }),
      insert: () => ({ values: async (v: any) => sessions.push(v) }),
      delete: () => ({ where: () => Promise.resolve() }),
    },
  };
});

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async (pw: string) => pw === "correct") },
}));

describe("POST /api/admin/auth/login", () => {
  beforeEach(() => vi.resetModules());

  it("returns 400 on invalid JSON", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(new Request("http://x", { method: "POST", body: "junk" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when fields missing", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 on wrong password", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ email: "admin@x", password: "wrong" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 + Set-Cookie on success", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ email: "admin@x", password: "correct" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/admin_session=/);
  });

  it("returns 429 after 11 attempts from same IP", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const ip = "1.2.3.4";
    for (let i = 0; i < 10; i++) {
      await POST(
        new Request("http://x", {
          method: "POST",
          headers: { "x-forwarded-for": ip },
          body: JSON.stringify({ email: "admin@x", password: "wrong" }),
        }),
      );
    }
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({ email: "admin@x", password: "wrong" }),
      }),
    );
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 3: Quality gate & commit**

```bash
pnpm test src/lib/__tests__/login-route.test.ts
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/api/admin/auth/login/route.ts src/lib/__tests__/login-route.test.ts
git commit -m "Rate-limit login attempts; add login route tests"
```

---

### Task 17: Slug sanitize on PUT — DONE in Task 6

This finding (S5) is already addressed by Task 6's slugify normalization. No additional commit.

---

### Task 18: Presign content-length-range (S6)

S3 presigned PUT URLs cannot enforce content-length range without a presigned POST policy. Two options:

a. **Switch to presigned POST with policy** — significant client-side changes.
b. **Server-side size check on registration** — simpler.

We'll go with (b): the registration handler already reads the buffer (Task 10 reads from S3 directly). Add a size check there.

**Files:**
- Modify: `src/lib/s3.ts`
- Modify: `src/app/api/admin/images/route.ts`
- Modify: `src/app/api/admin/settings/about-image/route.ts` (if it has a registration flow)

- [ ] **Step 1: Define a size constant and check in `getObjectBuffer`**

In `src/lib/s3.ts`, add:

```ts
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB
```

Modify `getObjectBuffer` to use `HeadObjectCommand` first:

```ts
import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export async function getObjectBufferWithSizeCap(
  s3Key: string,
  maxBytes: number = MAX_UPLOAD_BYTES,
): Promise<Buffer> {
  const head = await getClient().send(
    new HeadObjectCommand({ Bucket: getBucket(), Key: s3Key }),
  );
  if ((head.ContentLength ?? 0) > maxBytes) {
    throw new Error(`Uploaded object exceeds ${maxBytes} bytes`);
  }
  return getObjectBuffer(s3Key);
}
```

- [ ] **Step 2: Use the capped variant in registration**

In `src/app/api/admin/images/route.ts`, replace `getObjectBuffer` with `getObjectBufferWithSizeCap`. Wrap in try/catch and return 413:

```ts
let buffer: Buffer;
try {
  buffer = await getObjectBufferWithSizeCap(s3Key);
} catch (err) {
  // delete the orphaned upload
  await deleteS3Object(s3Key).catch(() => {});
  return Response.json(
    { error: "Uploaded file exceeds size limit" },
    { status: 413 },
  );
}
```

- [ ] **Step 3: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/s3.ts src/app/api/admin/images/route.ts
git commit -m "Cap registered upload size at 30MB; reject and clean up oversized objects"
```

---

### Task 19: Lowercase email in rate-limit + sessionType allowlist + contact action tests (S8, S9, T4)

**Files:**
- Modify: `src/app/(public)/contact/actions.ts`
- Create: `src/lib/__tests__/contact-actions.test.ts`

- [ ] **Step 1: Update `submitContactForm`**

Add an allowlist constant at the top of `src/app/(public)/contact/actions.ts`:

```ts
const ALLOWED_SESSION_TYPES = new Set([
  // Mirror the <option> values in src/components/public/contact-form.tsx
  // — read that file and copy the exact set of values.
]);
```

(Read `src/components/public/contact-form.tsx` and populate the set with the actual `<option value="...">` strings.)

In the validation block, after the email regex check, add:

```ts
const normalizedEmail = email.trim().toLowerCase();
if (!ALLOWED_SESSION_TYPES.has(sessionType)) {
  return { error: "Please select a valid session type." };
}
```

Then replace every `email.trim()` reference below with `normalizedEmail`. The rate-limit lookup, the insert, and the email send should all use `normalizedEmail`.

- [ ] **Step 2: Add contact action tests**

Create `src/lib/__tests__/contact-actions.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const submissions: any[] = [];
vi.mock("@/db/client", () => ({
  db: {
    query: {
      siteSettings: {
        findFirst: async () => ({ contactFormEnabled: 1 }),
      },
    },
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ total: submissions.length }]),
      }),
    }),
    insert: () => ({ values: async (v: any) => submissions.push(v) }),
  },
}));

vi.mock("@/lib/email", () => ({
  sendContactNotification: vi.fn(),
}));

const validForm = (overrides: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set("name", "Jane");
  fd.set("email", "jane@example.com");
  fd.set("sessionType", "Family"); // adjust to a valid value
  fd.set("message", "Hello there.");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
};

describe("submitContactForm", () => {
  beforeEach(() => {
    submissions.length = 0;
  });

  it("rejects when contact form disabled", async () => {
    vi.doMock("@/db/client", () => ({
      db: {
        query: { siteSettings: { findFirst: async () => ({ contactFormEnabled: 0 }) } },
      },
    }));
    vi.resetModules();
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const result = await submitContactForm(validForm());
    expect(result).toEqual({ error: expect.stringMatching(/disabled/i) });
    vi.doUnmock("@/db/client");
  });

  it("rejects missing fields", async () => {
    vi.resetModules();
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const fd = validForm({ name: "" });
    const result = await submitContactForm(fd);
    expect(result.error).toBeDefined();
  });

  it("rejects invalid email", async () => {
    vi.resetModules();
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const result = await submitContactForm(validForm({ email: "not-an-email" }));
    expect(result.error).toMatch(/email/i);
  });

  it("rejects sessionType not in allowlist", async () => {
    vi.resetModules();
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const result = await submitContactForm(validForm({ sessionType: "evil" }));
    expect(result.error).toMatch(/session/i);
  });

  it("normalizes email casing before insert", async () => {
    vi.resetModules();
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    await submitContactForm(validForm({ email: "JANE@Example.com" }));
    expect(submissions[0].email).toBe("jane@example.com");
  });
});
```

(Ratelimit boundary test requires more elaborate mocking — flag as a follow-up if it gets hairy; the case-bypass and validation tests above are the primary T4 coverage.)

- [ ] **Step 3: Quality gate & commit**

```bash
pnpm test src/lib/__tests__/contact-actions.test.ts
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/\(public\)/contact/actions.ts src/lib/__tests__/contact-actions.test.ts
git commit -m "Lowercase contact email; allowlist sessionType; add action tests"
```

---

## Chunk 6: Data flow (Tasks 20–21)

### Task 20: Server-side parse socialLinks; shape-validate parser (D2, T1)

**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/__tests__/settings.test.ts`
- Modify: `src/components/admin/settings-form.tsx`
- Modify: `src/app/admin/(authenticated)/settings/page.tsx`

- [ ] **Step 1: Add malformed-JSON tests**

Append to `src/lib/__tests__/settings.test.ts`:

```ts
it("returns [] for non-array JSON like a number", () => {
  expect(parseSocialLinks("42")).toEqual([]);
});

it("returns [] for a JSON string scalar", () => {
  expect(parseSocialLinks('"hello"')).toEqual([]);
});

it("returns [] for null literal", () => {
  expect(parseSocialLinks("null")).toEqual([]);
});

it("filters out items missing platform or url", () => {
  expect(
    parseSocialLinks(
      JSON.stringify([
        { platform: "instagram", url: "https://x" },
        { platform: "twitter" }, // missing url
        { url: "https://y" }, // missing platform
        "string", // not an object
      ]),
    ),
  ).toEqual([{ platform: "instagram", url: "https://x" }]);
});
```

- [ ] **Step 2: Implement shape-validating parser**

Replace `parseSocialLinks` in `src/lib/settings.ts`:

```ts
export function parseSocialLinks(raw: string | null | undefined): SocialLink[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is SocialLink =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { platform?: unknown }).platform === "string" &&
      typeof (item as { url?: unknown }).url === "string" &&
      (item as { platform: string }).platform.length > 0 &&
      (item as { url: string }).url.length > 0,
  );
}
```

- [ ] **Step 3: Move parsing server-side**

In `src/app/admin/(authenticated)/settings/page.tsx`, import `parseSocialLinks`, parse, and pass `SocialLink[]` to the form:

```tsx
import { getSettings, parseSocialLinks } from "@/lib/settings";

export default async function SettingsPage() {
  const settings = await getSettings();
  if (!settings) /* render empty state */;
  const socialLinks = parseSocialLinks(settings.socialLinks);
  return <SettingsForm settings={settings} socialLinks={socialLinks} />;
}
```

In `src/components/admin/settings-form.tsx`:
- Remove the `import { parseSocialLinks, type SocialLink } from "@/lib/settings"` and replace with:
  ```ts
  import type { SocialLink } from "@/lib/settings";
  ```
  (The import becomes type-only; tree-shaker can fully strip the server-only DB code path even before the import.)
- Add `socialLinks: SocialLink[]` to component props
- Replace the `useState(parseSocialLinks(settings.socialLinks))` with `useState<SocialLink[]>(props.socialLinks)`
- Remove `socialLinks` from the `SettingsData` type (or leave it as the raw string for round-trip; verify how the form's serialized PUT body works)

- [ ] **Step 4: Quality gate & commit**

```bash
pnpm test src/lib/__tests__/settings.test.ts
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/settings.ts src/lib/__tests__/settings.test.ts src/components/admin/settings-form.tsx src/app/admin/\(authenticated\)/settings/page.tsx
git commit -m "Shape-validate parseSocialLinks; parse server-side; pass SocialLink[] prop"
```

---

### Task 21: Use `PublicGalleryImage` projection in portfolio page; route through lib (D3, A1)

**Files:**
- Modify: `src/app/(public)/portfolio/[slug]/page.tsx`
- Modify: `src/components/public/gallery-grid.tsx` (tighten prop type)
- Modify: `src/components/public/lightbox.tsx` (tighten prop type)

- [ ] **Step 1: Replace direct DB calls with `getPublishedGalleryBySlugWithImages`**

In `src/app/(public)/portfolio/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getPublishedGalleryBySlugWithImages } from "@/lib/galleries";
import { GalleryGrid } from "@/components/public/gallery-grid";

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublishedGalleryBySlugWithImages(slug);
  if (!result) notFound();
  const { gallery, images: galleryImages } = result;

  return (
    <div className="min-h-screen">
      <div className="pt-28 px-6">
        <div className="text-center mb-10">
          <h1 className="font-heading text-2xl text-gray-900">{gallery.title}</h1>
          {gallery.description && (
            <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">{gallery.description}</p>
          )}
        </div>
        <div className="max-w-6xl mx-auto">
          <GalleryGrid images={galleryImages} />
        </div>
      </div>
    </div>
  );
}
```

(Move `generateStaticParams` to use the same lib function or keep the simple slug query — fine either way.)

- [ ] **Step 2: Tighten `GalleryGrid` and `Lightbox` prop types**

Replace any local `Image`-like type in `src/components/public/gallery-grid.tsx` and `lightbox.tsx` with:

```ts
import type { PublicGalleryImage } from "@/lib/galleries";

// props.images: PublicGalleryImage[]
```

The lightbox already only reads `cdnUrl`, `width`, `height`, `altText`, `filename` — all present in `PublicGalleryImage`.

- [ ] **Step 3: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/\(public\)/portfolio/\[slug\]/page.tsx src/components/public/gallery-grid.tsx src/components/public/lightbox.tsx
git commit -m "Route portfolio page through lib helper with PublicGalleryImage projection"
```

---

## Chunk 7: Tests (Tasks 22–25)

### Task 22: `validateSession` tests (T2)

**Files:**
- Modify: `src/lib/__tests__/auth.test.ts`

- [ ] **Step 1: Add `validateSession` tests with mocked `db`**

Append:

```ts
describe("validateSession", () => {
  beforeEach(() => vi.resetModules());

  it("returns null when no cookie header", async () => {
    const { validateSession } = await import("@/lib/auth");
    const sid = await validateSession({ headers: { get: () => null } });
    expect(sid).toBeNull();
  });

  it("returns null when cookie has no session id", async () => {
    const { validateSession } = await import("@/lib/auth");
    const sid = await validateSession({
      headers: { get: () => "other=value" },
    });
    expect(sid).toBeNull();
  });

  it("returns null and deletes session when expired", async () => {
    const deleted: string[] = [];
    vi.doMock("@/db/client", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "sid-1",
                  adminUserId: "u1",
                  expiresAt: new Date(Date.now() - 1000).toISOString(),
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
          }),
        }),
        delete: () => ({
          where: async () => {
            deleted.push("sid-1");
          },
        }),
        update: () => ({ set: () => ({ where: async () => {} }) }),
      },
    }));
    const { validateSession } = await import("@/lib/auth");
    const sid = await validateSession({
      headers: { get: () => "admin_session=sid-1" },
    });
    expect(sid).toBeNull();
    expect(deleted).toContain("sid-1");
    vi.doUnmock("@/db/client");
  });

  it("returns sessionId and refreshes expiry on valid session", async () => {
    let updated = false;
    vi.doMock("@/db/client", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "sid-1",
                  adminUserId: "u1",
                  expiresAt: new Date(Date.now() + 60_000).toISOString(),
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: async () => {
              updated = true;
            },
          }),
        }),
        delete: () => ({ where: async () => {} }),
      },
    }));
    const { validateSession } = await import("@/lib/auth");
    const sid = await validateSession({
      headers: { get: () => "admin_session=sid-1" },
    });
    expect(sid).toBe("sid-1");
    expect(updated).toBe(true);
    vi.doUnmock("@/db/client");
  });
});
```

- [ ] **Step 2: Quality gate & commit**

```bash
pnpm test src/lib/__tests__/auth.test.ts
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/__tests__/auth.test.ts
git commit -m "Cover validateSession (expiry, refresh, deletion)"
```

---

### Task 23: `proxy.ts` tests (T3)

**Files:**
- Create: `src/lib/__tests__/proxy.test.ts`

- [ ] **Step 1: Write tests against the exported `proxy` function**

```ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function makeRequest(pathname: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(new URL(`http://localhost${pathname}`), { headers });
}

describe("proxy", () => {
  it("allows /admin/login without auth", () => {
    const res = proxy(makeRequest("/admin/login"));
    expect(res.status).toBe(200); // NextResponse.next()
  });

  it("allows /api/admin/auth/login without auth", () => {
    const res = proxy(makeRequest("/api/admin/auth/login"));
    expect(res.status).toBe(200);
  });

  it("returns 401 JSON on /api/admin/* without session cookie", async () => {
    const res = proxy(makeRequest("/api/admin/galleries"));
    expect(res.status).toBe(401);
    const body = await (res as Response).json();
    expect(body.error).toMatch(/auth/i);
  });

  it("redirects to /admin/login on /admin/* without session cookie", () => {
    const res = proxy(makeRequest("/admin/galleries"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/admin\/login$/);
  });

  it("allows authenticated /admin/* through", () => {
    const res = proxy(makeRequest("/admin/galleries", "admin_session=sid-x"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Quality gate & commit**

```bash
pnpm test src/lib/__tests__/proxy.test.ts
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/__tests__/proxy.test.ts
git commit -m "Cover proxy auth routing branches"
```

---

### Task 24: Improve `galleries.ts` lib tests (T6, T7)

**Files:**
- Modify: `src/lib/__tests__/galleries.test.ts`

- [ ] **Step 1: Replace single-gallery test with multi-gallery mapping**

Restructure existing tests to use 3 galleries, each with 2-4 images, and assert that returned `gallerySlug` matches the source gallery for each image (not always the same slug).

```ts
it("maps each image's gallerySlug from its galleryId, not from the first gallery", async () => {
  // In your mock setup: 3 galleries (g1, g2, g3) with slugs "a", "b", "c"
  // and images split across them.
  const images = await getHomepageGridImages();
  // Group results by gallerySlug; ensure every distinct source slug appears
  const slugs = new Set(images.map((i) => i.gallerySlug));
  expect(slugs.size).toBeGreaterThan(1);
});
```

- [ ] **Step 2: Add `getPublishedGalleriesWithCovers` tests**

```ts
describe("getPublishedGalleriesWithCovers", () => {
  it("returns [] when no published galleries exist", async () => {
    // mock empty db
    expect(await getPublishedGalleriesWithCovers()).toEqual([]);
  });

  it("returns coverImage: null for galleries with no coverImageId", async () => {
    // mock 1 published gallery with coverImageId === null
    const result = await getPublishedGalleriesWithCovers();
    expect(result[0].coverImage).toBeNull();
  });

  it("attaches the matching cover image when present", async () => {
    // mock 1 published gallery + matching image row
    const result = await getPublishedGalleriesWithCovers();
    expect(result[0].coverImage?.id).toBe("img-1");
  });
});
```

- [ ] **Step 3: Quality gate & commit**

```bash
pnpm test src/lib/__tests__/galleries.test.ts
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/__tests__/galleries.test.ts
git commit -m "Strengthen galleries lib tests (multi-gallery mapping; cover attachment)"
```

---

### Task 25: Tighten e2e selectors (T11, T12)

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: Replace generic selectors with role-based assertions**

```ts
// /contact
await expect(page.getByRole("heading", { name: /get in touch|contact/i })).toBeVisible();

// /galleries — assert gallery list landmark or heading
await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
```

- [ ] **Step 2: Run e2e (if Playwright is set up locally)**

```bash
pnpm exec playwright test
```

- [ ] **Step 3: Commit**

```bash
git add e2e/smoke.spec.ts
git commit -m "Tighten e2e selectors for /contact and /galleries"
```

---

## Chunk 8: Consistency cleanups (Tasks 26–30)

### Task 26: DeleteGalleryButton layout extraction (A2)

**Files:**
- Modify: `src/components/admin/delete-gallery-button.tsx`
- Modify: `src/app/admin/(authenticated)/galleries/[id]/page.tsx`
- Modify: `src/app/admin/(authenticated)/galleries/page.tsx`

- [ ] **Step 1: Remove the `<div>` wrapper from the component**

In `src/components/admin/delete-gallery-button.tsx`, replace `<div className="mt-12 pt-8 border-t border-gray-200">...</div>` with the bare button.

- [ ] **Step 2: Add the wrapper back at the form-bottom call site**

In `src/app/admin/(authenticated)/galleries/[id]/page.tsx`, wrap `<DeleteGalleryButton ... />` with the `<div className="mt-12 pt-8 border-t border-gray-200">`.

- [ ] **Step 3: Verify the list-row call site looks correct**

In `src/app/admin/(authenticated)/galleries/page.tsx`, the button should now render inline without divider.

- [ ] **Step 4: Manual smoke + commit**

```bash
pnpm dev
# Visit /admin/galleries — confirm row layout looks correct
# Visit /admin/galleries/<id> — confirm form-bottom layout looks correct
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/components/admin/delete-gallery-button.tsx src/app/admin/
git commit -m "Move DeleteGalleryButton spacing/divider to call sites"
```

---

### Task 27: `/portfolio` redirect via `next.config.ts` (A4)

**Files:**
- Modify: `next.config.ts`
- Delete: `src/app/(public)/portfolio/page.tsx`

- [ ] **Step 1: Add a `redirects()` block to `next.config.ts`**

```ts
async redirects() {
  return [
    { source: "/portfolio", destination: "/", permanent: false },
  ];
},
```

(Verify against `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md`.)

- [ ] **Step 2: Delete the redirect page**

```bash
git rm src/app/\(public\)/portfolio/page.tsx
```

- [ ] **Step 3: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add next.config.ts src/app/\(public\)/portfolio/
git commit -m "Move /portfolio redirect to next.config and delete redirect page"
```

---

### Task 28: SES lazy init match S3 (A6)

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Wrap SES client creation in lazy getter**

Mirror the pattern from `src/lib/s3.ts:8-23`:

```ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

let _client: SESClient | null = null;

function getClient(): SESClient {
  if (!_client) {
    _client = new SESClient({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}
```

Replace any module-level `new SESClient(...)` usage with `getClient()`.

- [ ] **Step 2: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/lib/email.ts
git commit -m "Lazy-init SES client to match S3 pattern"
```

---

### Task 29: `db.batch()` for bulk image-assign (P7)

**Files:**
- Modify: `src/app/api/admin/images/assign/route.ts`

- [ ] **Step 1: Replace `Promise.all` with `db.batch`**

```ts
import { db } from "@/db/client";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";

export const PUT = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ imageIds?: string[]; galleryId?: string | null }>(request);
  if (!parsed.ok) return parsed.response;
  const { imageIds, galleryId } = parsed.body;
  if (!imageIds || !Array.isArray(imageIds)) {
    return Response.json({ error: "imageIds array is required" }, { status: 400 });
  }
  if (imageIds.length === 0) {
    return Response.json({ success: true });
  }

  // Drizzle batch (libsql supports this)
  const stmts = imageIds.map((id) =>
    db.update(images).set({ galleryId: galleryId ?? null }).where(eq(images.id, id)),
  );
  await db.batch(stmts as [typeof stmts[number], ...typeof stmts]);

  return Response.json({ success: true });
});
```

(If `db.batch` types are awkward, fall back to a single `UPDATE images SET gallery_id = ? WHERE id IN (?, ?, ...)` via `inArray`.)

- [ ] **Step 2: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/api/admin/images/assign/route.ts
git commit -m "Use db.batch for bulk image gallery assignment"
```

---

### Task 30: Misc small cleanups (C10, C11, C16, C17, C18, C20, A7)

**Files:** various

- [ ] **Step 1: Add comment on `db` lazy Proxy (C10)**

Above the Proxy block in `src/db/client.ts:20`:

```ts
// db is exported as a Proxy that lazy-initializes on first property access.
// This is required so that build-time imports (e.g. type-only or schema gen)
// don't crash when TURSO_DATABASE_URL is unset. Do NOT replace with a
// top-level `await initDb()` — it will break `next build`.
```

- [ ] **Step 2: C11 already addressed in Task 16** (login route's empty `.catch` was replaced).

- [ ] **Step 3: Surface admin client errors (C16)**

In `src/components/admin/image-grid.tsx` (around lines 52–56), `src/components/admin/message-list.tsx` (around 28–37), and similar admin clients, replace silent `if (res.ok) router.refresh()` patterns with:

```ts
if (!res.ok) {
  const data = await res.json().catch(() => ({}));
  alert(data.error ?? "Operation failed.");
  return;
}
router.refresh();
```

(`alert()` is fine for a single-admin tool; consistent with other surfaces in this app.)

- [ ] **Step 4: Remove dead blank lines (C17)**

In `src/components/admin/gallery-form.tsx`, collapse the 3-line gaps around lines 124 and 143 to single blank lines.

- [ ] **Step 5: Import `SETTINGS_ID` in seed (C18)**

In `src/db/seed.ts:28`, replace literal `"default"` with:

```ts
import { SETTINGS_ID } from "@/lib/settings";
// ...
id: SETTINGS_ID,
```

- [ ] **Step 6: Apply `?.trim()` to aboutText consistently (C20)**

Decide one canonical place to trim — at write time in the settings PUT route is best. In `src/app/api/admin/settings/route.ts`, when updating `aboutText`:

```ts
if (body.aboutText !== undefined) updates.aboutText = body.aboutText.trim();
```

Then remove the `?.trim()` from `src/app/(public)/contact/page.tsx:9`.

- [ ] **Step 7: Defense-in-depth comment in proxy (A7)**

At the top of `src/proxy.ts:5` (above the function):

```ts
// Cookie presence only — full session validation (DB lookup + expiry refresh)
// happens in admin route handlers via validateSession from @/lib/auth.
// This proxy is the first line of defense; the per-route check is the second.
```

- [ ] **Step 8: Quality gate & commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/db/client.ts src/components/admin/ src/db/seed.ts src/app/api/admin/settings/route.ts src/app/\(public\)/contact/page.tsx src/proxy.ts
git commit -m "Misc: db Proxy comment, surface admin errors, SETTINGS_ID import, aboutText trim, proxy doc"
```

---

## Final verification

After all 30 tasks land:

- [ ] **Run full quality gate**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
```

- [ ] **Run e2e (if Playwright is available)**

```bash
pnpm exec playwright test
```

- [ ] **Manual smoke — public site**

```bash
pnpm dev
# Visit /
# Visit /galleries
# Visit /portfolio/<published-slug>
# Visit /contact
# Submit a contact form (verify success + duplicate-email rate limit)
```

- [ ] **Manual smoke — admin**

```
/admin/login → log in
/admin/galleries → list, click into one
  - edit slug, save, verify normalization
  - set cover, remove image, set alt text
/admin/images → upload a portrait phone photo (with EXIF orientation), verify width/height match rendered aspect
/admin/messages → view, mark read
/admin/settings → edit siteTitle, save, verify root metadata updates
```

- [ ] **Write the audit report** at `docs/audits/2026-04-26-deep-clean.md` per the deep-clean skill template.

---

## Notes for the implementer

- Drizzle migrations: this project uses Turso. Generated migrations land in `drizzle/` but there's no script to apply them — `drizzle-kit push` or a manual SQL run against Turso is needed before deploying. Confirm with the user how migrations are applied in their environment.
- Some tasks (T9 admin route unit tests) were deferred — see "Out of scope" at the top.
- If Task 18's `db.batch` types are unusable with the libsql driver in Drizzle 0.45, fall back to the single-UPDATE `inArray` form noted in that task.
- If any task fails its quality gate, **do not** amend the prior commit — fix forward as a new commit. Per the project's CLAUDE.md.

# Deep Clean Fixes (2026-06-12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute tasks **sequentially in the main repo** on branch `deep-clean-3` — no worktree isolation.

**Goal:** Fix the 2 critical and 15 important findings (plus cheap consistency/dead-code minors) from the 2026-06-12 deep-clean audit of mindy-hu-photography.

**Architecture:** Next.js 16.2 App Router photography portfolio. Public pages read through `src/lib/galleries.ts` / `src/lib/settings.ts`; admin API routes under `src/app/api/admin/` are wrapped by `withAdminAuth`; Drizzle ORM over Turso/libsql; S3 originals + generated renditions served via CloudFront; SES contact notifications. This plan adds a mid-size "display" rendition for the lightbox, makes the assign route own the cover-image invariant, replaces the in-memory login rate limiter with a DB-backed one, and consolidates several duplicated constants/patterns.

**Tech Stack:** TypeScript, Next.js 16.2, Drizzle ORM + drizzle-kit, sharp, vitest, Playwright, pnpm.

---

## Conventions for every task

- **Quality gate** after each task (this is also the husky pre-commit hook, so a commit will not succeed unless it passes):
  ```bash
  pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm lint:knip
  ```
- **Commits:** one commit per task, `git -C /Users/arpanet/dev/mindy-hu-photography ...` for every git command (never `cd && git`). If pnpm aborts with a no-TTY error, prefix the command with `CI=true`.
- **Commit message trailer:** `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- **Next.js 16 caveat (from AGENTS.md):** this Next version has breaking changes. Before using an `<Image>` prop, verify it in `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`. Known relevant facts: `priority` is **deprecated** in favor of `preload`; `fetchPriority` is a supported prop; images default to `loading="lazy"`.
- **Drizzle migrations:** generate with `pnpm exec drizzle-kit generate`. If it complains about a missing `TURSO_DATABASE_URL`, run with a dummy value: `TURSO_DATABASE_URL=libsql://placeholder.turso.io pnpm exec drizzle-kit generate`. Do NOT run `drizzle-kit push` (no production DB access in this sandbox — applying migrations is a deploy-time step, recorded in the audit report).

---

### Task 1: Shared image MIME-type constants

The accepted-image-type list exists in three files with three shapes. Centralize it.

**Files:**
- Create: `src/lib/image-types.ts`
- Modify: `src/app/api/admin/images/upload-url/route.ts`
- Modify: `src/app/api/admin/settings/about-image/route.ts`
- Modify: `src/components/admin/image-uploader.tsx`

- [ ] **Step 1: Create the shared constants module**

```ts
// src/lib/image-types.ts
export const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/tiff": "tiff",
};

export const ACCEPTED_IMAGE_TYPES = Object.keys(IMAGE_EXT_BY_TYPE);
```

- [ ] **Step 2: Use it in the upload-url route**

Replace the `ALLOWED_TYPES` Set and `EXT_MAP` Record (lines 4–16) in `src/app/api/admin/images/upload-url/route.ts`:

```ts
import { getS3Key, createPresignedUploadUrl } from "@/lib/s3";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";
import { IMAGE_EXT_BY_TYPE } from "@/lib/image-types";

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ filename?: string; contentType?: string }>(request);
  if (!parsed.ok) return parsed.response;

  const { filename, contentType } = parsed.body;
  if (!filename || !contentType) {
    return Response.json(
      { error: "filename and contentType are required" },
      { status: 400 },
    );
  }

  const ext = contentType ? IMAGE_EXT_BY_TYPE[contentType] : undefined;
  if (!ext) {
    return Response.json(
      { error: "Unsupported content type. Allowed: jpeg, png, webp, tiff" },
      { status: 400 },
    );
  }

  const imageId = crypto.randomUUID();
  const s3Key = getS3Key(imageId, ext);
  const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);

  return Response.json({ uploadUrl, imageId, s3Key, ext });
});
```

- [ ] **Step 3: Use it in the about-image route**

The about page renders the image in a browser, so TIFF stays excluded. Replace the local `ALLOWED_TYPES` (lines 4–8) in `src/app/api/admin/settings/about-image/route.ts`:

```ts
import { createPresignedUploadUrl, getCdnUrl } from "@/lib/s3";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";
import { IMAGE_EXT_BY_TYPE } from "@/lib/image-types";

// TIFF is excluded: the about image is rendered directly by browsers.
const BROWSER_RENDERABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ contentType?: string }>(request);
  if (!parsed.ok) return parsed.response;

  const { contentType } = parsed.body;
  if (!contentType || !BROWSER_RENDERABLE.has(contentType)) {
    return Response.json(
      { error: "Unsupported content type. Allowed: jpeg, png, webp" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const ext = IMAGE_EXT_BY_TYPE[contentType];
  const s3Key = `about/${id}.${ext}`;
  const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);
  const cdnUrl = getCdnUrl(s3Key);

  return Response.json({ uploadUrl, cdnUrl });
});
```

- [ ] **Step 4: Use it in the client uploader**

In `src/components/admin/image-uploader.tsx`, replace the `ACCEPTED_TYPES` Set (lines 13–18) with:

```ts
import { ACCEPTED_IMAGE_TYPES } from "@/lib/image-types";

const ACCEPTED_TYPES = new Set(ACCEPTED_IMAGE_TYPES);
```

and replace the hardcoded `accept` attribute (line 185):

```tsx
accept={ACCEPTED_IMAGE_TYPES.join(",")}
```

- [ ] **Step 5: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Centralize accepted image MIME types in one lib constant"
```

---

### Task 2: Distinguish size-cap failures from other S3 errors (Critical #1)

Today any S3 read failure during image registration returns 413 "exceeds size limit" and deletes the uploaded original, destroying the admin's upload on transient errors.

**Files:**
- Modify: `src/lib/s3.ts`
- Modify: `src/app/api/admin/images/route.ts:26-35`
- Test: `src/lib/__tests__/s3.test.ts`

- [ ] **Step 1: Add a dedicated error class and throw it**

In `src/lib/s3.ts`, add below the `MAX_UPLOAD_BYTES` constant:

```ts
export class ObjectTooLargeError extends Error {
  constructor(s3Key: string, size: number, maxBytes: number) {
    super(`Object ${s3Key} is ${size} bytes, exceeding the ${maxBytes}-byte cap`);
    this.name = "ObjectTooLargeError";
  }
}
```

and change the throw inside `getObjectBufferWithSizeCap`:

```ts
export async function getObjectBufferWithSizeCap(
  s3Key: string,
  maxBytes: number = MAX_UPLOAD_BYTES,
): Promise<Buffer> {
  const head = await getClient().send(
    new HeadObjectCommand({ Bucket: getBucket(), Key: s3Key }),
  );
  const size = head.ContentLength ?? 0;
  if (size > maxBytes) {
    throw new ObjectTooLargeError(s3Key, size, maxBytes);
  }
  return getObjectBuffer(s3Key);
}
```

- [ ] **Step 2: Write failing unit tests for the size-cap branch**

Append to `src/lib/__tests__/s3.test.ts`. The existing tests in this file exercise pure helpers and are unaffected by the SDK mock:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// (merge with the existing imports at the top of the file)

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = sendMock;
  },
  HeadObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

describe("getObjectBufferWithSizeCap", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.S3_BUCKET = "test-bucket";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "k";
    process.env.AWS_SECRET_ACCESS_KEY = "s";
  });

  it("throws ObjectTooLargeError when HEAD reports an oversized object", async () => {
    sendMock.mockResolvedValueOnce({ ContentLength: 31 * 1024 * 1024 });
    await expect(getObjectBufferWithSizeCap("originals/x.jpg")).rejects.toBeInstanceOf(
      ObjectTooLargeError,
    );
    expect(sendMock).toHaveBeenCalledTimes(1); // never attempts the GET
  });

  it("returns the object body when under the cap", async () => {
    sendMock.mockResolvedValueOnce({ ContentLength: 10 });
    sendMock.mockResolvedValueOnce({
      Body: (async function* () {
        yield new Uint8Array([1, 2, 3]);
      })(),
    });
    const buf = await getObjectBufferWithSizeCap("originals/x.jpg");
    expect([...buf]).toEqual([1, 2, 3]);
  });
});
```

Update the import line at the top of the file to include the new symbols:

```ts
import { getS3Key, getThumbnailKey, getCdnUrl, getObjectBufferWithSizeCap, ObjectTooLargeError } from "../s3";
```

Note: the existing `beforeEach`/`afterEach` for `CLOUDFRONT_DOMAIN` stays as-is. Because `src/lib/s3.ts` caches `_client`/`_bucket` at module scope, set env vars **before** the first call in this file's tests (the `beforeEach` above does this).

Run: `pnpm test -- s3` — the new tests should FAIL before Step 1 is applied, PASS after. (If you implemented Step 1 first, just verify they pass; the important thing is both land in this commit.)

- [ ] **Step 3: Fix the route's catch block**

In `src/app/api/admin/images/route.ts`, replace lines 26–35 with:

```ts
import { getCdnUrl, getThumbnailKey, uploadBuffer, deleteS3Object, getObjectBufferWithSizeCap, ObjectTooLargeError } from "@/lib/s3";
// (merge into the existing import from "@/lib/s3")

  let buffer: Buffer;
  try {
    buffer = await getObjectBufferWithSizeCap(s3Key);
  } catch (err) {
    if (err instanceof ObjectTooLargeError) {
      await deleteS3Object(s3Key).catch((cleanupErr) => {
        console.error("Failed to delete oversized upload:", cleanupErr);
      });
      return Response.json(
        { error: "Uploaded file exceeds size limit" },
        { status: 413 },
      );
    }
    console.error("Failed to read uploaded object:", err);
    return Response.json(
      { error: "Could not read the uploaded file. Please try again." },
      { status: 502 },
    );
  }
```

- [ ] **Step 4: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Only treat size-cap violations as 413 + delete; other S3 read failures no longer destroy the upload"
```

---

### Task 3: processImage — header-only dimensions + display rendition

`processImage` currently decodes **and re-encodes** the full original just to read post-rotation dimensions, then decodes again for the thumbnail (regression of the 04-07 P5 fix). Replace with `metadata()` + orientation swap, and add the ~2048px display rendition the lightbox will use (Task 4).

**Files:**
- Modify: `src/lib/images.ts` (full rewrite below)
- Test: `src/lib/__tests__/images.test.ts`

- [ ] **Step 1: Rewrite `src/lib/images.ts`**

```ts
import sharp from "sharp";

interface ProcessedImage {
  width: number;
  height: number;
  thumbnail: Buffer;
  display: Buffer;
}

const THUMBNAIL_MAX_EDGE = 800;
const THUMBNAIL_QUALITY = 80;
const DISPLAY_MAX_EDGE = 2048;
const DISPLAY_QUALITY = 82;

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  // metadata() reads only the header — no full decode. EXIF orientations
  // 5-8 are 90°/270° rotations, so the rendered axes are swapped relative
  // to the stored dimensions.
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }
  const axesSwapped = (metadata.orientation ?? 1) >= 5;
  const width = axesSwapped ? metadata.height : metadata.width;
  const height = axesSwapped ? metadata.width : metadata.height;

  // .rotate() with no args applies EXIF auto-orientation.
  const base = sharp(buffer).rotate();
  const [thumbnail, display] = await Promise.all([
    base
      .clone()
      .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer(),
    base
      .clone()
      .resize(DISPLAY_MAX_EDGE, DISPLAY_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: DISPLAY_QUALITY })
      .toBuffer(),
  ]);

  return { width, height, thumbnail, display };
}
```

(The previous `needsResize` branch is subsumed by `withoutEnlargement: true`.)

- [ ] **Step 2: Extend the tests**

All five existing tests in `src/lib/__tests__/images.test.ts` must still pass unchanged (same `width`/`height`/thumbnail semantics, including the EXIF orientation-6 test). Add display-rendition coverage:

```ts
describe("processImage display rendition", () => {
  it("produces a webp display rendition capped at 2048px on the long edge", async () => {
    const input = await createTestImage(3000, 2000);
    const result = await processImage(input);

    const displayMeta = await sharp(result.display).metadata();
    expect(displayMeta.format).toBe("webp");
    expect(displayMeta.width).toBe(2048);
    expect(Math.max(displayMeta.width!, displayMeta.height!)).toBeLessThanOrEqual(2048);
  });

  it("does not upscale the display rendition for small images", async () => {
    const input = await createTestImage(400, 300);
    const result = await processImage(input);

    const displayMeta = await sharp(result.display).metadata();
    expect(displayMeta.width).toBe(400);
    expect(displayMeta.height).toBe(300);
  });
});
```

Run: `pnpm test -- images` — expect all tests PASS (7 total in this file).

- [ ] **Step 3: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Read dimensions from image header instead of full re-encode; emit 2048px display rendition"
```

---

### Task 4: Display rendition end-to-end (schema → upload → lightbox)

The lightbox currently serves the untouched original (up to 30 MB) through the image optimizer with no adjacent preload — a cold multi-second wait per navigation. Wire the display rendition through the schema, the register/delete routes, the public projection, and the lightbox. The column is nullable; legacy images fall back to `cdnUrl`.

**Files:**
- Modify: `src/db/schema.ts` (images table)
- Create: `drizzle/0002_*.sql` (generated)
- Modify: `src/lib/s3.ts` (add `getDisplayKey`)
- Modify: `src/app/api/admin/images/route.ts` (POST uploads display; DELETE removes it)
- Modify: `src/lib/galleries.ts` (`PublicGalleryImage` + `toPublicImage`)
- Modify: `src/components/public/lightbox.tsx`

- [ ] **Step 1: Add the nullable column to the images table in `src/db/schema.ts`**

```ts
    thumbnailUrl: text("thumbnail_url").notNull(),
    displayUrl: text("display_url"), // ~2048px webp; null for images uploaded before 2026-06
```

- [ ] **Step 2: Generate the migration**

```bash
pnpm exec drizzle-kit generate
```

Expected: a new `drizzle/0002_*.sql` containing `ALTER TABLE \`images\` ADD \`display_url\` text;`. Do not push.

- [ ] **Step 3: Add the display key helper to `src/lib/s3.ts`** (next to `getThumbnailKey`)

```ts
export function getDisplayKey(imageId: string): string {
  return `display/${imageId}.webp`;
}
```

- [ ] **Step 4: Upload and record the display rendition in `src/app/api/admin/images/route.ts` POST**

Replace lines 36–58 (from `processImage` through the insert):

```ts
import { getCdnUrl, getThumbnailKey, getDisplayKey, uploadBuffer, deleteS3Object, getObjectBufferWithSizeCap, ObjectTooLargeError } from "@/lib/s3";
// (merge into the existing import)

  const { width, height, thumbnail, display } = await processImage(buffer);
  const cdnUrl = getCdnUrl(s3Key);

  // Upload renditions to S3
  const thumbnailKey = getThumbnailKey(imageId);
  const displayKey = getDisplayKey(imageId);
  await Promise.all([
    uploadBuffer(thumbnailKey, thumbnail, "image/webp"),
    uploadBuffer(displayKey, display, "image/webp"),
  ]);

  const thumbnailUrl = getCdnUrl(thumbnailKey);
  const displayUrl = getCdnUrl(displayKey);
  const now = new Date().toISOString();

  const record = {
    id: imageId,
    filename,
    s3Key,
    cdnUrl,
    thumbnailUrl,
    displayUrl,
    width,
    height,
    sortOrder: 0,
    createdAt: now,
  };

  await db.insert(images).values(record);
```

- [ ] **Step 5: Delete the display rendition in the DELETE handler**

Replace the S3 deletion block (lines 96–101):

```ts
  // Delete original, thumbnail, and display rendition from S3
  await Promise.all([
    deleteS3Object(image.s3Key),
    deleteS3Object(getThumbnailKey(imageId)),
    deleteS3Object(getDisplayKey(imageId)),
  ]);
```

(Legacy images have no display object; S3 DeleteObject on a missing key succeeds, so no special-casing.)

- [ ] **Step 6: Extend the public projection in `src/lib/galleries.ts`**

```ts
export type PublicGalleryImage = {
  id: string;
  thumbnailUrl: string;
  cdnUrl: string;
  displayUrl: string | null;
  width: number;
  height: number;
  altText: string | null;
  filename: string;
};

function toPublicImage(img: Image): PublicGalleryImage {
  return {
    id: img.id,
    thumbnailUrl: img.thumbnailUrl,
    cdnUrl: img.cdnUrl,
    displayUrl: img.displayUrl,
    width: img.width,
    height: img.height,
    altText: img.altText,
    filename: img.filename,
  };
}
```

- [ ] **Step 7: Use the rendition in the lightbox and preload neighbors**

First verify prop names in `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` (`preload` replaces deprecated `priority`). Then in `src/components/public/lightbox.tsx`:

Add above the return, after `hasNext`:

```tsx
  const prevImage = hasPrev ? images[currentIndex - 1] : null;
  const nextImage = hasNext ? images[currentIndex + 1] : null;

  function displaySrc(img: PublicGalleryImage): string {
    return img.displayUrl ?? img.cdnUrl;
  }
```

Replace the main `<Image>` (lines 67–75):

```tsx
        <Image
          src={displaySrc(image)}
          alt={image.altText || image.filename}
          width={image.width}
          height={image.height}
          className="max-w-full max-h-[90vh] object-contain"
          sizes="90vw"
          preload
        />
```

Add just before the closing `</div>` of the dialog (after the counter):

```tsx
      {/* Preload neighbors so arrow-key navigation is instant */}
      <div className="hidden" aria-hidden="true">
        {prevImage && (
          <Image
            src={displaySrc(prevImage)}
            alt=""
            width={prevImage.width}
            height={prevImage.height}
            sizes="90vw"
            preload
          />
        )}
        {nextImage && (
          <Image
            src={displaySrc(nextImage)}
            alt=""
            width={nextImage.width}
            height={nextImage.height}
            sizes="90vw"
            preload
          />
        )}
      </div>
```

- [ ] **Step 8: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Serve 2048px display rendition in lightbox with neighbor preload; fall back to original for legacy images"
```

---

### Task 5: Homepage query rewrite + LCP preload + galleries tests

`getHomepageGridImages` over-fetches 60 full rows sequentially after a galleries query, then redundantly re-shuffles an already-random sample (regression of the 04-26 P1 fix). Replace with one joined, projected, `LIMIT 12` query. Export the row type so `homepage-grid.tsx` stops re-declaring it. Mark above-the-fold images for eager loading. Add the missing `getPublishedGalleryBySlugWithImages` tests (audit Important #15).

**Files:**
- Modify: `src/lib/galleries.ts:61-96`
- Modify: `src/components/public/homepage-grid.tsx`
- Modify: `src/components/public/gallery-grid.tsx`
- Test: `src/lib/__tests__/galleries.test.ts`

- [ ] **Step 1: Replace `getHomepageGridImages` in `src/lib/galleries.ts`**

Delete lines 61–96 (`HOMEPAGE_GRID_MAX`, `HOMEPAGE_SAMPLE_SIZE`, and the old function) and the now-private `HomepageGridImage` type at lines 20–22; replace with:

```ts
export type HomepageGridImage = Omit<PublicGalleryImage, "cdnUrl" | "displayUrl"> & {
  gallerySlug: string;
};

const HOMEPAGE_GRID_MAX = 12;

export async function getHomepageGridImages(): Promise<HomepageGridImage[]> {
  return db
    .select({
      id: images.id,
      thumbnailUrl: images.thumbnailUrl,
      width: images.width,
      height: images.height,
      altText: images.altText,
      filename: images.filename,
      gallerySlug: galleries.slug,
    })
    .from(images)
    .innerJoin(galleries, eq(images.galleryId, galleries.id))
    .where(eq(galleries.isPublished, 1))
    .orderBy(sql`RANDOM()`)
    .limit(HOMEPAGE_GRID_MAX);
}
```

(`inArray` and `asc` are still used elsewhere in the file — check imports compile; drop `inArray` only if nothing else uses it. `getPublishedGalleriesWithCovers` uses both.)

- [ ] **Step 2: Import the type in `src/components/public/homepage-grid.tsx`**

Delete the local `GridImage` type (lines 4–12) and add:

```tsx
import type { HomepageGridImage as GridImage } from "@/lib/galleries";
```

`gallerySlug` is now non-null (inner join); the `img.gallerySlug ? <Link> : tile` branch in `renderTile` still typechecks — simplify it to always render the Link:

```tsx
  function renderTile(img: GridImage, eager: boolean) {
    return (
      <Link href={`/portfolio/${img.gallerySlug}`} className="block">
        <Image
          src={img.thumbnailUrl}
          alt={img.altText || img.filename}
          width={img.width}
          height={img.height}
          className="w-full h-auto transition-opacity duration-300 hover:opacity-90"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          fetchPriority={eager ? "high" : undefined}
        />
      </Link>
    );
  }
```

Why `fetchPriority` and not `preload`: the grid renders three breakpoint variants of every tile with CSS hiding two; `preload` would emit `<link rel=preload>` for hidden duplicates, while `fetchPriority` only boosts the copy the browser actually loads (per the art-direction note in the Next image docs — verify the prop exists in `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` before using).

Thread `eager` through the call sites:
- Mobile stack: `{renderTile(img, idx === 0)}` (change `images.map((img) => ...)` to `images.map((img, idx) => ...)`).
- `renderRows`: give it the row index — `{renderTile(img, rowIdx === 0)}`.

- [ ] **Step 3: Preload the first portfolio images in `src/components/public/gallery-grid.tsx`**

Replace the `<Image>` (lines 24–32):

```tsx
            <Image
              src={image.thumbnailUrl}
              alt={image.altText || image.filename}
              width={image.width}
              height={image.height}
              className="w-full h-auto"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading={index < 3 ? undefined : "lazy"}
              preload={index < 3}
            />
```

- [ ] **Step 4: Rewrite the `getHomepageGridImages` tests and add slug-helper tests**

Replace `src/lib/__tests__/galleries.test.ts` mock plumbing and the `getHomepageGridImages` describe; keep the `getPublishedGalleriesWithCovers` describe as-is (its mocks are unchanged):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManyGalleries, findFirstGallery, findManyImages, selectImages, limitSpy } = vi.hoisted(() => ({
  findManyGalleries: vi.fn(),
  findFirstGallery: vi.fn(),
  findManyImages: vi.fn(),
  selectImages: vi.fn(),
  limitSpy: vi.fn(),
}));

vi.mock("@/db/client", () => {
  const limit = limitSpy.mockImplementation(() => selectImages());
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ innerJoin, where }));
  const select = vi.fn(() => ({ from }));
  return {
    db: {
      query: {
        galleries: { findMany: findManyGalleries, findFirst: findFirstGallery },
        images: { findMany: findManyImages },
      },
      select,
    },
  };
});

import {
  getHomepageGridImages,
  getPublishedGalleriesWithCovers,
  getPublishedGalleryBySlugWithImages,
} from "../galleries";

describe("getHomepageGridImages", () => {
  beforeEach(() => {
    selectImages.mockReset();
    limitSpy.mockClear();
  });

  it("returns [] when the join finds no published-gallery images", async () => {
    selectImages.mockResolvedValue([]);
    expect(await getHomepageGridImages()).toEqual([]);
  });

  it("returns the joined rows and caps the query at 12", async () => {
    const rows = [
      { id: "i1", thumbnailUrl: "t1", width: 800, height: 600, altText: null, filename: "a.jpg", gallerySlug: "trip" },
      { id: "i2", thumbnailUrl: "t2", width: 600, height: 800, altText: "alt", filename: "b.jpg", gallerySlug: "studio" },
    ];
    selectImages.mockResolvedValue(rows);

    const result = await getHomepageGridImages();
    expect(result).toEqual(rows);
    expect(limitSpy).toHaveBeenCalledWith(12);
  });
});

describe("getPublishedGalleryBySlugWithImages", () => {
  beforeEach(() => {
    findFirstGallery.mockReset();
    findManyImages.mockReset();
  });

  it("returns null for an unknown slug", async () => {
    findFirstGallery.mockResolvedValue(undefined);
    expect(await getPublishedGalleryBySlugWithImages("nope")).toBeNull();
    expect(findManyImages).not.toHaveBeenCalled();
  });

  it("returns null for an unpublished gallery (draft slugs are not public)", async () => {
    findFirstGallery.mockResolvedValue({ id: "g1", slug: "draft", isPublished: 0 });
    expect(await getPublishedGalleryBySlugWithImages("draft")).toBeNull();
    expect(findManyImages).not.toHaveBeenCalled();
  });

  it("returns the gallery with images projected through toPublicImage (no s3Key)", async () => {
    const gallery = { id: "g1", slug: "trip", title: "Trip", isPublished: 1 };
    findFirstGallery.mockResolvedValue(gallery);
    findManyImages.mockResolvedValue([
      {
        id: "i1",
        galleryId: "g1",
        filename: "a.jpg",
        s3Key: "originals/i1.jpg",
        cdnUrl: "https://cdn/originals/i1.jpg",
        thumbnailUrl: "https://cdn/thumbnails/i1.webp",
        displayUrl: "https://cdn/display/i1.webp",
        width: 800,
        height: 600,
        altText: null,
        sortOrder: 0,
        createdAt: "2026-01-01",
      },
    ]);

    const result = await getPublishedGalleryBySlugWithImages("trip");
    expect(result?.gallery).toBe(gallery);
    expect(result?.images).toEqual([
      {
        id: "i1",
        thumbnailUrl: "https://cdn/thumbnails/i1.webp",
        cdnUrl: "https://cdn/originals/i1.jpg",
        displayUrl: "https://cdn/display/i1.webp",
        width: 800,
        height: 600,
        altText: null,
        filename: "a.jpg",
      },
    ]);
    expect(result!.images[0]).not.toHaveProperty("s3Key");
  });
});
```

Keep the existing `getPublishedGalleriesWithCovers` describe block (it uses `findManyGalleries`/`findManyImages`, both still wired). Its `beforeEach` references `selectImages` — fine to keep.

Run: `pnpm test -- galleries` — expect PASS (8 tests in this file).

- [ ] **Step 5: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Single joined LIMIT 12 homepage query; eager-load above-the-fold images; cover slug-helper with tests"
```

---

### Task 6: Cover invariant into the assign route + GalleryImageManager error handling (Critical #2, Important #7)

The assign endpoint leaves dangling `coverImageId`s; the client papers over it with a non-atomic two-fetch chain whose failures are silently ignored. Move the invariant server-side (matching the precedent in the image-DELETE handler) and rewrite the component to the C16 error-handling convention (`res.ok` check + `alert` + `finally`). Also align the images `[id]` route on PUT (galleries/messages/settings already use PUT for partial updates).

**Files:**
- Modify: `src/app/api/admin/images/assign/route.ts`
- Modify: `src/app/api/admin/images/[id]/route.ts` (PATCH → PUT)
- Modify: `src/components/admin/gallery-image-manager.tsx`

- [ ] **Step 1: Clear covers inside the assign route's batch**

Replace `src/app/api/admin/images/assign/route.ts` body:

```ts
import { db } from "@/db/client";
import { images, galleries } from "@/db/schema";
import { eq, ne, and, inArray } from "drizzle-orm";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";
import { revalidatePath } from "next/cache";

export const PUT = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{
    imageIds?: string[];
    galleryId?: string | null;
  }>(request);
  if (!parsed.ok) return parsed.response;

  const { imageIds, galleryId } = parsed.body;
  if (!imageIds || !Array.isArray(imageIds)) {
    return Response.json(
      { error: "imageIds array is required" },
      { status: 400 },
    );
  }
  if (imageIds.length === 0) {
    return Response.json({ success: true });
  }

  // A gallery's cover must be one of its own images: when an image moves
  // out of a gallery, clear any cover reference it leaves behind. The
  // target gallery keeps its cover if the image is "moving" into the
  // gallery it is already in.
  const coverClear = galleryId
    ? and(inArray(galleries.coverImageId, imageIds), ne(galleries.id, galleryId))
    : inArray(galleries.coverImageId, imageIds);

  const stmts = [
    ...imageIds.map((id) =>
      db.update(images).set({ galleryId: galleryId ?? null }).where(eq(images.id, id)),
    ),
    db.update(galleries).set({ coverImageId: null }).where(coverClear),
  ];
  await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);

  revalidatePath("/galleries");
  revalidatePath("/portfolio/[slug]", "page");

  return Response.json({ success: true });
});
```

- [ ] **Step 2: Rename the images `[id]` handler PATCH → PUT**

In `src/app/api/admin/images/[id]/route.ts:7`, change `export const PATCH = withAdminAuth(...)` to `export const PUT = withAdminAuth(...)`. Nothing else in the handler changes in this task.

- [ ] **Step 3: Rewrite the mutation helpers in `src/components/admin/gallery-image-manager.tsx`**

Replace the five helper functions (lines 32–88) with a shared `mutate` helper. `clearCoverIfMatches` is deleted — the assign route owns that invariant now. The `coverImageId` prop is still used for the badge/Set-cover button, so it stays.

```tsx
  async function mutate(imageId: string, request: () => Promise<Response>): Promise<boolean> {
    setBusyId(imageId);
    try {
      const res = await request();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Operation failed.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      alert("Network error. Please try again.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function saveAlt(imageId: string) {
    if (busyId === imageId) return; // Enter and blur can both fire for one edit
    const ok = await mutate(imageId, () =>
      fetch(`/api/admin/images/${imageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: altDraft }),
      }),
    );
    if (ok) setEditingAltId(null);
  }

  async function setCover(imageId: string) {
    await mutate(imageId, () =>
      fetch(`/api/admin/galleries/${galleryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImageId: imageId }),
      }),
    );
  }

  async function removeFromGallery(imageId: string) {
    if (!confirm("Remove this image from the gallery? It will move to Unsorted.")) return;
    await mutate(imageId, () =>
      fetch("/api/admin/images/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: [imageId], galleryId: null }),
      }),
    );
  }

  async function moveTo(imageId: string, targetGalleryId: string) {
    if (!targetGalleryId) return;
    await mutate(imageId, () =>
      fetch("/api/admin/images/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: [imageId], galleryId: targetGalleryId }),
      }),
    );
  }
```

Note for the Escape key handler in the JSX (`onKeyDown`, line ~142): unchanged. The `onBlur={() => saveAlt(img.id)}` and Enter path are now guarded against double-fire by the `busyId` check.

- [ ] **Step 4: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Enforce cover-image invariant in assign route; surface GalleryImageManager mutation failures"
```

---

### Task 7: DB-backed login rate limiting (Important #10)

The in-memory limiter resets per serverless instance, never evicts idle IPs, and counts successful logins toward lockout. Replace with a `login_attempts` table: count failures in the window before verifying, record only failures, clear on success.

**Files:**
- Modify: `src/db/schema.ts` (new table)
- Create: `drizzle/0003_*.sql` (generated)
- Modify: `src/app/api/admin/auth/login/route.ts` (full rewrite below)
- Test: `src/lib/__tests__/login-route.test.ts` (rewrite mock + add unknown-user test)

- [ ] **Step 1: Add the table to `src/db/schema.ts`**

```ts
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    ip: text("ip").notNull(),
    attemptedAt: text("attempted_at").notNull(),
  },
  (table) => ({
    ipIdx: index("login_attempts_ip_idx").on(table.ip, table.attemptedAt),
  }),
);
```

- [ ] **Step 2: Generate the migration**

```bash
pnpm exec drizzle-kit generate
```

Expected: `drizzle/0003_*.sql` with `CREATE TABLE \`login_attempts\``. Do not push.

- [ ] **Step 3: Rewrite `src/app/api/admin/auth/login/route.ts`**

```ts
import { eq, lt, gt, and, or, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { adminUser, sessions, loginAttempts } from "@/db/schema";
import { parseJsonBody } from "@/lib/api-helpers";
import { createSessionCookie, getNewExpiresAt } from "@/lib/auth";

const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_MAX = 10;

// On Vercel x-forwarded-for is set by the platform; on other hosts these
// headers are client-suppliable, and the bcrypt cost is the real backstop.
function getIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function windowStartIso(): string {
  return new Date(Date.now() - LOGIN_ATTEMPT_WINDOW_MS).toISOString();
}

async function countRecentFailures(ip: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), gt(loginAttempts.attemptedAt, windowStartIso())));
  return row.total;
}

async function recordFailure(ip: string): Promise<void> {
  await db.insert(loginAttempts).values({
    id: crypto.randomUUID(),
    ip,
    attemptedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const ip = getIp(request);
  if ((await countRecentFailures(ip)) >= LOGIN_ATTEMPT_MAX) {
    return Response.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const parsed = await parseJsonBody<{ email?: string; password?: string }>(request);
  if (!parsed.ok) return parsed.response;

  const { email, password } = parsed.body;
  if (!email || !password) {
    return Response.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const users = await db
    .select()
    .from(adminUser)
    .where(eq(adminUser.email, email))
    .limit(1);

  const user = users[0];
  if (!user) {
    await recordFailure(ip);
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    await recordFailure(ip);
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Lazy cleanup on success (fire and forget): this IP's failures plus any
  // stale rows from other IPs outside the window.
  db.delete(loginAttempts)
    .where(or(eq(loginAttempts.ip, ip), lt(loginAttempts.attemptedAt, windowStartIso())))
    .then(() => {})
    .catch((err) => console.error("Failed to clean login attempts:", err));

  db.delete(sessions)
    .where(lt(sessions.expiresAt, new Date().toISOString()))
    .then(() => {})
    .catch((err) => console.error("Failed to clean expired sessions:", err));

  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(sessions).values({
    id: sessionId,
    adminUserId: user.id,
    expiresAt: getNewExpiresAt(),
    createdAt: now,
  });

  return Response.json(
    { success: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": createSessionCookie(sessionId),
      },
    },
  );
}
```

- [ ] **Step 4: Rewrite the test mock and add the unknown-user test**

Replace the `vi.mock("@/db/client", ...)` block in `src/lib/__tests__/login-route.test.ts` and add state arrays. The mock routes the two `select` chains by shape: the failures-count query awaits `where()` directly, the admin-user query calls `.limit()` — so `where()` returns a thenable that also carries `.limit`.

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  userRows: [] as { id: string; email: string; passwordHash: string }[],
  failures: [] as { ip: string }[],
  sessions: [] as unknown[],
}));

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          const countResult = Promise.resolve([{ total: state.failures.length }]);
          return Object.assign(countResult, {
            limit: async () => state.userRows,
          });
        },
      }),
    }),
    insert: () => ({
      values: async (v: Record<string, unknown>) => {
        if ("ip" in v) state.failures.push(v as { ip: string });
        else state.sessions.push(v);
      },
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  },
}));

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async (pw: string) => pw === "correct") },
}));

const ADMIN = { id: "u1", email: "admin@x", passwordHash: "$2a$10$validhash" };

describe("POST /api/admin/auth/login", () => {
  beforeEach(() => {
    vi.resetModules();
    state.userRows = [ADMIN];
    state.failures.length = 0;
    state.sessions.length = 0;
  });

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

  it("returns 401 and records a failure for an unknown email", async () => {
    state.userRows = [];
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ email: "nobody@x", password: "whatever" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(state.failures).toHaveLength(1);
  });

  it("returns 401 on wrong password and records a failure", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ email: "admin@x", password: "wrong" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(state.failures).toHaveLength(1);
  });

  it("returns 200 + Set-Cookie on success without recording a failure", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ email: "admin@x", password: "correct" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/admin_session=/);
    expect(state.failures).toHaveLength(0);
  });

  it("returns 429 once 10 failures have accumulated", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const attempt = () =>
      POST(
        new Request("http://x", {
          method: "POST",
          headers: { "x-forwarded-for": "1.2.3.4" },
          body: JSON.stringify({ email: "admin@x", password: "wrong" }),
        }),
      );
    for (let i = 0; i < 10; i++) {
      expect((await attempt()).status).toBe(401);
    }
    expect((await attempt()).status).toBe(429);
    expect(state.failures).toHaveLength(10); // the blocked attempt records nothing
  });
});
```

Run: `pnpm test -- login-route` — expect 6 tests PASS.

- [ ] **Step 5: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Replace per-process login rate limiter with DB-backed failure counting"
```

---

### Task 8: Contact-form hardening (Important #9, #11, #14 + minors)

Add length caps and `typeof` guards to the only unauthenticated write path, share the session-type list with the form, await the SES notification (serverless can freeze the instance before a floating promise resolves), route the settings read through `getSettings()`, and add the missing rate-limit test the 04-26 audit claimed existed.

**Files:**
- Create: `src/lib/contact.ts`
- Modify: `src/app/(public)/contact/actions.ts` (full rewrite below)
- Modify: `src/components/public/contact-form.tsx`
- Test: `src/lib/__tests__/contact-actions.test.ts`

- [ ] **Step 1: Create `src/lib/contact.ts`**

(`actions.ts` is a `"use server"` file and may only export async functions, so shared constants must live outside it.)

```ts
export const SESSION_TYPES = ["Portrait", "Family", "Engagement", "Other"] as const;

export const CONTACT_FIELD_LIMITS = {
  name: 200,
  email: 254,
  phone: 50,
  message: 5000,
} as const;
```

- [ ] **Step 2: Rewrite `src/app/(public)/contact/actions.ts`**

```ts
"use server";

import { db } from "@/db/client";
import { contactSubmissions } from "@/db/schema";
import { eq, and, gt, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getSettings } from "@/lib/settings";
import { SESSION_TYPES, CONTACT_FIELD_LIMITS } from "@/lib/contact";
import { sendContactNotification } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const ALLOWED_SESSION_TYPES = new Set<string>(SESSION_TYPES);

// FormData entries can be File objects in a crafted request; only accept strings.
function getStringField(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

export async function submitContactForm(formData: FormData) {
  const settings = await getSettings();

  if (!settings?.contactFormEnabled) {
    return { error: "Contact form is currently disabled." };
  }

  const name = getStringField(formData, "name")?.trim();
  const email = getStringField(formData, "email")?.trim();
  const phone = getStringField(formData, "phone")?.trim() || null;
  const sessionType = getStringField(formData, "sessionType");
  const message = getStringField(formData, "message")?.trim();

  if (!name || !email || !sessionType || !message) {
    return { error: "Please fill in all required fields." };
  }

  if (
    name.length > CONTACT_FIELD_LIMITS.name ||
    email.length > CONTACT_FIELD_LIMITS.email ||
    (phone ? phone.length > CONTACT_FIELD_LIMITS.phone : false) ||
    message.length > CONTACT_FIELD_LIMITS.message
  ) {
    return { error: "One or more fields are too long." };
  }

  if (!EMAIL_RE.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const normalizedEmail = email.toLowerCase();
  if (!ALLOWED_SESSION_TYPES.has(sessionType)) {
    return { error: "Please select a valid session type." };
  }

  // Rate limiting: max 5 submissions per email per hour
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const [result] = await db
    .select({ total: count() })
    .from(contactSubmissions)
    .where(
      and(
        eq(contactSubmissions.email, normalizedEmail),
        gt(contactSubmissions.createdAt, oneHourAgo)
      )
    );

  if (result.total >= RATE_LIMIT_MAX) {
    return { error: "Too many submissions. Please try again later." };
  }

  await db.insert(contactSubmissions).values({
    id: randomUUID(),
    name,
    email: normalizedEmail,
    phone,
    sessionType,
    message,
    isRead: 0,
    createdAt: new Date().toISOString(),
  });

  // sendContactNotification never throws (it catches and logs internally).
  // Awaiting it matters: a serverless instance can freeze as soon as the
  // action returns, silently dropping a floating promise.
  await sendContactNotification({
    name,
    email: normalizedEmail,
    phone,
    sessionType,
    message,
  });

  return { success: true };
}
```

(Note: `siteSettings` and `SETTINGS_ID` imports are gone — the read goes through `getSettings()`.)

- [ ] **Step 3: Render the options from the shared constant and add maxLength**

In `src/components/public/contact-form.tsx`:

```tsx
import { SESSION_TYPES, CONTACT_FIELD_LIMITS } from "@/lib/contact";
```

Replace the four hardcoded `<option>` lines (77–80):

```tsx
          {SESSION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
```

(keep the `<option value="">Select...</option>` placeholder). Add `maxLength` to the inputs:
- name input: `maxLength={CONTACT_FIELD_LIMITS.name}`
- email input: `maxLength={CONTACT_FIELD_LIMITS.email}`
- phone input: `maxLength={CONTACT_FIELD_LIMITS.phone}`
- message textarea: `maxLength={CONTACT_FIELD_LIMITS.message}`

- [ ] **Step 4: Strengthen the tests**

In `src/lib/__tests__/contact-actions.test.ts`, the db mock's `siteSettings.findFirst` continues to serve `getSettings()` (it ignores the `where` arg). Add `vi.resetModules()` + mock-clearing to `beforeEach` so notification-call assertions are isolated, and add four tests:

Replace the `describe` block's `beforeEach` and add tests:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendContactNotification } from "@/lib/email";

// ... existing mocks unchanged ...

describe("submitContactForm", () => {
  beforeEach(() => {
    submissions.length = 0;
    contactFormEnabled = 1;
    vi.mocked(sendContactNotification).mockClear();
  });

  // ... existing five tests unchanged ...

  it("rejects the 6th submission within the window for the same email", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    for (let i = 0; i < 5; i++) submissions.push({ email: "jane@example.com" });

    const result = await submitContactForm(validForm());
    expect(result.error).toMatch(/too many/i);
    expect(submissions).toHaveLength(5); // nothing inserted
  });

  it("rejects over-length fields", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const result = await submitContactForm(validForm({ message: "x".repeat(5001) }));
    expect(result.error).toMatch(/too long/i);
    expect(submissions).toHaveLength(0);
  });

  it("rejects File entries in string fields without throwing", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const fd = validForm();
    fd.set("name", new Blob(["x"]), "evil.txt");
    const result = await submitContactForm(fd);
    expect(result.error).toMatch(/required/i);
  });

  it("returns success and sends the notification with the stored payload", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const result = await submitContactForm(validForm({ name: "  Jane  " }));
    expect(result).toEqual({ success: true });
    expect(vi.mocked(sendContactNotification)).toHaveBeenCalledWith({
      name: "Jane",
      email: "jane@example.com",
      phone: null,
      sessionType: "Family",
      message: "Hello there.",
    });
  });
});
```

Caveat for the executor: importing `sendContactNotification` at the top level works because the module is mocked. If `getSettings()`'s React `cache()` wrapper ever memoizes across tests (it should not outside a React request context), add `vi.resetModules()` to `beforeEach` and keep the dynamic imports.

Run: `pnpm test -- contact-actions` — expect 9 tests PASS.

- [ ] **Step 5: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Contact form: length caps, File-entry guards, shared session-type list, awaited notification"
```

---

### Task 9: Simplify withAdminAuth context

`withAdminAuth` supplies a `sessionId` no handler reads, and its optional `params` forces an unreachable `if (!params)` guard in every dynamic route.

**Files:**
- Modify: `src/lib/api-helpers.ts`
- Modify: `src/app/api/admin/galleries/[id]/route.ts` (2 guards)
- Modify: `src/app/api/admin/images/[id]/route.ts` (1 guard)
- Modify: `src/app/api/admin/messages/[id]/route.ts` (2 guards)
- Test: `src/lib/__tests__/api-helpers.test.ts`

- [ ] **Step 1: Rewrite the wrapper in `src/lib/api-helpers.ts`**

Replace the `AdminContext` type and `withAdminAuth` (lines 19–34):

```ts
type RouteContext<TParams> = { params: Promise<TParams> };

export function withAdminAuth<TParams extends Record<string, string> = Record<string, string>>(
  handler: (request: Request, ctx: RouteContext<TParams>) => Promise<Response>,
) {
  return async (request: Request, routeCtx?: RouteContext<TParams>) => {
    const sessionId = await validateSession(request);
    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Static routes have no params object; their handlers never read ctx.params.
    return handler(request, routeCtx ?? ({} as RouteContext<TParams>));
  };
}
```

- [ ] **Step 2: Remove the five dead guards**

Delete the line `if (!params) return Response.json({ error: "Missing id" }, { status: 400 });` from:
- `src/app/api/admin/galleries/[id]/route.ts` (PUT and DELETE)
- `src/app/api/admin/images/[id]/route.ts` (PUT)
- `src/app/api/admin/messages/[id]/route.ts` (PUT and DELETE)

In each, `const { id } = await params;` stays (destructured from `{ params }` in the handler signature, which now types as non-optional).

- [ ] **Step 3: Update the wrapper tests**

In `src/lib/__tests__/api-helpers.test.ts`, replace the second `withAdminAuth` test:

```ts
  it("calls the handler when authenticated and passes route params through", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", () => ({ validateSession: async () => "sid-123" }));
    const { withAdminAuth } = await import("@/lib/api-helpers");
    const handler = withAdminAuth<{ id: string }>(async (_req, ctx) => {
      const { id } = await ctx.params;
      return Response.json({ id });
    });
    const res = await handler(new Request("http://x"), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "g1" });
    vi.doUnmock("@/lib/auth");
  });
```

Run: `pnpm test -- api-helpers` — expect PASS.

- [ ] **Step 4: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Drop unused sessionId context and unreachable params guards from withAdminAuth routes"
```

---

### Task 10: Dead-code removal

Three pieces of dead data flow: the caller-less `GET /api/admin/messages` (the page queries the DB directly; knip can't see route entry points), the `ext` field threaded client→server but never read, and the gallery-DELETE update that nulls `coverImageId` on the row deleted two statements later.

**Files:**
- Delete: `src/app/api/admin/messages/route.ts`
- Modify: `src/app/api/admin/images/upload-url/route.ts`
- Modify: `src/components/admin/image-uploader.tsx`
- Modify: `src/app/api/admin/images/route.ts`
- Modify: `src/app/api/admin/galleries/[id]/route.ts`

- [ ] **Step 1: Delete the dead endpoint**

```bash
rm /Users/arpanet/dev/mindy-hu-photography/src/app/api/admin/messages/route.ts
```

(`src/app/api/admin/messages/[id]/route.ts` stays — it has callers in `message-list.tsx`.) Verify no references: `grep -rn '"/api/admin/messages"' src/` should return nothing (the client only calls `/api/admin/messages/${id}`).

- [ ] **Step 2: Drop `ext` from the upload flow**

- `src/app/api/admin/images/upload-url/route.ts`: change the response to `return Response.json({ uploadUrl, imageId, s3Key });` (the `ext` local is still used to build `s3Key`).
- `src/components/admin/image-uploader.tsx`: change the destructure to `const { uploadUrl, imageId, s3Key } = await presignRes.json();` and the register body to `JSON.stringify({ imageId, s3Key, filename: file.name })`.
- `src/app/api/admin/images/route.ts` POST: remove `ext` from the `parseJsonBody` generic, the destructure, and the required-fields check/message:

```ts
  const parsed = await parseJsonBody<{
    imageId?: string;
    s3Key?: string;
    filename?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;

  const { imageId, s3Key, filename } = parsed.body;
  if (!imageId || !s3Key || !filename) {
    return Response.json(
      { error: "imageId, s3Key, and filename are required" },
      { status: 400 },
    );
  }
```

- [ ] **Step 3: Remove the dead cover-null write in gallery DELETE**

In `src/app/api/admin/galleries/[id]/route.ts`, delete the first update in the DELETE handler (the `// Null out cover image reference` block that updates the row about to be deleted — `coverImageId` has no FK, and the row itself is removed below).

- [ ] **Step 4: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Remove caller-less messages GET, unused ext field, and no-op cover-null write"
```

---

### Task 11: Admin route + settings consistency

Mechanical consistency pass: a shared revalidation helper (the identical two-line block appears 7×), `.returning()` instead of post-update re-SELECTs, 0/1 validation parity for boolean-as-integer fields, one canonical settings accessor, and write-time trim for the remaining settings fields.

**Files:**
- Modify: `src/lib/api-helpers.ts`
- Modify: `src/app/api/admin/galleries/route.ts`
- Modify: `src/app/api/admin/galleries/[id]/route.ts`
- Modify: `src/app/api/admin/images/route.ts`
- Modify: `src/app/api/admin/images/assign/route.ts`
- Modify: `src/app/api/admin/images/[id]/route.ts`
- Modify: `src/app/api/admin/settings/route.ts`
- Modify: `src/app/admin/(authenticated)/settings/page.tsx`
- Modify: `src/app/layout.tsx`, `src/app/(public)/contact/page.tsx` (drop read-site trims)

- [ ] **Step 1: Add the revalidation helper to `src/lib/api-helpers.ts`**

```ts
import { revalidatePath } from "next/cache";

/** Invalidate every public page that renders gallery/image data. */
export function revalidatePublicGalleryPages(): void {
  revalidatePath("/galleries");
  revalidatePath("/portfolio/[slug]", "page");
}
```

Replace all 7 occurrences of the two-line `revalidatePath("/galleries"); revalidatePath("/portfolio/[slug]", "page");` block with `revalidatePublicGalleryPages();` and remove the now-unused `revalidatePath` imports in: `galleries/route.ts` (1), `galleries/[id]/route.ts` (2), `images/route.ts` (2), `images/assign/route.ts` (1). The 7th occurrence-site `images/[id]/route.ts` only calls `revalidatePath("/portfolio/[slug]", "page")` — change it to `revalidatePublicGalleryPages()` too (alt text shows on both galleries covers? No — covers render thumbnails with their own alt; keep the narrower call there as-is if preferred. Decision: use the helper everywhere for uniformity; the extra `/galleries` invalidation is lazy and free at this scale).

- [ ] **Step 2: Use `.returning()` / spread-merge instead of re-SELECT**

- `src/app/api/admin/images/[id]/route.ts`:

```ts
  const [updated] = await db
    .update(images)
    .set({ altText })
    .where(eq(images.id, id))
    .returning();

  revalidatePublicGalleryPages();

  return Response.json(updated);
```

- `src/app/api/admin/galleries/[id]/route.ts` PUT (replace lines 64–75):

```ts
  const [updated] = await db
    .update(galleries)
    .set(updates)
    .where(eq(galleries.id, id))
    .returning();

  revalidatePublicGalleryPages();

  return Response.json(updated);
```

- [ ] **Step 3: 0/1 validation parity**

- `src/app/api/admin/galleries/[id]/route.ts` PUT, before building `updates`:

```ts
  if (body.isPublished !== undefined && body.isPublished !== 0 && body.isPublished !== 1) {
    return Response.json({ error: "isPublished must be 0 or 1" }, { status: 400 });
  }
```

- `src/app/api/admin/settings/route.ts`, before building `updates`:

```ts
  if (
    body.contactFormEnabled !== undefined &&
    body.contactFormEnabled !== 0 &&
    body.contactFormEnabled !== 1
  ) {
    return Response.json({ error: "contactFormEnabled must be 0 or 1" }, { status: 400 });
  }
```

- [ ] **Step 4: Canonical settings access + write-time trim**

- `src/app/api/admin/settings/route.ts`: trim the remaining text fields at write time and collapse the read-update-read into one statement keyed by `SETTINGS_ID`:

```ts
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SETTINGS_ID } from "@/lib/settings";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";
import { revalidatePath } from "next/cache";

  const updates: Record<string, unknown> = {};
  if (body.siteTitle !== undefined) updates.siteTitle = body.siteTitle.trim();
  if (body.tagline !== undefined) updates.tagline = body.tagline.trim();
  if (body.aboutText !== undefined) updates.aboutText = body.aboutText.trim();
  if (body.aboutImageUrl !== undefined) updates.aboutImageUrl = body.aboutImageUrl;
  if (body.contactEmail !== undefined) updates.contactEmail = body.contactEmail.trim();
  if (body.contactFormEnabled !== undefined)
    updates.contactFormEnabled = body.contactFormEnabled;
  if (body.socialLinks !== undefined) updates.socialLinks = body.socialLinks;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(siteSettings)
    .set(updates)
    .where(eq(siteSettings.id, SETTINGS_ID))
    .returning();

  if (!updated) {
    return Response.json(
      { error: "Settings not found. Run seed first." },
      { status: 404 },
    );
  }

  revalidatePath("/contact");
  revalidatePath("/", "layout");

  return Response.json(updated);
```

Note: `body.siteTitle` etc. are typed `string | undefined` from the `parseJsonBody` generic but arrive unvalidated; add string guards while here:

```ts
  for (const key of ["siteTitle", "tagline", "aboutText", "contactEmail", "socialLinks"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "string") {
      return Response.json({ error: `${key} must be a string` }, { status: 400 });
    }
  }
```

(place before the `updates` construction).

- `src/app/admin/(authenticated)/settings/page.tsx`: replace the row-order-dependent read:

```ts
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import SettingsForm from "@/components/admin/settings-form";
import { parseSocialLinks, SETTINGS_ID } from "@/lib/settings";

export default async function AdminSettingsPage() {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, SETTINGS_ID))
    .limit(1);
  const settings = rows[0];
  // ... rest unchanged
```

(Direct DB read stays — admin server components query the DB directly by convention; the fix is keying by `SETTINGS_ID` instead of "first row wins". Don't use the `cache()`d `getSettings()` here: the admin page must never serve a stale read after the form PUTs.)

- `src/app/layout.tsx:20-22`: now that writes are trimmed, drop the read-site trims:

```ts
  const title = settings?.siteTitle || "Mindy Hu Photography";
  const description = settings?.tagline || "Portrait photography by Mindy Hu";
```

- `src/app/(public)/contact/page.tsx:9`: `const contactEmail = settings?.contactEmail;` (drop `?.trim()`).

- [ ] **Step 5: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Consolidate revalidation, use returning(), 0/1 validation parity, SETTINGS_ID-keyed access, write-time trim"
```

---

### Task 12: Test hygiene

**Files:**
- Delete: `src/db/__tests__/bcrypt.test.ts`
- Modify: `src/lib/__tests__/settings.test.ts`
- Modify: `src/lib/__tests__/auth.test.ts`
- Modify: `src/lib/__tests__/api-helpers.test.ts`
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: Delete the library-only test file**

```bash
rm /Users/arpanet/dev/mindy-hu-photography/src/db/__tests__/bcrypt.test.ts
rmdir /Users/arpanet/dev/mindy-hu-photography/src/db/__tests__ 2>/dev/null || true
```

(It exercises only bcryptjs itself — zero production code — at the cost of two hash rounds per run.)

- [ ] **Step 2: Remove the tautological constant test**

In `src/lib/__tests__/settings.test.ts`, delete the entire `describe("SETTINGS_ID", ...)` block (lines 4–8) and remove `SETTINGS_ID` from the import.

- [ ] **Step 3: Move `vi.doUnmock` to `afterEach`**

In `src/lib/__tests__/auth.test.ts` (`validateSession` describe): remove the two inline `vi.doUnmock("@/db/client");` calls at the end of test bodies and add inside the describe:

```ts
  afterEach(() => {
    vi.doUnmock("@/db/client");
  });
```

(add `afterEach` to the vitest import). Same change in `src/lib/__tests__/api-helpers.test.ts` (`withAdminAuth` describe): remove inline `vi.doUnmock("@/lib/auth")` calls, add:

```ts
  afterEach(() => {
    vi.doUnmock("@/lib/auth");
  });
```

- [ ] **Step 4: Fix the brittle e2e selector**

In `e2e/smoke.spec.ts:32`, replace:

```ts
  await expect(page.locator("text=Admin")).toBeVisible();
```

with (matches the `Admin Login` heading at `src/app/admin/login/page.tsx:43`):

```ts
  await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();
```

- [ ] **Step 5: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Test hygiene: drop library-only and tautological tests, isolate doUnmock, role-based e2e selector"
```

---

### Task 13: Documentation

The repo has no README: install, env vars, migrations, the required seed step, the pre-commit gate, and the e2e suite are documented nowhere. Also: `.env.example` is missing `NEXT_PUBLIC_SITE_URL`, there's no e2e npm script, the Playwright `webServer` still says `npm run dev` post-pnpm-migration, and two intentional hardcodes read like oversights.

**Files:**
- Create: `README.md`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Modify: `src/components/public/nav.tsx`, `src/lib/email.ts` (comments only)

- [ ] **Step 1: Create `README.md`**

```markdown
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
```

- [ ] **Step 2: Complete `.env.example`**

Append:

```
NEXT_PUBLIC_SITE_URL=https://mindyhuphotography.com
```

- [ ] **Step 3: Add the e2e script and fix the Playwright web server command**

In `package.json` scripts: `"test:e2e": "playwright test",`
In `playwright.config.ts`: `command: "pnpm dev",`

- [ ] **Step 4: Mark the intentional hardcodes**

- `src/components/public/nav.tsx`, above the Instagram `<a>` (line ~39):

```tsx
          {/* Intentionally hardcoded to match the reference design — not driven
              by the admin socialLinks setting (which feeds the footer). */}
```

- `src/lib/email.ts`, above `NOTIFICATION_EMAIL`:

```ts
// SES-verified identity used as both sender and recipient. Intentionally not
// the admin-editable contactEmail setting: changing that must not silently
// break notification delivery to an unverified address.
```

- [ ] **Step 5: Run the quality gate; commit**

```bash
git -C /Users/arpanet/dev/mindy-hu-photography add -A
git -C /Users/arpanet/dev/mindy-hu-photography commit -m "Add README, complete .env.example, add e2e script, document intentional hardcodes"
```

---

### Task 14: Audit report (orchestrator-written)

Written by the orchestrating session after all tasks pass the quality gate — not a subagent task. Save to `docs/audits/2026-06-12-deep-clean.md` following the template in the deep-clean skill (summary, findings-by-category tables with fixes, test impact, new modules, not-addressed list including: deferred security-hardening minors, about-image S3 orphans, serialized uploads, unbounded messages page, and the deploy-time step `drizzle-kit push` for migrations 0002/0003). Commit.

---

## Deferred (intentionally not in this plan)

- Security-hardening minors: social-link scheme validation, login timing equalization, client-supplied `s3Key` shape validation, session-token hashing, CSP header — consistent with prior audits' posture for a single-admin site.
- About-image S3 orphan cleanup; bounded-concurrency uploads; messages-page pagination; galleries-index cover projection.
- Applying migrations 0002/0003 to production (`drizzle-kit push`) — deploy-time step, no DB access from the sandbox.

## Self-review notes

- Type consistency checked: `displayUrl` flows schema → `toPublicImage` → `PublicGalleryImage` → lightbox; `HomepageGridImage` drops both `cdnUrl` and `displayUrl`; Task 6's component PUT matches Task 6's route rename (same commit).
- Task-order dependencies: 2 before 4 (ObjectTooLargeError import in images route), 3 before 4 (`display` buffer), 4 before 5 (tests reference `displayUrl`), 6 before 9 (both touch `images/[id]/route.ts`; 9 deletes the guard the file still has after 6), 9 before 11 (11 edits routes 9 simplified), 10 before 11 (11's revalidate sweep must not touch the deleted messages GET).

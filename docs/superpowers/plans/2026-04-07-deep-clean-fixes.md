# Deep Clean Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 27 findings from the 2026-04-07 deep clean audit across architecture, security, performance, code quality, test quality, documentation, and data flow.

**Architecture:** Sequential tasks, one commit per task. Tasks are ordered by dependency — shared utilities first, then consumers, then tests. Each task runs `npx tsc --noEmit && pnpm lint && pnpm test` after completion.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM (libsql/Turso), React 19, Vitest, sharp, AWS S3

---

## File Structure

### New files
- `src/lib/settings.ts` — cached settings accessor + socialLinks parser + SETTINGS_ID constant
- `src/lib/__tests__/settings.test.ts` — tests for settings helpers
- `src/middleware.ts` — renamed from `src/proxy.ts`

### Modified files
- `src/lib/auth.ts` — simplify `validateSession` signature, add `Max-Age` to cookie, export `SESSION_DURATION_MS`
- `src/lib/slugify.ts` — guard empty input
- `src/lib/images.ts` — single sharp pipeline
- `src/lib/s3.ts` — no changes needed (getCdnUrl tested via new test)
- `src/lib/__tests__/auth.test.ts` — add `validateSession` tests, cookie Max-Age assertion
- `src/lib/__tests__/slugify.test.ts` — add edge case tests
- `src/lib/__tests__/s3.test.ts` — add `getCdnUrl` test
- `src/lib/__tests__/images.test.ts` — add square image test
- `src/db/schema.ts` — remove `homepageHeroImageUrl`
- `src/db/__tests__/seed.test.ts` — rename to clarify scope
- `src/app/admin/(authenticated)/layout.tsx` — delegate to `validateSession`
- `src/app/api/admin/galleries/[id]/route.ts` — existence check before update, slug uniqueness
- `src/app/api/admin/galleries/route.ts` — batch reorder
- `src/app/api/admin/galleries/[id]/images/route.ts` — batch reorder
- `src/app/api/admin/images/assign/route.ts` — batch assign
- `src/app/api/admin/messages/[id]/route.ts` — existence check before update, validate `isRead`
- `src/app/api/admin/settings/route.ts` — accept only string for socialLinks
- `src/app/(public)/layout.tsx` — use cached settings, remove force-dynamic
- `src/app/(public)/page.tsx` — use cached settings, use thumbnailUrl
- `src/app/(public)/about/page.tsx` — use cached settings
- `src/app/(public)/contact/page.tsx` — use cached settings, show contactEmail
- `src/app/(public)/contact/actions.ts` — use SETTINGS_ID constant
- `src/components/admin/settings-form.tsx` — use shared SocialLink type
- `src/components/admin/image-uploader.tsx` — stable upload IDs, rejected file feedback
- `src/proxy.ts` — deleted (renamed to middleware.ts)
- `next.config.ts` — add security headers

---

## Chunk 1: Shared Utilities & Auth

### Task 1: Create cached settings accessor and constants

Extracts `SETTINGS_ID`, `SocialLink` type, `parseSocialLinks`, and a React `cache()`-wrapped `getSettings` function into a shared module. This is a dependency for many later tasks.

**Files:**
- Create: `src/lib/settings.ts`
- Create: `src/lib/__tests__/settings.test.ts`

- [ ] **Step 1: Write the test file**

```ts
// src/lib/__tests__/settings.test.ts
import { describe, it, expect } from "vitest";
import { parseSocialLinks, SETTINGS_ID } from "../settings";

describe("SETTINGS_ID", () => {
  it("is 'default'", () => {
    expect(SETTINGS_ID).toBe("default");
  });
});

describe("parseSocialLinks", () => {
  it("parses valid JSON array", () => {
    const result = parseSocialLinks('[{"platform":"ig","url":"https://ig.com"}]');
    expect(result).toEqual([{ platform: "ig", url: "https://ig.com" }]);
  });

  it("returns empty array for empty JSON array", () => {
    expect(parseSocialLinks("[]")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseSocialLinks("not-json")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseSocialLinks("")).toEqual([]);
  });

  it("returns empty array for undefined/null input", () => {
    expect(parseSocialLinks(undefined)).toEqual([]);
    expect(parseSocialLinks(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/__tests__/settings.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/settings.ts
import { cache } from "react";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const SETTINGS_ID = "default";

export type SocialLink = {
  platform: string;
  url: string;
};

export function parseSocialLinks(raw: string | null | undefined): SocialLink[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export const getSettings = cache(async () => {
  return db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, SETTINGS_ID),
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/__tests__/settings.test.ts`
Expected: PASS

- [ ] **Step 5: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 6: Commit**

```bash
git add src/lib/settings.ts src/lib/__tests__/settings.test.ts
git commit -m "feat: add cached settings accessor and parseSocialLinks helper"
```

---

### Task 2: Simplify `validateSession` signature and add `Max-Age` to cookie

Removes the 3 injected params (`db`, `table`, `eqFn`) from `validateSession` — all 12 call sites pass the same values. Adds `Max-Age` to the session cookie.

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/__tests__/auth.test.ts`
- Modify: All API routes that call `validateSession` (12 files)
- Modify: `src/app/admin/(authenticated)/layout.tsx`

- [ ] **Step 1: Add tests for cookie Max-Age and simplified validateSession**

Add to `src/lib/__tests__/auth.test.ts`:

```ts
// Add to the createSessionCookie describe block:
it("includes Max-Age for non-clearing cookie", () => {
  const cookie = createSessionCookie("abc123");
  expect(cookie).toContain("Max-Age=604800");
  expect(cookie).not.toContain("Max-Age=0");
});
```

- [ ] **Step 2: Run tests to verify new test fails**

Run: `pnpm test src/lib/__tests__/auth.test.ts`
Expected: FAIL — cookie does not contain Max-Age

- [ ] **Step 3: Update `src/lib/auth.ts`**

Changes:
1. Add `Max-Age=604800` (7 days in seconds) to the non-clearing cookie in `createSessionCookie`
2. Change `validateSession` to import `db`, `sessions`, and `eq` directly instead of taking them as params
3. Accept `cookieHeader: string | null` instead of `request` object (simpler interface, usable from both API routes and layout)

```ts
// src/lib/auth.ts
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";

const COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_DURATION_SECONDS = Math.floor(SESSION_DURATION_MS / 1000);

export function createSessionCookie(sessionId: string): string {
  if (!sessionId) {
    return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
  }
  return `${COOKIE_NAME}=${sessionId}; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name.trim() === COOKIE_NAME) {
      const value = rest.join("=").trim();
      return value || null;
    }
  }
  return null;
}

export function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function getNewExpiresAt(): string {
  return new Date(Date.now() + SESSION_DURATION_MS).toISOString();
}

/**
 * Validates a session from a cookie header string.
 * Returns the sessionId if valid, null otherwise.
 */
export async function validateSession(
  request: { headers: { get(name: string): string | null } },
): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie");
  const sessionId = parseSessionCookie(cookieHeader);
  if (!sessionId) return null;

  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const session = rows[0];
  if (!session) return null;

  if (isSessionExpired(session.expiresAt)) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  // Refresh the session expiry
  await db
    .update(sessions)
    .set({ expiresAt: getNewExpiresAt() })
    .where(eq(sessions.id, sessionId));

  return sessionId;
}
```

- [ ] **Step 4: Update admin layout to delegate to `validateSession`**

Replace the inline session logic in `src/app/admin/(authenticated)/layout.tsx` with:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth";
import AdminNav from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const sessionId = await validateSession({
    headers: { get: (name: string) => name === "cookie" ? cookieHeader : null },
  });

  if (!sessionId) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Update all API route `validateSession` call sites**

Remove `db, sessions, eq` from every `validateSession(request, db, sessions, eq)` call, leaving just `validateSession(request)`. Update imports to remove unused `sessions` import where it was only used for the validateSession call.

Files to update (replace `validateSession(request, db, sessions, eq)` with `validateSession(request)` and clean up imports):
- `src/app/api/admin/galleries/route.ts`
- `src/app/api/admin/galleries/[id]/route.ts`
- `src/app/api/admin/galleries/[id]/images/route.ts`
- `src/app/api/admin/images/route.ts`
- `src/app/api/admin/images/assign/route.ts`
- `src/app/api/admin/images/upload-url/route.ts`
- `src/app/api/admin/images/[id]/route.ts`
- `src/app/api/admin/messages/route.ts`
- `src/app/api/admin/messages/[id]/route.ts`
- `src/app/api/admin/settings/route.ts`
- `src/app/api/admin/auth/logout/route.ts`

Note: Keep `sessions` import in files that use it for other queries (e.g., login route). Remove it from files that only imported it for `validateSession`.

- [ ] **Step 6: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: simplify validateSession signature, add Max-Age to session cookie

Removes injected db/sessions/eq params — all callers passed identical values.
Adds Max-Age=604800 so browser knows the 7-day intent.
Admin layout now delegates to validateSession instead of reimplementing."
```

---

### Task 3: Rename `proxy.ts` to `middleware.ts`

**Files:**
- Delete: `src/proxy.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Create `src/middleware.ts`**

```ts
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseSessionCookie } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip login page and auth API routes
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth/")
  ) {
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get("cookie");
  const sessionId = parseSessionCookie(cookieHeader);

  if (!sessionId) {
    // API routes get a 401 JSON response
    if (pathname.startsWith("/api/admin")) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Admin pages redirect to login
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

- [ ] **Step 2: Delete `src/proxy.ts`**

```bash
rm src/proxy.ts
```

- [ ] **Step 3: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git rm src/proxy.ts
git commit -m "fix: rename proxy.ts to middleware.ts so Next.js actually runs it

The file was named proxy.ts with export function proxy — Next.js requires
middleware.ts with export function middleware. The edge auth layer was dead code."
```

---

## Chunk 2: Security & Validation Fixes

### Task 4: Add security headers to `next.config.ts`

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Update `next.config.ts`**

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: process.env.CLOUDFRONT_DOMAIN
      ? [
          {
            protocol: "https" as const,
            hostname: process.env.CLOUDFRONT_DOMAIN,
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "security: add X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy headers"
```

---

### Task 5: Fix validation in PUT routes — existence checks, isRead, slug uniqueness

**Files:**
- Modify: `src/app/api/admin/galleries/[id]/route.ts`
- Modify: `src/app/api/admin/messages/[id]/route.ts`

- [ ] **Step 1: Fix gallery PUT — check existence before update, add slug uniqueness check**

In `src/app/api/admin/galleries/[id]/route.ts`, rewrite the PUT handler:

```ts
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Check existence first
  const existing = await db
    .select()
    .from(galleries)
    .where(eq(galleries.id, id))
    .limit(1);

  if (!existing[0]) {
    return Response.json({ error: "Gallery not found" }, { status: 404 });
  }

  let body: {
    title?: string;
    slug?: string;
    description?: string;
    isPublished?: number;
    coverImageId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Slug uniqueness check
  if (body.slug !== undefined && body.slug !== existing[0].slug) {
    const slugConflict = await db
      .select({ id: galleries.id })
      .from(galleries)
      .where(eq(galleries.slug, body.slug))
      .limit(1);
    if (slugConflict.length > 0) {
      return Response.json(
        { error: "A gallery with this slug already exists" },
        { status: 409 },
      );
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.description !== undefined) updates.description = body.description;
  if (body.isPublished !== undefined) updates.isPublished = body.isPublished;
  if (body.coverImageId !== undefined) updates.coverImageId = body.coverImageId;

  await db.update(galleries).set(updates).where(eq(galleries.id, id));

  const rows = await db
    .select()
    .from(galleries)
    .where(eq(galleries.id, id))
    .limit(1);

  return Response.json(rows[0]);
}
```

- [ ] **Step 2: Fix messages PUT — check existence before update, validate isRead**

In `src/app/api/admin/messages/[id]/route.ts`, rewrite the PUT handler:

```ts
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Check existence first
  const existing = await db
    .select()
    .from(contactSubmissions)
    .where(eq(contactSubmissions.id, id))
    .limit(1);

  if (!existing[0]) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  let body: { isRead?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.isRead === undefined) {
    return Response.json({ error: "isRead is required" }, { status: 400 });
  }

  if (body.isRead !== 0 && body.isRead !== 1) {
    return Response.json({ error: "isRead must be 0 or 1" }, { status: 400 });
  }

  await db
    .update(contactSubmissions)
    .set({ isRead: body.isRead })
    .where(eq(contactSubmissions.id, id));

  return Response.json({ ...existing[0], isRead: body.isRead });
}
```

- [ ] **Step 3: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/galleries/[id]/route.ts src/app/api/admin/messages/[id]/route.ts
git commit -m "fix: check existence before update, validate isRead, add slug uniqueness on gallery edit"
```

---

### Task 6: Batch reorder/assign operations

Replaces sequential `await` in loops with `Promise.all` for the 3 endpoints.

**Files:**
- Modify: `src/app/api/admin/galleries/route.ts` (PUT handler, lines 86-91)
- Modify: `src/app/api/admin/galleries/[id]/images/route.ts` (PUT handler, lines 27-32)
- Modify: `src/app/api/admin/images/assign/route.ts` (PUT handler, lines 27-32)

- [ ] **Step 1: Update gallery reorder — `src/app/api/admin/galleries/route.ts`**

Replace the for loop (lines 86-91) with:

```ts
  const now = new Date().toISOString();

  await Promise.all(
    order.map((item) =>
      db
        .update(galleries)
        .set({ sortOrder: item.sortOrder, updatedAt: now })
        .where(eq(galleries.id, item.id))
    )
  );
```

- [ ] **Step 2: Update image reorder — `src/app/api/admin/galleries/[id]/images/route.ts`**

Replace the for loop (lines 27-32) with:

```ts
  await Promise.all(
    order.map((item) =>
      db
        .update(images)
        .set({ sortOrder: item.sortOrder })
        .where(eq(images.id, item.id))
    )
  );
```

- [ ] **Step 3: Update image assign — `src/app/api/admin/images/assign/route.ts`**

Replace the for loop (lines 27-32) with:

```ts
  await Promise.all(
    imageIds.map((imageId) =>
      db
        .update(images)
        .set({ galleryId: galleryId ?? null })
        .where(eq(images.id, imageId))
    )
  );
```

- [ ] **Step 4: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/galleries/route.ts src/app/api/admin/galleries/[id]/images/route.ts src/app/api/admin/images/assign/route.ts
git commit -m "perf: batch reorder/assign DB operations with Promise.all

Replaces sequential await-in-loop with parallel Promise.all for gallery
reorder, image reorder, and image assign endpoints."
```

---

## Chunk 3: Public Site & Data Flow

### Task 7: Wire up cached settings across public pages, remove force-dynamic, fix homepage thumbnail

**Files:**
- Modify: `src/app/(public)/layout.tsx`
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/about/page.tsx`
- Modify: `src/app/(public)/contact/page.tsx`
- Modify: `src/app/(public)/contact/actions.ts`

- [ ] **Step 1: Update public layout**

```tsx
// src/app/(public)/layout.tsx
import { Nav } from "@/components/public/nav";
import { Footer } from "@/components/public/footer";
import { getSettings, parseSocialLinks } from "@/lib/settings";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const socialLinks = parseSocialLinks(settings?.socialLinks);

  return (
    <>
      <Nav />
      {children}
      <Footer socialLinks={socialLinks} />
    </>
  );
}
```

Note: `force-dynamic` is removed. The `getSettings` call uses React `cache()` so it deduplicates across layout + page within a single render. Pages that need fresh data can set their own `dynamic` export.

- [ ] **Step 2: Update home page — use cached settings, use thumbnailUrl**

```tsx
// src/app/(public)/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { getPublishedGalleriesWithCovers } from "@/lib/galleries";
import { getSettings } from "@/lib/settings";

export default async function HomePage() {
  const galleriesWithCovers = await getPublishedGalleriesWithCovers();
  const settings = await getSettings();

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <div className="text-center mb-12">
          <h1 className="font-heading text-3xl text-gray-900 tracking-wide">Mindy Hu</h1>
          {settings?.tagline && (
            <p className="text-xs text-gray-400 tracking-widest mt-2">
              {settings.tagline.toUpperCase()}
            </p>
          )}
        </div>
        {galleriesWithCovers.length === 0 ? (
          <p className="text-center text-sm text-gray-400">Portfolio coming soon.</p>
        ) : (
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {galleriesWithCovers.map((gallery) => (
              <Link
                key={gallery.id}
                href={`/portfolio/${gallery.slug}`}
                className="group block"
              >
                {gallery.coverImage ? (
                  <div className="relative overflow-hidden">
                    <Image
                      src={gallery.coverImage.thumbnailUrl}
                      alt={gallery.coverImage.altText || gallery.title}
                      width={gallery.coverImage.width}
                      height={gallery.coverImage.height}
                      className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-100 aspect-[4/3]" />
                )}
                <h2 className="text-xs text-gray-500 tracking-widest mt-3">
                  {gallery.title.toUpperCase()}
                </h2>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

Key changes: `force-dynamic` moved to this page (it fetches gallery data that changes), `thumbnailUrl` replaces `cdnUrl`, `getSettings()` replaces direct DB query.

- [ ] **Step 3: Update about page**

```tsx
// src/app/(public)/about/page.tsx
export const dynamic = "force-dynamic";

import Image from "next/image";
import { getSettings } from "@/lib/settings";

export default async function AboutPage() {
  const settings = await getSettings();

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-12 items-start">
          {settings?.aboutImageUrl && (
            <div className="w-full md:w-1/2 flex-shrink-0 relative aspect-[3/4]">
              <Image
                src={settings.aboutImageUrl}
                alt="Mindy Hu"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-heading text-2xl text-gray-900 mb-6">About</h1>
            {settings?.aboutText ? (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {settings.aboutText}
              </p>
            ) : (
              <p className="text-sm text-gray-400">About section coming soon.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update contact page — show contactEmail when form disabled**

```tsx
// src/app/(public)/contact/page.tsx
import { getSettings } from "@/lib/settings";
import { ContactForm } from "@/components/public/contact-form";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <div className="text-center mb-10">
          <h1 className="font-heading text-2xl text-gray-900">Contact</h1>
          <p className="text-sm text-gray-500 mt-2">
            Interested in booking a session? I&apos;d love to hear from you.
          </p>
        </div>
        {settings?.contactFormEnabled ? (
          <ContactForm />
        ) : (
          <p className="text-center text-sm text-gray-400">
            Contact form is currently unavailable.
            {settings?.contactEmail && (
              <> Please reach out at{" "}
                <a href={`mailto:${settings.contactEmail}`} className="text-gray-600 underline">
                  {settings.contactEmail}
                </a>.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update contact actions — use SETTINGS_ID**

In `src/app/(public)/contact/actions.ts`, replace `eq(siteSettings.id, "default")` with:

```ts
import { SETTINGS_ID } from "@/lib/settings";
// ...
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, SETTINGS_ID),
  });
```

- [ ] **Step 6: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 7: Commit**

```bash
git add src/app/\(public\) src/lib/settings.ts
git commit -m "refactor: use cached settings accessor across public pages

- Deduplicates siteSettings queries within a single render via React cache()
- Removes force-dynamic from layout (moved to individual pages that need it)
- Homepage now uses thumbnailUrl instead of full-res cdnUrl
- Contact page shows contactEmail when form is disabled
- All pages use SETTINGS_ID constant instead of magic 'default' string"
```

---

## Chunk 4: Code Quality & Minor Fixes

### Task 8: Clean up socialLinks handling and settings form

**Files:**
- Modify: `src/components/admin/settings-form.tsx`
- Modify: `src/app/api/admin/settings/route.ts`

- [ ] **Step 1: Update settings form to use shared SocialLink type**

In `src/components/admin/settings-form.tsx`:
- Replace local `SocialLink` type with import: `import { parseSocialLinks, type SocialLink } from "@/lib/settings";`
- Replace the IIFE parsing block (lines 32-38) with: `const parsedLinks = parseSocialLinks(settings.socialLinks);`

- [ ] **Step 2: Simplify settings API route — remove dead string|array branch**

In `src/app/api/admin/settings/route.ts`, the socialLinks handling (lines 35-39) has a dead branch for array input. The client always sends a string. Simplify:

```ts
  if (body.socialLinks !== undefined) {
    updates.socialLinks = body.socialLinks;
  }
```

And change the type from `socialLinks?: string | string[]` to `socialLinks?: string`.

- [ ] **Step 3: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/settings-form.tsx src/app/api/admin/settings/route.ts
git commit -m "refactor: use shared parseSocialLinks helper, remove dead array branch in settings API"
```

---

### Task 9: Fix image uploader — stable IDs and rejected file feedback

**Files:**
- Modify: `src/components/admin/image-uploader.tsx`

- [ ] **Step 1: Add stable IDs and rejection feedback**

Key changes:
1. Add `id: string` to `UploadState` type (using `crypto.randomUUID()`)
2. Use `id` instead of array index to find/update entries
3. Add rejected file entries with status `"error"` for invalid MIME types

```tsx
type UploadState = {
  id: string;
  filename: string;
  status: "pending" | "uploading" | "registering" | "done" | "error";
  error?: string;
};
```

In `processFiles`:

```tsx
const processFiles = useCallback(
  async (files: File[]) => {
    const validFiles: File[] = [];
    const rejectedUploads: UploadState[] = [];

    for (const f of files) {
      if (!ACCEPTED_TYPES.has(f.type)) {
        rejectedUploads.push({
          id: crypto.randomUUID(),
          filename: f.name,
          status: "error",
          error: "Unsupported file type",
        });
      } else {
        validFiles.push(f);
      }
    }

    if (validFiles.length === 0 && rejectedUploads.length === 0) return;

    // Warn about large files
    const largeFiles = validFiles.filter((f) => f.size > SIZE_WARNING_BYTES);
    if (largeFiles.length > 0) {
      const names = largeFiles.map((f) => f.name).join(", ");
      const ok = window.confirm(
        `The following files are over 20MB and may take a while to upload:\n\n${names}\n\nContinue?`,
      );
      if (!ok) return;
    }

    const newUploads: UploadState[] = validFiles.map((f) => ({
      id: crypto.randomUUID(),
      filename: f.name,
      status: "pending",
    }));

    setUploads((prev) => [...prev, ...rejectedUploads, ...newUploads]);

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const uploadId = newUploads[i].id;

      const update = (patch: Partial<UploadState>) => {
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, ...patch } : u)),
        );
      };

      try {
        update({ status: "uploading" });
        const presignRes = await fetch("/api/admin/images/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
          }),
        });

        if (!presignRes.ok) {
          const data = await presignRes.json();
          update({ status: "error", error: data.error ?? "Presign failed" });
          continue;
        }

        const { uploadUrl, imageId, s3Key, ext } = await presignRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          update({ status: "error", error: "S3 upload failed" });
          continue;
        }

        update({ status: "registering" });
        const registerRes = await fetch("/api/admin/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageId, s3Key, ext, filename: file.name }),
        });

        if (!registerRes.ok) {
          const data = await registerRes.json();
          update({
            status: "error",
            error: data.error ?? "Registration failed",
          });
          continue;
        }

        update({ status: "done" });
      } catch {
        update({ status: "error", error: "Network error" });
      }
    }

    router.refresh();
  },
  [router],
);
```

Also update the render to use `u.id` as key instead of index: `key={u.id}`.

- [ ] **Step 2: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/image-uploader.tsx
git commit -m "fix: use stable IDs in image uploader, show rejected file feedback

Fixes stale closure bug where concurrent batch drops computed overlapping
indices. Rejected files now show an error status instead of being silently dropped."
```

---

### Task 10: Optimize `processImage` to use single sharp pipeline

**Files:**
- Modify: `src/lib/images.ts`

- [ ] **Step 1: Rewrite to single pipeline**

```ts
import sharp from "sharp";

interface ProcessedImage {
  width: number;
  height: number;
  thumbnail: Buffer;
}

const THUMBNAIL_MAX_EDGE = 800;
const THUMBNAIL_QUALITY = 80;

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const longEdge = Math.max(width, height);
  const needsResize = longEdge > THUMBNAIL_MAX_EDGE;

  let thumbnailPipeline = image.clone();

  if (needsResize) {
    if (width >= height) {
      thumbnailPipeline = thumbnailPipeline.resize(THUMBNAIL_MAX_EDGE, null, {
        withoutEnlargement: true,
      });
    } else {
      thumbnailPipeline = thumbnailPipeline.resize(null, THUMBNAIL_MAX_EDGE, {
        withoutEnlargement: true,
      });
    }
  }

  const thumbnail = await thumbnailPipeline
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  return { width, height, thumbnail };
}
```

Key change: `sharp(buffer).rotate()` is called once, then `.clone()` is used for the thumbnail pipeline instead of creating a second `sharp(buffer).rotate()`.

- [ ] **Step 2: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 3: Commit**

```bash
git add src/lib/images.ts
git commit -m "perf: use single sharp pipeline with clone() instead of decoding buffer twice"
```

---

### Task 11: Remove dead `homepageHeroImageUrl` from schema

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/seed.ts`

- [ ] **Step 1: Remove column from schema**

In `src/db/schema.ts`, delete line 23: `homepageHeroImageUrl: text("homepage_hero_image_url"),`

- [ ] **Step 2: Remove from seed if present**

Check `src/db/seed.ts` and remove any `homepageHeroImageUrl` field from the seed values.

- [ ] **Step 3: Run full quality gate**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts src/db/seed.ts
git commit -m "chore: remove unused homepageHeroImageUrl from schema

Column was defined and seeded but never read or written by any code path."
```

---

## Chunk 5: Test Quality

### Task 12: Add edge case tests for `slugify`

**Files:**
- Modify: `src/lib/__tests__/slugify.test.ts`

- [ ] **Step 1: Add edge case tests**

Add to `src/lib/__tests__/slugify.test.ts`:

```ts
it("returns empty string for empty input", () => {
  expect(slugify("")).toBe("");
});

it("returns empty string for whitespace-only input", () => {
  expect(slugify("   ")).toBe("");
});

it("returns empty string for all-special-characters input", () => {
  expect(slugify("!!!@@@###")).toBe("");
});
```

- [ ] **Step 2: Run test to verify it passes** (current implementation handles these correctly, returning "")

Run: `pnpm test src/lib/__tests__/slugify.test.ts`
Expected: PASS — the current regex-based implementation already produces "" for these inputs

Note: The empty-string-produces-empty-slug issue is a gallery creation concern (Task 5 already validates `title` is non-empty, so `slugify("")` is unreachable in practice). The tests document the behavior.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/slugify.test.ts
git commit -m "test: add edge case tests for slugify (empty, whitespace, special chars)"
```

---

### Task 13: Add `getCdnUrl` test and square image test

**Files:**
- Modify: `src/lib/__tests__/s3.test.ts`
- Modify: `src/lib/__tests__/images.test.ts`

- [ ] **Step 1: Add getCdnUrl test**

In `src/lib/__tests__/s3.test.ts`, add:

```ts
import { getS3Key, getThumbnailKey, getCdnUrl } from "../s3";
import { beforeEach, afterEach } from "vitest";

// At the top of the file, before any describe blocks:
const originalCloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;

beforeEach(() => {
  // getCdnUrl uses a lazily-cached module variable, so we set the env var
  // before any calls. The module is freshly imported per test file.
  process.env.CLOUDFRONT_DOMAIN = "cdn.example.com";
});

afterEach(() => {
  if (originalCloudfrontDomain) {
    process.env.CLOUDFRONT_DOMAIN = originalCloudfrontDomain;
  } else {
    delete process.env.CLOUDFRONT_DOMAIN;
  }
});

// At the end, add this describe block:
describe("getCdnUrl", () => {
  it("constructs CloudFront URL from key", () => {
    expect(getCdnUrl("originals/abc.jpg")).toBe("https://cdn.example.com/originals/abc.jpg");
  });
});
```

- [ ] **Step 2: Add square image test**

In `src/lib/__tests__/images.test.ts`, add:

```ts
it("resizes square image to 800px on width (>= branch)", async () => {
  const input = await createTestImage(1200, 1200);
  const result = await processImage(input);

  expect(result.width).toBe(1200);
  expect(result.height).toBe(1200);

  const thumbMeta = await sharp(result.thumbnail).metadata();
  expect(thumbMeta.width).toBe(800);
  expect(thumbMeta.height).toBe(800);
  expect(thumbMeta.format).toBe("webp");
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test src/lib/__tests__/s3.test.ts src/lib/__tests__/images.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/__tests__/s3.test.ts src/lib/__tests__/images.test.ts
git commit -m "test: add getCdnUrl test and square image branch coverage"
```

---

### Task 14: Rename seed.test.ts and add cookie negative assertion

**Files:**
- Rename: `src/db/__tests__/seed.test.ts` -> `src/db/__tests__/bcrypt.test.ts`
- Modify: `src/lib/__tests__/auth.test.ts`

- [ ] **Step 1: Rename seed.test.ts**

```bash
git mv src/db/__tests__/seed.test.ts src/db/__tests__/bcrypt.test.ts
```

Update the describe label inside the file from `"seed: bcrypt hashing"` to `"bcrypt hashing"`.

- [ ] **Step 2: Add negative assertion for cookie Max-Age**

In `src/lib/__tests__/auth.test.ts`, in the "creates a cookie with the session ID" test, add:

```ts
expect(cookie).not.toContain("Max-Age=0");
```

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: PASS (all 21+ tests)

- [ ] **Step 4: Commit**

```bash
git add src/db/__tests__/bcrypt.test.ts src/lib/__tests__/auth.test.ts
git rm src/db/__tests__/seed.test.ts
git commit -m "test: rename seed.test.ts to bcrypt.test.ts, add Max-Age negative assertion

seed.test.ts tested bcryptjs, not the seed script — name was misleading."
```

---

### Task 15: Update spec rate-limiting description

**Files:**
- Modify: `docs/superpowers/specs/2026-03-24-mindy-hu-portfolio-design.md`

- [ ] **Step 1: Fix rate limiting description**

Find the line that says "per IP per hour" and change to "per email per hour" to match the implementation.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-03-24-mindy-hu-portfolio-design.md
git commit -m "docs: fix spec — rate limiting is per email, not per IP"
```

---

## Quality Gate

After all tasks: run `npx tsc --noEmit && pnpm lint && npx knip && pnpm test` to confirm full baseline passes.

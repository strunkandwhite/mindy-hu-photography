# Mindy Hu Photography Portfolio — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a photography portfolio site with a custom CMS so Mindy can manage her own content.

**Architecture:** Next.js 16 App Router with a Turso/Drizzle database backend. Images stored in S3 with CloudFront CDN delivery. Admin panel behind session-based auth. Public pages server-rendered from the database.

**Tech Stack:** Next.js 16, Drizzle ORM, Turso (libSQL), AWS S3, CloudFront, Sharp, Tailwind CSS v4, @dnd-kit, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-24-mindy-hu-portfolio-design.md`

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout — fonts, Tailwind, metadata
│   ├── (public)/
│   │   ├── layout.tsx                # Public layout — nav + footer with settings fetch
│   │   ├── page.tsx                  # Homepage — gallery-first grid
│   │   ├── portfolio/
│   │   │   ├── page.tsx              # Portfolio — gallery grid
│   │   │   └── [slug]/
│   │   │       └── page.tsx          # Gallery detail — masonry + lightbox
│   │   ├── about/
│   │   │   └── page.tsx              # About page
│   │   └── contact/
│   │       ├── page.tsx              # Contact form
│   │       └── actions.ts            # Server action: submit contact form
│   ├── admin/
│   │   ├── layout.tsx                # Admin layout — sidebar nav, auth gate
│   │   ├── page.tsx                  # Dashboard — stats + recent messages
│   │   ├── login/
│   │   │   └── page.tsx              # Login page
│   │   ├── galleries/
│   │   │   ├── page.tsx              # Gallery list + reorder
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # Create gallery form
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Edit gallery + manage images
│   │   ├── images/
│   │   │   └── page.tsx              # Unsorted pool + upload
│   │   ├── settings/
│   │   │   └── page.tsx              # Site settings form
│   │   └── messages/
│   │       └── page.tsx              # Contact submissions list
│   └── api/
│       └── admin/
│           ├── auth/
│           │   ├── login/route.ts    # POST: login
│           │   └── logout/route.ts   # POST: logout
│           ├── galleries/
│           │   ├── route.ts          # POST: create, PUT: reorder
│           │   └── [id]/
│           │       ├── route.ts      # PUT: update, DELETE: delete
│           │       └── images/
│           │           └── route.ts  # PUT: reorder images, set cover
│           ├── images/
│           │   ├── route.ts          # POST: register, DELETE: delete
│           │   ├── upload-url/
│           │   │   └── route.ts      # POST: presigned URL
│           │   └── assign/
│           │       └── route.ts      # PUT: bulk assign to gallery
│           ├── settings/
│           │   └── route.ts          # PUT: update site settings
│           └── messages/
│               ├── route.ts          # GET: list
│               └── [id]/
│                   └── route.ts      # PUT: mark read, DELETE: delete
├── components/
│   ├── public/
│   │   ├── nav.tsx                   # Floating "MH" nav
│   │   ├── footer.tsx                # Social links + copyright
│   │   ├── gallery-grid.tsx          # Masonry grid component
│   │   ├── lightbox.tsx              # Full-screen image viewer
│   │   └── contact-form.tsx          # Contact form client component
│   └── admin/
│       ├── admin-nav.tsx             # Admin sidebar navigation
│       ├── image-uploader.tsx        # Drag-and-drop upload zone
│       ├── image-grid.tsx            # Selectable image grid
│       ├── gallery-form.tsx          # Create/edit gallery form
│       ├── sortable-list.tsx         # Generic dnd-kit sortable wrapper
│       └── settings-form.tsx         # Site settings form
├── db/
│   ├── client.ts                     # Turso/Drizzle client singleton
│   ├── schema.ts                     # Drizzle schema definitions
│   └── seed.ts                       # CLI seed script for admin user
├── lib/
│   ├── auth.ts                       # Session validation, cookie helpers
│   ├── s3.ts                         # S3 client, presigned URL generation
│   ├── images.ts                     # Sharp processing, thumbnail gen
│   ├── slugify.ts                    # Title → kebab-case slug
│   └── galleries.ts                  # Shared gallery queries (with covers)
├── middleware.ts                      # Admin route protection
drizzle.config.ts                     # Drizzle Kit config for migrations
```

---

## Chunk 1: Project Scaffolding & Database

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.css`, `.gitignore`, `.env.example`

- [ ] **Step 1: Scaffold Next.js with Tailwind**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbopack
```

Accept defaults. This creates the Next.js 16 project in the current directory.

- [ ] **Step 2: Clean up boilerplate**

Remove default page content from `src/app/page.tsx` and `src/app/layout.tsx`. Strip the default globals CSS down to just the Tailwind import.

`src/app/page.tsx`:
```tsx
export default function HomePage() {
  return <div>Mindy Hu Photography</div>;
}
```

`src/app/globals.css` — replace contents with:
```css
@import "tailwindcss";
```

- [ ] **Step 3: Create .env.example**

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket
CLOUDFRONT_DOMAIN=your-distribution.cloudfront.net
```

Add `.env` and `.env.local` to `.gitignore` (should already be there from create-next-app).

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```

Visit `http://localhost:3000` — should see "Mindy Hu Photography".

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Initialize Next.js 16 project with Tailwind v4"
```

---

### Task 2: Set Up Drizzle ORM with Turso

**Files:**
- Create: `src/db/client.ts`, `src/db/schema.ts`, `drizzle.config.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm install drizzle-orm @libsql/client
npm install -D drizzle-kit
```

- [ ] **Step 2: Create Drizzle config**

`drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
```

- [ ] **Step 3: Create database client**

`src/db/client.ts`:
```ts
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

- [ ] **Step 4: Define database schema**

`src/db/schema.ts`:
```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const adminUser = sqliteTable("admin_user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  adminUserId: text("admin_user_id")
    .notNull()
    .references(() => adminUser.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey(),
  siteTitle: text("site_title").notNull(),
  tagline: text("tagline").notNull().default(""),
  homepageHeroImageUrl: text("homepage_hero_image_url"),
  aboutText: text("about_text").notNull().default(""),
  aboutImageUrl: text("about_image_url"),
  contactEmail: text("contact_email").notNull().default(""),
  contactFormEnabled: integer("contact_form_enabled").notNull().default(1),
  socialLinks: text("social_links").notNull().default("[]"),
});

export const galleries = sqliteTable("galleries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  coverImageId: text("cover_image_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: integer("is_published").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  galleryId: text("gallery_id").references(() => galleries.id),
  filename: text("filename").notNull(),
  s3Key: text("s3_key").notNull(),
  cdnUrl: text("cdn_url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const contactSubmissions = sqliteTable("contact_submissions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  sessionType: text("session_type").notNull(),
  isRead: integer("is_read").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
```

Note: `galleries.coverImageId` does not use `.references(() => images.id)` to avoid a circular reference between `galleries` and `images`. The FK relationship is enforced at the application level.

- [ ] **Step 5: Generate and run initial migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Set up Drizzle ORM schema and Turso connection"
```

---

### Task 3: Admin User Seed Script

**Files:**
- Create: `src/db/seed.ts`
- Test: `src/db/__tests__/seed.test.ts`

- [ ] **Step 1: Install bcrypt**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Write seed script test**

`src/db/__tests__/seed.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";

describe("seed script", () => {
  it("hashes password with bcrypt", async () => {
    const password = "test-password-123";
    const hash = await bcrypt.hash(password, 10);
    const matches = await bcrypt.compare(password, hash);
    expect(matches).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await bcrypt.hash("correct", 10);
    const matches = await bcrypt.compare("wrong", hash);
    expect(matches).toBe(false);
  });
});
```

- [ ] **Step 3: Set up Vitest**

```bash
npm install -D vitest
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: both tests pass.

- [ ] **Step 5: Write seed script**

`src/db/seed.ts`:
```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { randomUUID } from "crypto";

async function seed() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: npx tsx src/db/seed.ts <email> <password>");
    process.exit(1);
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  const passwordHash = await bcrypt.hash(password, 10);

  await db.insert(schema.adminUser).values({
    id: randomUUID(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  await db.insert(schema.siteSettings).values({
    id: "default",
    siteTitle: "Mindy Hu",
    tagline: "Portrait Photography",
    contactEmail: email,
  });

  console.log(`Admin user created: ${email}`);
  console.log("Default site settings created.");
}

seed().catch(console.error);
```

Add to `package.json` scripts:
```json
"db:seed": "tsx src/db/seed.ts"
```

Install tsx:
```bash
npm install -D tsx
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add admin user seed script and Vitest setup"
```

---

## Chunk 2: Authentication System

### Task 4: Auth Library — Session Validation & Cookie Helpers

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/__tests__/auth.test.ts`

- [ ] **Step 1: Write auth helper tests**

`src/lib/__tests__/auth.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createSessionCookie, parseSessionCookie, isSessionExpired } from "../auth";

describe("auth helpers", () => {
  it("creates a cookie string with correct attributes", () => {
    const cookie = createSessionCookie("session-123");
    expect(cookie).toContain("session=session-123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/admin");
  });

  it("creates a clear cookie for logout", () => {
    const cookie = createSessionCookie("");
    expect(cookie).toContain("session=");
    expect(cookie).toContain("Max-Age=0");
  });

  it("parses session ID from cookie header", () => {
    const id = parseSessionCookie("session=abc-123; other=value");
    expect(id).toBe("abc-123");
  });

  it("returns null for missing session cookie", () => {
    const id = parseSessionCookie("other=value");
    expect(id).toBeNull();
  });

  it("detects expired sessions", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isSessionExpired(past)).toBe(true);
  });

  it("detects valid sessions", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isSessionExpired(future)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement auth helpers**

`src/lib/auth.ts`:
```ts
const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createSessionCookie(sessionId: string): string {
  if (!sessionId) {
    return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0`;
  }
  const maxAge = SESSION_DURATION_MS / 1000;
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=${maxAge}`;
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.split("=")[1];
  return value || null;
}

export function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

export function getNewExpiresAt(): string {
  return new Date(Date.now() + SESSION_DURATION_MS).toISOString();
}

/**
 * Validate session from request. Returns session ID or null.
 * Use in admin API routes for auth checks.
 */
export async function validateSession(
  request: Request,
  db: any,
  sessionsTable: any,
  eq: any
): Promise<string | null> {
  const sessionId = parseSessionCookie(request.headers.get("cookie"));
  if (!sessionId) return null;

  const session = await db.query.sessions.findFirst({
    where: eq(sessionsTable.id, sessionId),
  });

  if (!session || isSessionExpired(session.expiresAt)) return null;

  // Refresh session expiry
  await db
    .update(sessionsTable)
    .set({ expiresAt: getNewExpiresAt() })
    .where(eq(sessionsTable.id, sessionId));

  return sessionId;
}
```

**Note:** All `/api/admin/*` routes (except auth routes) must call `validateSession()` at the top and return 401 if null. Example pattern:

```ts
import { validateSession } from "@/lib/auth";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

// At the top of every admin API handler:
const sessionId = await validateSession(request, db, sessions, eq);
if (!sessionId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add session auth helpers with cookie management"
```

---

### Task 5: Login API Route

**Files:**
- Create: `src/app/api/admin/auth/login/route.ts`

- [ ] **Step 1: Implement login route**

`src/app/api/admin/auth/login/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { adminUser, sessions } from "@/db/schema";
import { eq, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { createSessionCookie, getNewExpiresAt } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await db.query.adminUser.findFirst({
    where: eq(adminUser.email, email),
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Lazy cleanup: delete expired sessions
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()));

  const sessionId = randomUUID();
  await db.insert(sessions).values({
    id: sessionId,
    adminUserId: user.id,
    expiresAt: getNewExpiresAt(),
    createdAt: new Date().toISOString(),
  });

  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", createSessionCookie(sessionId));
  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Add login API route with session creation"
```

---

### Task 6: Logout API Route

**Files:**
- Create: `src/app/api/admin/auth/logout/route.ts`

- [ ] **Step 1: Implement logout route**

`src/app/api/admin/auth/logout/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseSessionCookie, createSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get("cookie"));

  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", createSessionCookie(""));
  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Add logout API route"
```

---

### Task 7: Admin Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Implement middleware for admin route protection**

`src/middleware.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookie } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip login page and auth API routes
  if (pathname === "/admin/login" || pathname.startsWith("/api/admin/auth/")) {
    return NextResponse.next();
  }

  const sessionId = parseSessionCookie(request.headers.get("cookie"));

  if (!sessionId) {
    if (pathname.startsWith("/api/admin/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // Note: full session validation (DB lookup, expiry check, refresh) happens
  // in the admin layout server component, not middleware. Middleware only checks
  // cookie presence for a fast redirect on obvious non-auth.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Add middleware for admin route protection"
```

---

### Task 8: Login Page

**Files:**
- Create: `src/app/admin/login/page.tsx`

- [ ] **Step 1: Implement login page**

`src/app/admin/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      const data = await res.json();
      setError(data.error || "Login failed");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-heading text-center text-gray-900">Admin</h1>
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-gray-900 text-white text-sm tracking-wide hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify login page renders**

```bash
npm run dev
```

Visit `http://localhost:3000/admin/login` — should see the login form.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add admin login page"
```

---

## Chunk 3: S3 & Image Pipeline

### Task 9: S3 Client & Presigned URL Generation

**Files:**
- Create: `src/lib/s3.ts`
- Test: `src/lib/__tests__/s3.test.ts`

- [ ] **Step 1: Install AWS SDK**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Write S3 helper tests**

`src/lib/__tests__/s3.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getS3Key, getThumbnailKey } from "../s3";

describe("S3 key helpers", () => {
  it("generates correct original key", () => {
    expect(getS3Key("abc-123", "jpg")).toBe("originals/abc-123.jpg");
  });

  it("generates correct thumbnail key", () => {
    expect(getThumbnailKey("abc-123")).toBe("thumbnails/abc-123.webp");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test
```

- [ ] **Step 4: Implement S3 helpers**

`src/lib/s3.ts`:
```ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;
const CDN_DOMAIN = process.env.CLOUDFRONT_DOMAIN!;

export function getS3Key(imageId: string, ext: string): string {
  return `originals/${imageId}.${ext}`;
}

export function getThumbnailKey(imageId: string): string {
  return `thumbnails/${imageId}.webp`;
}

export function getCdnUrl(s3Key: string): string {
  return `https://${CDN_DOMAIN}/${s3Key}`;
}

export async function createPresignedUploadUrl(s3Key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes
}

export async function deleteS3Object(s3Key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
}

export async function uploadBuffer(s3Key: string, buffer: Buffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add S3 client with presigned URL and CDN helpers"
```

---

### Task 10: Image Processing with Sharp

**Files:**
- Create: `src/lib/images.ts`
- Test: `src/lib/__tests__/images.test.ts`

- [ ] **Step 1: Install Sharp**

```bash
npm install sharp
npm install -D @types/sharp
```

- [ ] **Step 2: Write image processing tests**

`src/lib/__tests__/images.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processImage } from "../images";

describe("image processing", () => {
  it("generates a WebP thumbnail max 800px on long edge", async () => {
    // Create a test image: 1600x1200 red rectangle
    const input = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const result = await processImage(input);

    expect(result.width).toBe(1600);
    expect(result.height).toBe(1200);

    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.format).toBe("webp");
    expect(thumbMeta.width).toBe(800);
    expect(thumbMeta.height).toBe(600);
  });

  it("handles portrait orientation (tall image)", async () => {
    const input = await sharp({
      create: { width: 900, height: 1600, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .jpeg()
      .toBuffer();

    const result = await processImage(input);

    expect(result.width).toBe(900);
    expect(result.height).toBe(1600);

    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.height).toBe(800);
  });

  it("does not upscale small images", async () => {
    const input = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const result = await processImage(input);

    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.width).toBe(400);
    expect(thumbMeta.height).toBe(300);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test
```

- [ ] **Step 4: Implement image processor**

`src/lib/images.ts`:
```ts
import sharp from "sharp";

const MAX_THUMBNAIL_EDGE = 800;

export interface ProcessedImage {
  width: number;
  height: number;
  thumbnail: Buffer;
}

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const image = sharp(buffer).rotate(); // auto-rotate based on EXIF, then strip
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const longEdge = Math.max(width, height);
  const needsResize = longEdge > MAX_THUMBNAIL_EDGE;

  let thumbnailPipeline = sharp(buffer).rotate().removeMetadata();

  if (needsResize) {
    if (width >= height) {
      thumbnailPipeline = thumbnailPipeline.resize(MAX_THUMBNAIL_EDGE, null);
    } else {
      thumbnailPipeline = thumbnailPipeline.resize(null, MAX_THUMBNAIL_EDGE);
    }
  }

  const thumbnail = await thumbnailPipeline.webp({ quality: 80 }).toBuffer();

  return { width, height, thumbnail };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Sharp image processing with thumbnail generation and EXIF stripping"
```

---

### Task 11: Slugify Utility

**Files:**
- Create: `src/lib/slugify.ts`
- Test: `src/lib/__tests__/slugify.test.ts`

- [ ] **Step 1: Write slugify tests**

`src/lib/__tests__/slugify.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { slugify } from "../slugify";

describe("slugify", () => {
  it("converts title to kebab-case", () => {
    expect(slugify("Studio Portraits")).toBe("studio-portraits");
  });

  it("handles special characters", () => {
    expect(slugify("Family & Friends")).toBe("family-friends");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("One -- Two")).toBe("one-two");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify(" -Hello World- ")).toBe("hello-world");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

- [ ] **Step 3: Implement slugify**

`src/lib/slugify.ts`:
```ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add slugify utility"
```

---

### Task 12: Image Upload API Routes

**Files:**
- Create: `src/app/api/admin/images/upload-url/route.ts`
- Create: `src/app/api/admin/images/route.ts`

- [ ] **Step 1: Implement presigned URL endpoint**

`src/app/api/admin/images/upload-url/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getS3Key, createPresignedUploadUrl } from "@/lib/s3";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/tiff"];

export async function POST(request: NextRequest) {
  const { filename, contentType } = await request.json();

  if (!filename || !contentType || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const imageId = randomUUID();
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const s3Key = getS3Key(imageId, ext);
  const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);

  return NextResponse.json({ uploadUrl, imageId, s3Key, ext });
}
```

- [ ] **Step 2: Implement image registration endpoint (called after S3 upload completes)**

`src/app/api/admin/images/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { images, galleries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { processImage } from "@/lib/images";
import { getThumbnailKey, getCdnUrl, uploadBuffer, deleteS3Object, getS3Key } from "@/lib/s3";

export async function POST(request: NextRequest) {
  const { imageId, s3Key, ext, filename } = await request.json();

  if (!imageId || !s3Key || !filename) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Fetch the uploaded file from S3 to process it
  const cdnUrl = getCdnUrl(s3Key);
  const response = await fetch(cdnUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  const { width, height, thumbnail } = await processImage(buffer);

  const thumbnailKey = getThumbnailKey(imageId);
  await uploadBuffer(thumbnailKey, thumbnail, "image/webp");

  await db.insert(images).values({
    id: imageId,
    filename,
    s3Key,
    cdnUrl,
    thumbnailUrl: getCdnUrl(thumbnailKey),
    width,
    height,
    createdAt: new Date().toISOString(),
  });

  const record = await db.query.images.findFirst({
    where: eq(images.id, imageId),
  });

  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest) {
  const { imageId } = await request.json();

  if (!imageId) {
    return NextResponse.json({ error: "Missing imageId" }, { status: 400 });
  }

  const image = await db.query.images.findFirst({
    where: eq(images.id, imageId),
  });

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // Null any gallery cover_image_id pointing to this image
  await db.update(galleries).set({ coverImageId: null }).where(eq(galleries.coverImageId, imageId));

  // Delete from S3
  await deleteS3Object(image.s3Key);
  await deleteS3Object(getThumbnailKey(imageId));

  // Delete from DB
  await db.delete(images).where(eq(images.id, imageId));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add image upload and registration API routes"
```

---

## Chunk 4: Admin Panel

### Task 13: Admin Layout & Navigation

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/components/admin/admin-nav.tsx`

- [ ] **Step 1: Implement admin navigation component**

`src/components/admin/admin-nav.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/galleries", label: "Galleries" },
  { href: "/admin/images", label: "Images" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <nav className="w-56 min-h-screen border-r border-gray-200 bg-gray-50 p-4 flex flex-col">
      <div className="text-sm font-semibold text-gray-900 mb-6 tracking-wide">MH Admin</div>
      <ul className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block px-3 py-2 text-sm rounded ${
                  isActive ? "bg-gray-200 text-gray-900" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-900 text-left px-3 py-2"
      >
        Sign out
      </button>
    </nav>
  );
}
```

- [ ] **Step 2: Implement admin layout with session validation**

`src/app/admin/layout.tsx`:
```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isSessionExpired, getNewExpiresAt } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;

  if (!sessionId) {
    redirect("/admin/login");
  }

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session || isSessionExpired(session.expiresAt)) {
    redirect("/admin/login");
  }

  // Refresh session expiry
  await db.update(sessions).set({ expiresAt: getNewExpiresAt() }).where(eq(sessions.id, sessionId));

  return (
    <div className="flex min-h-screen bg-white">
      <AdminNav />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Verify admin layout renders**

```bash
npm run dev
```

Visit `http://localhost:3000/admin` — should redirect to login (no session yet).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add admin layout with sidebar nav and session validation"
```

---

### Task 14: Admin Dashboard

**Files:**
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Implement dashboard page**

`src/app/admin/page.tsx`:
```tsx
import { db } from "@/db/client";
import { galleries, images, contactSubmissions } from "@/db/schema";
import { count, eq, desc } from "drizzle-orm";

export default async function AdminDashboard() {
  const [galleryCount] = await db.select({ value: count() }).from(galleries);
  const [imageCount] = await db.select({ value: count() }).from(images);
  const [unreadCount] = await db
    .select({ value: count() })
    .from(contactSubmissions)
    .where(eq(contactSubmissions.isRead, 0));

  const recentMessages = await db.query.contactSubmissions.findMany({
    orderBy: desc(contactSubmissions.createdAt),
    limit: 5,
  });

  const stats = [
    { label: "Galleries", value: galleryCount.value },
    { label: "Images", value: imageCount.value },
    { label: "Unread Messages", value: unreadCount.value },
  ];

  return (
    <div>
      <h1 className="text-xl font-heading text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-gray-200 rounded p-4">
            <div className="text-2xl font-light text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Messages</h2>
      {recentMessages.length === 0 ? (
        <p className="text-sm text-gray-400">No messages yet.</p>
      ) : (
        <ul className="space-y-2">
          {recentMessages.map((msg) => (
            <li key={msg.id} className="text-sm border-b border-gray-100 pb-2">
              <span className={msg.isRead ? "text-gray-400" : "text-gray-900 font-medium"}>
                {msg.name}
              </span>
              <span className="text-gray-400 ml-2">— {msg.sessionType}</span>
              <span className="text-gray-300 ml-2">
                {new Date(msg.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Add admin dashboard with stats and recent messages"
```

---

### Task 15: Gallery CRUD API Routes

**Files:**
- Create: `src/app/api/admin/galleries/route.ts`
- Create: `src/app/api/admin/galleries/[id]/route.ts`
- Create: `src/app/api/admin/galleries/[id]/images/route.ts`

- [ ] **Step 1: Implement gallery list/create routes**

`src/app/api/admin/galleries/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { galleries } from "@/db/schema";
import { randomUUID } from "crypto";
import { slugify } from "@/lib/slugify";
import { desc, eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const { title, description } = await request.json();

  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  let slug = slugify(title);

  // Ensure slug uniqueness
  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.slug, slug),
  });
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }
  const now = new Date().toISOString();

  // Get next sort order
  const existing = await db.query.galleries.findMany({
    orderBy: desc(galleries.sortOrder),
    limit: 1,
  });
  const nextOrder = existing.length > 0 ? existing[0].sortOrder + 1 : 0;

  const id = randomUUID();
  await db.insert(galleries).values({
    id,
    title,
    slug,
    description: description || null,
    sortOrder: nextOrder,
    createdAt: now,
    updatedAt: now,
  });

  const gallery = await db.query.galleries.findFirst({
    where: (g, { eq }) => eq(g.id, id),
  });

  return NextResponse.json(gallery);
}

export async function PUT(request: NextRequest) {
  // Reorder galleries
  const { order } = await request.json(); // Array of { id, sortOrder }

  for (const item of order) {
    await db
      .update(galleries)
      .set({ sortOrder: item.sortOrder, updatedAt: new Date().toISOString() })
      .where(eq(galleries.id, item.id));
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Implement gallery update/delete routes**

`src/app/api/admin/galleries/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.description !== undefined) updates.description = body.description;
  if (body.isPublished !== undefined) updates.isPublished = body.isPublished;
  if (body.coverImageId !== undefined) updates.coverImageId = body.coverImageId;

  await db.update(galleries).set(updates).where(eq(galleries.id, id));

  const gallery = await db.query.galleries.findFirst({
    where: eq(galleries.id, id),
  });

  return NextResponse.json(gallery);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Null cover_image_id first
  await db.update(galleries).set({ coverImageId: null }).where(eq(galleries.id, id));

  // Return images to unsorted pool
  await db.update(images).set({ galleryId: null }).where(eq(images.galleryId, id));

  // Delete gallery
  await db.delete(galleries).where(eq(galleries.id, id));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Implement gallery image management route**

`src/app/api/admin/galleries/[id]/images/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: galleryId } = await params;
  const { order } = await request.json(); // Array of { id, sortOrder }

  for (const item of order) {
    await db
      .update(images)
      .set({ sortOrder: item.sortOrder })
      .where(eq(images.id, item.id));
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add gallery CRUD and image ordering API routes"
```

---

### Task 16: Image Assignment API Route

**Files:**
- Create: `src/app/api/admin/images/assign/route.ts`

- [ ] **Step 1: Implement bulk image assignment**

`src/app/api/admin/images/assign/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: NextRequest) {
  const { imageIds, galleryId } = await request.json();

  if (!imageIds || !Array.isArray(imageIds)) {
    return NextResponse.json({ error: "imageIds array required" }, { status: 400 });
  }

  for (const imageId of imageIds) {
    await db
      .update(images)
      .set({ galleryId: galleryId || null })
      .where(eq(images.id, imageId));
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Add bulk image assignment API route"
```

---

### Task 17: Settings & Messages API Routes

**Files:**
- Create: `src/app/api/admin/settings/route.ts`
- Create: `src/app/api/admin/messages/route.ts`
- Create: `src/app/api/admin/messages/[id]/route.ts`

- [ ] **Step 1: Implement settings route**

`src/app/api/admin/settings/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: NextRequest) {
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.siteTitle !== undefined) updates.siteTitle = body.siteTitle;
  if (body.tagline !== undefined) updates.tagline = body.tagline;
  if (body.aboutText !== undefined) updates.aboutText = body.aboutText;
  if (body.aboutImageUrl !== undefined) updates.aboutImageUrl = body.aboutImageUrl;
  if (body.contactEmail !== undefined) updates.contactEmail = body.contactEmail;
  if (body.contactFormEnabled !== undefined) updates.contactFormEnabled = body.contactFormEnabled;
  if (body.socialLinks !== undefined) updates.socialLinks = JSON.stringify(body.socialLinks);

  await db.update(siteSettings).set(updates).where(eq(siteSettings.id, "default"));

  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
  });

  return NextResponse.json(settings);
}
```

- [ ] **Step 2: Implement messages list route**

`src/app/api/admin/messages/route.ts`:
```ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { contactSubmissions } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const messages = await db.query.contactSubmissions.findMany({
    orderBy: desc(contactSubmissions.createdAt),
  });
  return NextResponse.json(messages);
}
```

- [ ] **Step 3: Implement message update/delete route**

`src/app/api/admin/messages/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { contactSubmissions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { isRead } = await request.json();

  await db.update(contactSubmissions).set({ isRead }).where(eq(contactSubmissions.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(contactSubmissions).where(eq(contactSubmissions.id, id));
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add settings and messages API routes"
```

---

### Task 18: Admin Gallery Pages

**Files:**
- Create: `src/app/admin/galleries/page.tsx`
- Create: `src/app/admin/galleries/new/page.tsx`
- Create: `src/app/admin/galleries/[id]/page.tsx`
- Create: `src/components/admin/gallery-form.tsx`
- Create: `src/components/admin/sortable-list.tsx`

- [ ] **Step 1: Install dnd-kit**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Implement sortable list wrapper**

`src/components/admin/sortable-list.tsx`:
```tsx
"use client";

import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

export function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

interface SortableListProps {
  items: string[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  children: React.ReactNode;
}

export function SortableList({ items, onReorder, children }: SortableListProps) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      onReorder(oldIndex, newIndex);
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 3: Implement gallery form component**

`src/components/admin/gallery-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GalleryFormProps {
  gallery?: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    isPublished: number;
  };
}

export function GalleryForm({ gallery }: GalleryFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(gallery?.title || "");
  const [slug, setSlug] = useState(gallery?.slug || "");
  const [description, setDescription] = useState(gallery?.description || "");
  const [isPublished, setIsPublished] = useState(gallery?.isPublished === 1);
  const [saving, setSaving] = useState(false);

  const isEdit = !!gallery;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const url = isEdit ? `/api/admin/galleries/${gallery.id}` : "/api/admin/galleries";
    const method = isEdit ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, description, isPublished: isPublished ? 1 : 0 }),
    });

    router.push("/admin/galleries");
    router.refresh();
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label className="block text-sm text-gray-600 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
        />
      </div>
      {isEdit && (
        <div>
          <label className="block text-sm text-gray-600 mb-1">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
          />
        </div>
      )}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="published"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        <label htmlFor="published" className="text-sm text-gray-600">
          Published
        </label>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Gallery"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Implement gallery list page**

`src/app/admin/galleries/page.tsx`:
```tsx
import { db } from "@/db/client";
import { galleries } from "@/db/schema";
import { asc } from "drizzle-orm";
import Link from "next/link";

export default async function GalleriesPage() {
  const allGalleries = await db.query.galleries.findMany({
    orderBy: asc(galleries.sortOrder),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-heading text-gray-900">Galleries</h1>
        <Link
          href="/admin/galleries/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm hover:bg-gray-800"
        >
          New Gallery
        </Link>
      </div>
      {allGalleries.length === 0 ? (
        <p className="text-sm text-gray-400">No galleries yet.</p>
      ) : (
        <ul className="space-y-2">
          {allGalleries.map((gallery) => (
            <li key={gallery.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
              <Link href={`/admin/galleries/${gallery.id}`} className="text-sm text-gray-900 hover:underline">
                {gallery.title}
              </Link>
              <span className={`text-xs ${gallery.isPublished ? "text-green-600" : "text-gray-400"}`}>
                {gallery.isPublished ? "Published" : "Draft"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement new gallery page**

`src/app/admin/galleries/new/page.tsx`:
```tsx
import { GalleryForm } from "@/components/admin/gallery-form";

export default function NewGalleryPage() {
  return (
    <div>
      <h1 className="text-xl font-heading text-gray-900 mb-6">New Gallery</h1>
      <GalleryForm />
    </div>
  );
}
```

- [ ] **Step 6: Implement gallery edit page (with image management)**

`src/app/admin/galleries/[id]/page.tsx`:
```tsx
import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { GalleryForm } from "@/components/admin/gallery-form";

export default async function EditGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const gallery = await db.query.galleries.findFirst({
    where: eq(galleries.id, id),
  });

  if (!gallery) notFound();

  const galleryImages = await db.query.images.findMany({
    where: eq(images.galleryId, id),
    orderBy: asc(images.sortOrder),
  });

  return (
    <div>
      <h1 className="text-xl font-heading text-gray-900 mb-6">Edit: {gallery.title}</h1>
      <GalleryForm gallery={gallery} />
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Images ({galleryImages.length})
        </h2>
        {galleryImages.length === 0 ? (
          <p className="text-sm text-gray-400">
            No images in this gallery. Upload images in the Images section and assign them here.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {galleryImages.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.thumbnailUrl}
                  alt={image.altText || image.filename}
                  className={`w-full h-32 object-cover ${
                    gallery.coverImageId === image.id ? "ring-2 ring-gray-900" : ""
                  }`}
                />
                {gallery.coverImageId === image.id && (
                  <span className="absolute top-1 left-1 bg-gray-900 text-white text-xs px-1">
                    Cover
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add admin gallery pages with create, edit, and list views"
```

---

### Task 19: Admin Images Page with Upload

**Files:**
- Create: `src/app/admin/images/page.tsx`
- Create: `src/components/admin/image-uploader.tsx`
- Create: `src/components/admin/image-grid.tsx`

- [ ] **Step 1: Implement image uploader component**

`src/components/admin/image-uploader.tsx`:
```tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const MAX_SIZE_WARNING = 20 * 1024 * 1024; // 20MB

export function ImageUploader() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const uploadFiles = useCallback(
    async (files: FileList) => {
      setUploading(true);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);

        if (file.size > MAX_SIZE_WARNING) {
          if (!confirm(`${file.name} is over 20MB. Continue?`)) continue;
        }

        // 1. Get presigned URL
        const urlRes = await fetch("/api/admin/images/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        const { uploadUrl, imageId, s3Key, ext } = await urlRes.json();

        // 2. Upload to S3
        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        // 3. Register image
        await fetch("/api/admin/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageId, s3Key, ext, filename: file.name }),
        });
      }

      setUploading(false);
      setProgress("");
      router.refresh();
    },
    [router]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded p-8 text-center transition-colors ${
        dragOver ? "border-gray-900 bg-gray-50" : "border-gray-300"
      }`}
    >
      {uploading ? (
        <p className="text-sm text-gray-600">{progress}</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-2">Drag and drop images here, or</p>
          <label className="cursor-pointer px-4 py-2 bg-gray-900 text-white text-sm hover:bg-gray-800 inline-block">
            Choose Files
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/tiff"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement image grid component**

`src/components/admin/image-grid.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Image {
  id: string;
  filename: string;
  thumbnailUrl: string;
  altText: string | null;
  galleryId: string | null;
}

interface Gallery {
  id: string;
  title: string;
}

interface ImageGridProps {
  images: Image[];
  galleries: Gallery[];
}

export function ImageGrid({ images, galleries }: ImageGridProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState("");

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssign() {
    if (!assignTo || selected.size === 0) return;
    await fetch("/api/admin/images/assign", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: Array.from(selected), galleryId: assignTo }),
    });
    setSelected(new Set());
    router.refresh();
  }

  async function handleDelete(imageId: string) {
    if (!confirm("Delete this image permanently?")) return;
    await fetch("/api/admin/images", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    });
    router.refresh();
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
          <span className="text-sm text-gray-600">{selected.size} selected</span>
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="text-sm border border-gray-300 px-2 py-1"
          >
            <option value="">Assign to gallery...</option>
            {galleries.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!assignTo}
            className="text-sm px-3 py-1 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      )}
      <div className="grid grid-cols-5 gap-2">
        {images.map((image) => (
          <div
            key={image.id}
            onClick={() => toggleSelect(image.id)}
            className={`relative cursor-pointer group ${
              selected.has(image.id) ? "ring-2 ring-gray-900" : ""
            }`}
          >
            <img
              src={image.thumbnailUrl}
              alt={image.altText || image.filename}
              className="w-full h-32 object-cover"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(image.id);
              }}
              className="absolute top-1 right-1 bg-red-600 text-white text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement images admin page**

`src/app/admin/images/page.tsx`:
```tsx
import { db } from "@/db/client";
import { images, galleries } from "@/db/schema";
import { isNull, asc } from "drizzle-orm";
import { ImageUploader } from "@/components/admin/image-uploader";
import { ImageGrid } from "@/components/admin/image-grid";

export default async function ImagesPage() {
  const unsortedImages = await db.query.images.findMany({
    where: isNull(images.galleryId),
    orderBy: asc(images.createdAt),
  });

  const allGalleries = await db.query.galleries.findMany({
    orderBy: asc(galleries.sortOrder),
  });

  return (
    <div>
      <h1 className="text-xl font-heading text-gray-900 mb-6">Images</h1>
      <ImageUploader />
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Unsorted ({unsortedImages.length})
        </h2>
        {unsortedImages.length === 0 ? (
          <p className="text-sm text-gray-400">All images are assigned to galleries.</p>
        ) : (
          <ImageGrid images={unsortedImages} galleries={allGalleries} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add admin images page with drag-and-drop upload and bulk assignment"
```

---

### Task 20: Admin Settings Page

**Files:**
- Create: `src/app/admin/settings/page.tsx`
- Create: `src/components/admin/settings-form.tsx`

- [ ] **Step 1: Implement settings form component**

`src/components/admin/settings-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SocialLink {
  platform: string;
  url: string;
}

interface SettingsFormProps {
  settings: {
    siteTitle: string;
    tagline: string;
    aboutText: string;
    aboutImageUrl: string | null;
    contactEmail: string;
    contactFormEnabled: number;
    socialLinks: string;
  };
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const router = useRouter();
  const [siteTitle, setSiteTitle] = useState(settings.siteTitle);
  const [tagline, setTagline] = useState(settings.tagline);
  const [aboutText, setAboutText] = useState(settings.aboutText);
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [contactFormEnabled, setContactFormEnabled] = useState(settings.contactFormEnabled === 1);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    JSON.parse(settings.socialLinks || "[]")
  );
  const [saving, setSaving] = useState(false);

  function addSocialLink() {
    setSocialLinks([...socialLinks, { platform: "", url: "" }]);
  }

  function removeSocialLink(index: number) {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  }

  function updateSocialLink(index: number, field: keyof SocialLink, value: string) {
    setSocialLinks(socialLinks.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteTitle,
        tagline,
        aboutText,
        contactEmail,
        contactFormEnabled: contactFormEnabled ? 1 : 0,
        socialLinks,
      }),
    });

    router.refresh();
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
      <div>
        <label className="block text-sm text-gray-600 mb-1">Site Title</label>
        <input
          type="text"
          value={siteTitle}
          onChange={(e) => setSiteTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Tagline</label>
        <input
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">About Text</label>
        <textarea
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Contact Email</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="contactForm"
          checked={contactFormEnabled}
          onChange={(e) => setContactFormEnabled(e.target.checked)}
        />
        <label htmlFor="contactForm" className="text-sm text-gray-600">
          Contact form enabled
        </label>
      </div>
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm text-gray-600">Social Links</label>
          <button
            type="button"
            onClick={addSocialLink}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            + Add Link
          </button>
        </div>
        {socialLinks.map((link, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              value={link.platform}
              onChange={(e) => updateSocialLink(i, "platform", e.target.value)}
              placeholder="Platform"
              className="w-1/3 px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
            />
            <input
              type="url"
              value={link.url}
              onChange={(e) => updateSocialLink(i, "url", e.target.value)}
              placeholder="URL"
              className="flex-1 px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
            />
            <button
              type="button"
              onClick={() => removeSocialLink(i)}
              className="text-sm text-red-500 hover:text-red-700 px-2"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implement settings page**

`src/app/admin/settings/page.tsx`:
```tsx
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function SettingsPage() {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
  });

  if (!settings) {
    return <p className="text-sm text-red-600">Site settings not found. Run the seed script.</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-heading text-gray-900 mb-6">Settings</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add admin settings page with social links management"
```

---

### Task 21: Admin Messages Page

**Files:**
- Create: `src/app/admin/messages/page.tsx`

- [ ] **Step 1: Implement messages page**

`src/app/admin/messages/page.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  sessionType: string;
  isRead: number;
  createdAt: string;
}

export default function MessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/messages")
      .then((res) => res.json())
      .then((data) => {
        setMessages(data);
        setLoading(false);
      });
  }, []);

  async function toggleRead(msg: Message) {
    await fetch(`/api/admin/messages/${msg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: msg.isRead ? 0 : 1 }),
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, isRead: m.isRead ? 0 : 1 } : m))
    );
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this message?")) return;
    await fetch(`/api/admin/messages/${id}`, { method: "DELETE" });
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-heading text-gray-900 mb-6">Messages</h1>
      {messages.length === 0 ? (
        <p className="text-sm text-gray-400">No messages yet.</p>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`border border-gray-200 rounded p-4 ${msg.isRead ? "opacity-60" : ""}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-sm font-medium text-gray-900">{msg.name}</span>
                  <span className="text-sm text-gray-400 ml-2">{msg.email}</span>
                  {msg.phone && <span className="text-sm text-gray-400 ml-2">{msg.phone}</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleRead(msg)}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    {msg.isRead ? "Mark unread" : "Mark read"}
                  </button>
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-400 mb-2">
                {msg.sessionType} — {new Date(msg.createdAt).toLocaleDateString()}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line">{msg.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Add admin messages page with read/delete functionality"
```

---

## Chunk 5: Public Site

### Task 22: Public Layout — Nav, Footer & Route Group

**Files:**
- Create: `src/components/public/nav.tsx`
- Create: `src/components/public/footer.tsx`
- Create: `src/app/(public)/layout.tsx`
- Create: `src/lib/galleries.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Implement floating nav**

`src/components/public/nav.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Don't show public nav on admin pages
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 py-5">
      <Link href="/" className="font-heading text-base text-gray-800 tracking-wider">
        MH
      </Link>
      {/* Desktop nav */}
      <div className="hidden md:flex gap-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-xs text-gray-500 tracking-widest hover:text-gray-900 transition-colors"
          >
            {link.label.toUpperCase()}
          </Link>
        ))}
      </div>
      {/* Mobile hamburger */}
      <button
        className="md:hidden text-gray-600"
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
      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-sm py-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-6 py-2 text-sm text-gray-600 tracking-wider"
            >
              {link.label.toUpperCase()}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Implement footer**

`src/components/public/footer.tsx`:
```tsx
interface SocialLink {
  platform: string;
  url: string;
}

interface FooterProps {
  socialLinks: SocialLink[];
}

export function Footer({ socialLinks }: FooterProps) {
  return (
    <footer className="py-12 px-6 text-center border-t border-gray-100">
      {socialLinks.length > 0 && (
        <div className="flex justify-center gap-6 mb-4">
          {socialLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 tracking-wider hover:text-gray-600 transition-colors"
            >
              {link.platform.toUpperCase()}
            </a>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-300">
        &copy; {new Date().getFullYear()} Mindy Hu Photography
      </p>
    </footer>
  );
}
```

- [ ] **Step 3: Update root layout**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { Nav } from "@/components/public/nav";
import "./globals.css";

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mindy Hu Photography",
  description: "Portrait photography by Mindy Hu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="font-sans text-gray-900 bg-white antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Add font CSS variables to Tailwind**

Update `src/app/globals.css`:
```css
@import "tailwindcss";

@theme {
  --font-heading: var(--font-serif);
  --font-body: var(--font-sans);
}
```

Update font references: use `font-heading` for serif headings and `font-body` for sans body text in components.

- [ ] **Step 5: Create shared gallery query helper**

`src/lib/galleries.ts`:
```ts
import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getPublishedGalleriesWithCovers() {
  const publishedGalleries = await db.query.galleries.findMany({
    where: eq(galleries.isPublished, 1),
    orderBy: asc(galleries.sortOrder),
  });

  return Promise.all(
    publishedGalleries.map(async (gallery) => {
      let coverImage = null;
      if (gallery.coverImageId) {
        coverImage = await db.query.images.findFirst({
          where: eq(images.id, gallery.coverImageId),
        });
      }
      return { ...gallery, coverImage };
    })
  );
}
```

- [ ] **Step 6: Create public route group layout with footer**

`src/app/(public)/layout.tsx`:
```tsx
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Nav } from "@/components/public/nav";
import { Footer } from "@/components/public/footer";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
  });
  const socialLinks = JSON.parse(settings?.socialLinks || "[]");

  return (
    <>
      <Nav />
      {children}
      <Footer socialLinks={socialLinks} />
    </>
  );
}
```

Remove `<Nav />` from `src/app/layout.tsx` since it now lives in the public layout. The root layout becomes just fonts, metadata, and the `<html>/<body>` shell.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add public layout with floating nav and footer via route group"
```

---

### Task 23: Homepage

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Implement gallery-first homepage**

Note: This file lives at `src/app/(public)/page.tsx` inside the route group.

`src/app/(public)/page.tsx`:
```tsx
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";
import { getPublishedGalleriesWithCovers } from "@/lib/galleries";

export default async function HomePage() {
  const galleriesWithCovers = await getPublishedGalleriesWithCovers();

  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
  });

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
                      src={gallery.coverImage.cdnUrl}
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

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Add gallery-first homepage"
```

---

### Task 24: Portfolio & Gallery Detail Pages

**Files:**
- Create: `src/app/portfolio/page.tsx`
- Create: `src/app/portfolio/[slug]/page.tsx`
- Create: `src/components/public/gallery-grid.tsx`
- Create: `src/components/public/lightbox.tsx`

- [ ] **Step 1: Implement masonry gallery grid**

`src/components/public/gallery-grid.tsx`:
```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Lightbox } from "./lightbox";

interface GalleryImage {
  id: string;
  cdnUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  altText: string | null;
  filename: string;
}

interface GalleryGridProps {
  images: GalleryImage[];
}

export function GalleryGrid({ images }: GalleryGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="columns-1 md:columns-2 lg:columns-3 gap-3 space-y-3">
        {images.map((image, index) => (
          <button
            key={image.id}
            onClick={() => setLightboxIndex(index)}
            className="block w-full break-inside-avoid cursor-pointer"
          >
            <Image
              src={image.thumbnailUrl}
              alt={image.altText || image.filename}
              width={image.width}
              height={image.height}
              className="w-full h-auto"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Implement lightbox**

`src/components/public/lightbox.tsx`:
```tsx
"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";

interface LightboxImage {
  cdnUrl: string;
  width: number;
  height: number;
  altText: string | null;
  filename: string;
}

interface LightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ images, currentIndex, onClose, onNavigate }: LightboxProps) {
  const image = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(currentIndex + 1);
    },
    [onClose, onNavigate, currentIndex, hasPrev, hasNext]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl z-10"
        aria-label="Close lightbox"
      >
        &times;
      </button>

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
          className="absolute left-4 text-white/40 hover:text-white text-3xl z-10"
          aria-label="Previous image"
        >
          &#8249;
        </button>
      )}

      {/* Image */}
      <div className="max-w-[90vw] max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
        <Image
          src={image.cdnUrl}
          alt={image.altText || image.filename}
          width={image.width}
          height={image.height}
          className="max-w-full max-h-[90vh] object-contain"
          sizes="90vw"
          priority
        />
      </div>

      {/* Next */}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
          className="absolute right-4 text-white/40 hover:text-white text-3xl z-10"
          aria-label="Next image"
        >
          &#8250;
        </button>
      )}

      {/* Counter */}
      <div className="absolute bottom-4 text-white/40 text-xs tracking-wider">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement portfolio page**

Note: Lives at `src/app/(public)/portfolio/page.tsx`.

`src/app/(public)/portfolio/page.tsx`:
```tsx
import Link from "next/link";
import Image from "next/image";
import { getPublishedGalleriesWithCovers } from "@/lib/galleries";

export default async function PortfolioPage() {
  const galleriesWithCovers = await getPublishedGalleriesWithCovers();

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <h1 className="text-center font-heading text-2xl text-gray-900 mb-10">Portfolio</h1>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {galleriesWithCovers.map((gallery) => (
            <Link key={gallery.id} href={`/portfolio/${gallery.slug}`} className="group block">
              {gallery.coverImage ? (
                <div className="overflow-hidden">
                  <Image
                    src={gallery.coverImage.thumbnailUrl}
                    alt={gallery.coverImage.altText || gallery.title}
                    width={gallery.coverImage.width}
                    height={gallery.coverImage.height}
                    className="w-full object-cover aspect-[3/4] transition-transform duration-500 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              ) : (
                <div className="bg-gray-100 aspect-[3/4]" />
              )}
              <h2 className="text-xs text-gray-500 tracking-widest mt-3">
                {gallery.title.toUpperCase()}
              </h2>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement gallery detail page**

Note: Lives at `src/app/(public)/portfolio/[slug]/page.tsx`.

`src/app/(public)/portfolio/[slug]/page.tsx`:
```tsx
import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { GalleryGrid } from "@/components/public/gallery-grid";

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const gallery = await db.query.galleries.findFirst({
    where: eq(galleries.slug, slug),
  });

  if (!gallery || !gallery.isPublished) notFound();

  const galleryImages = await db.query.images.findMany({
    where: eq(images.galleryId, gallery.id),
    orderBy: asc(images.sortOrder),
  });

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
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

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add portfolio page, gallery detail with masonry grid and lightbox"
```

---

### Task 25: About Page

**Files:**
- Create: `src/app/about/page.tsx`

- [ ] **Step 1: Implement about page**

Note: Lives at `src/app/(public)/about/page.tsx`.

`src/app/(public)/about/page.tsx`:
```tsx
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import Image from "next/image";

export default async function AboutPage() {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
  });

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

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Add about page"
```

---

### Task 26: Contact Page with Server Action

**Files:**
- Create: `src/app/contact/page.tsx`
- Create: `src/app/contact/actions.ts`
- Create: `src/components/public/contact-form.tsx`

- [ ] **Step 1: Implement contact form server action**

`src/app/contact/actions.ts`:
```ts
"use server";

import { db } from "@/db/client";
import { contactSubmissions, siteSettings } from "@/db/schema";
import { eq, gt, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { count } from "drizzle-orm";

function sanitize(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function submitContactForm(formData: FormData) {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
  });

  if (!settings?.contactFormEnabled) {
    return { error: "Contact form is currently disabled." };
  }

  // Rate limiting: 5 submissions per IP per hour
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Use a simple approach: count recent submissions. For a low-traffic site
  // this is adequate. The IP is checked via a stored field.
  // Note: we add an `ip` field to contact_submissions for rate limiting.
  // If you prefer not to store IPs, use Vercel's built-in rate limiting instead.

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = (formData.get("phone") as string) || null;
  const sessionType = formData.get("sessionType") as string;
  const message = formData.get("message") as string;

  if (!name || !email || !sessionType || !message) {
    return { error: "Please fill in all required fields." };
  }

  // Sanitize all inputs
  const sanitizedName = sanitize(name.trim());
  const sanitizedEmail = sanitize(email.trim());
  const sanitizedPhone = phone ? sanitize(phone.trim()) : null;
  const sanitizedMessage = sanitize(message.trim());
  const sanitizedSessionType = sanitize(sessionType);

  await db.insert(contactSubmissions).values({
    id: randomUUID(),
    name: sanitizedName,
    email: sanitizedEmail,
    phone: sanitizedPhone,
    sessionType: sanitizedSessionType,
    message: sanitizedMessage,
    isRead: 0,
    createdAt: new Date().toISOString(),
  });

  return { success: true };
}

// Note on rate limiting: For production, add Vercel's Edge Config or
// middleware-based rate limiting using the x-forwarded-for header.
// A simple in-DB approach (counting recent submissions by email) also works
// for low-traffic sites. The implementation here omits IP storage for privacy
// but the check should be added via Vercel middleware or Edge Config.
```

- [ ] **Step 2: Implement contact form client component**

`src/components/public/contact-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { submitContactForm } from "@/app/contact/actions";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await submitContactForm(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSubmitted(true);
    }
    setPending(false);
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-600">Thank you for your message. I'll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="max-w-lg mx-auto space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label className="block text-xs text-gray-500 tracking-wider mb-1">NAME</label>
        <input
          type="text"
          name="name"
          required
          className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 tracking-wider mb-1">EMAIL</label>
        <input
          type="email"
          name="email"
          required
          className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 tracking-wider mb-1">PHONE (OPTIONAL)</label>
        <input
          type="tel"
          name="phone"
          className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 tracking-wider mb-1">SESSION TYPE</label>
        <select
          name="sessionType"
          required
          className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white"
        >
          <option value="">Select...</option>
          <option value="Portrait">Portrait</option>
          <option value="Family">Family</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 tracking-wider mb-1">MESSAGE</label>
        <textarea
          name="message"
          required
          rows={5}
          className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 bg-gray-900 text-white text-sm tracking-wider hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Sending..." : "SEND MESSAGE"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Implement contact page**

Note: Lives at `src/app/(public)/contact/page.tsx`. The `actions.ts` file also moves to `src/app/(public)/contact/actions.ts`.

`src/app/(public)/contact/page.tsx`:
```tsx
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ContactForm } from "@/components/public/contact-form";

export default async function ContactPage() {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
  });

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <div className="text-center mb-10">
          <h1 className="font-heading text-2xl text-gray-900">Contact</h1>
          <p className="text-sm text-gray-500 mt-2">
            Interested in booking a session? I'd love to hear from you.
          </p>
        </div>
        {settings?.contactFormEnabled ? (
          <ContactForm />
        ) : (
          <p className="text-center text-sm text-gray-400">
            Contact form is currently unavailable. Please reach out via email.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add contact page with server action form submission"
```

---

## Chunk 6: Configuration & Deployment

### Task 27: Next.js Image Configuration

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Configure remote image domains**

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.CLOUDFRONT_DOMAIN || "*.cloudfront.net",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Configure Next.js remote image patterns for CloudFront"
```

---

### Task 28: Vercel Configuration

**Files:**
- Create: `vercel.json` (if needed)

- [ ] **Step 1: Verify Vercel deployment settings**

No `vercel.json` needed — defaults work. Ensure environment variables are set in Vercel dashboard:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `CLOUDFRONT_DOMAIN`

- [ ] **Step 2: Test production build locally**

```bash
npm run build
```

Fix any build errors.

- [ ] **Step 3: Commit any build fixes**

```bash
git add -A
git commit -m "Fix build issues for production deployment"
```

---

### Task 29: End-to-End Smoke Test

**Files:**
- Create: `e2e/smoke.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install
```

- [ ] **Step 2: Write smoke tests**

`e2e/smoke.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Mindy Hu")).toBeVisible();
});

test("portfolio page loads", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.locator("text=Portfolio")).toBeVisible();
});

test("about page loads", async ({ page }) => {
  await page.goto("/about");
  await expect(page.locator("text=About")).toBeVisible();
});

test("contact page loads", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.locator("text=Contact")).toBeVisible();
});

test("admin redirects to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("login page loads", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.locator("text=Admin")).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
});
```

- [ ] **Step 3: Add Playwright config**

Create `playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 4: Run smoke tests**

```bash
npx playwright test
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add Playwright smoke tests for all public pages and admin redirect"
```

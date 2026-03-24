# Mindy Hu Photography Portfolio — Design Spec

## Overview

A portfolio website for Mindy Hu, a portrait photographer. The site showcases her work, provides a path for potential clients to book sessions, and includes a full CMS so she can manage all content independently.

## Goals

- **Primary:** Showcase portrait photography in a clean, minimal presentation where the images do all the talking
- **Secondary:** Make it easy for visitors to inquire about booking a session
- **Operational:** Mindy can add, remove, and organize photos and edit all site content herself without touching code

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) on Vercel |
| Database | Turso (libSQL) via Drizzle ORM |
| Image Storage | AWS S3 with CloudFront CDN |
| Auth | Session-based — bcrypt password hash, HTTP-only cookie |
| Styling | Tailwind CSS v4 |
| Image Processing | Next.js `<Image>` (public), Sharp (upload thumbnails) |
| Testing | Vitest + Playwright |

## Data Model

### `admin_user`
Single-row table for Mindy's login.

| Column | Type | Notes |
|---|---|---|
| id | text (PK) | UUID |
| email | text | Unique |
| password_hash | text | bcrypt |
| created_at | text | ISO 8601 |

### `sessions`
Auth sessions for the admin panel.

| Column | Type | Notes |
|---|---|---|
| id | text (PK) | UUID, used as cookie value |
| admin_user_id | text (FK) | → admin_user.id |
| expires_at | text | ISO 8601, 7-day expiry |
| created_at | text | ISO 8601 |

### `site_settings`
Single-row table for global site configuration.

| Column | Type | Notes |
|---|---|---|
| id | text (PK) | Always "default" |
| site_title | text | Defaults to "Mindy Hu" |
| tagline | text | Subtitle / descriptor |
| homepage_hero_image_url | text | Nullable, for future use |
| about_text | text | Plain text with line breaks |
| about_image_url | text | Portrait for about page |
| contact_email | text | Where inquiries go |
| contact_form_enabled | integer | 0 or 1 |
| social_links | text | JSON: `[{"platform": "instagram", "url": "https://..."}]` |

### `galleries`
Named collections of photos.

| Column | Type | Notes |
|---|---|---|
| id | text (PK) | UUID |
| title | text | Display name |
| slug | text | URL-safe, unique |
| description | text | Nullable |
| cover_image_id | text (FK) | → images.id, nullable |
| sort_order | integer | For drag-and-drop ordering |
| is_published | integer | 0 = draft, 1 = published |
| created_at | text | ISO 8601 |
| updated_at | text | ISO 8601 |

### `images`
Every uploaded photo.

| Column | Type | Notes |
|---|---|---|
| id | text (PK) | UUID |
| gallery_id | text (FK) | → galleries.id, nullable (unsorted pool) |
| filename | text | Original filename |
| s3_key | text | Path in S3 bucket |
| cdn_url | text | CloudFront URL for original |
| thumbnail_url | text | CloudFront URL for thumbnail |
| width | integer | Pixels, extracted on upload |
| height | integer | Pixels, extracted on upload |
| alt_text | text | Nullable |
| sort_order | integer | Within gallery |
| created_at | text | ISO 8601 |

### `contact_submissions`
Form entries from visitors.

| Column | Type | Notes |
|---|---|---|
| id | text (PK) | UUID |
| name | text | |
| email | text | |
| phone | text | Nullable |
| message | text | |
| session_type | text | e.g., "Portrait", "Family", "Other" |
| is_read | integer | 0 or 1 |
| created_at | text | ISO 8601 |

## Public Site

### Visual Direction

- **Aesthetic:** Clean and minimal — white space, restrained typography, images front and center
- **Navigation:** Floating minimal nav — "MH" initials on the left, page links on the right. No background or border, overlays content. Almost invisible.
- **Typography:** Serif for the logo/headings, clean sans-serif for body/nav links. Lightweight.
- **Color:** Near-white backgrounds, dark gray text. No accent colors competing with the photography.
- **Mobile:** Responsive throughout. Hamburger menu on small screens. Masonry grid collapses to 2 columns on tablet, 1 on mobile.

### Pages

#### Homepage (`/`)
Gallery-first layout. Minimal floating nav with "MH", then immediately into a grid of published gallery cover images with titles — each linking to its gallery detail page. Visually similar to `/portfolio` but with a tighter, more curated presentation (e.g., larger cover images, fewer columns). No hero image, no large text blocks — the work speaks.

#### Portfolio (`/portfolio`)
Grid of published galleries showing cover images and titles. Clicking a gallery navigates to its detail page.

#### Gallery Detail (`/portfolio/[slug]`)
Gallery title and description at the top, followed by a masonry grid of all images in the gallery. Clicking any image opens a lightbox with full-size viewing and prev/next navigation.

#### About (`/about`)
Her portrait photo and story text, pulled from `site_settings`. Minimal layout — image and text, nothing else.

#### Contact (`/contact`)
Form with fields: name, email, phone (optional), session type (dropdown: Portrait, Family, Other), and message. Submissions stored in `contact_submissions`. Success confirmation shown inline after submission.

### Shared Layout
- Floating "MH" nav on all pages
- Footer: social links (icons) and copyright
- Page transitions: clean, no heavy animations

## Admin Panel

All admin pages live under `/admin` and require authentication. Client components behind a session check; mutations go through `/api/admin/*` routes.

### Auth Flow
- Single `admin_user` row seeded via CLI script (no signup page)
- Login at `/admin/login` — POST email/password, validate against bcrypt hash
- On success: create session row, set HTTP-only secure SameSite=Strict cookie
- Sessions expire after 7 days. `expires_at` is refreshed (extended by 7 days) on each authenticated request.
- Expired sessions cleaned lazily: on login, delete all sessions where `expires_at < now`
- Logout action in admin nav: deletes session row, clears cookie
- All admin routes/APIs verify valid session (check cookie → look up session → verify not expired)

### Dashboard (`/admin`)
- Quick stats: total images, total galleries, unread contact submissions
- Recent submissions preview

### Galleries (`/admin/galleries`)
- List all galleries (published and drafts) with cover thumbnails
- Create new gallery (title, slug auto-generated from title via kebab-case, description)
- Edit gallery: title, description, slug, published/draft toggle
- Delete gallery: null `cover_image_id`, null `gallery_id` on all gallery images (returning them to unsorted pool), then delete the gallery row
- Drag-and-drop to reorder galleries (updates `sort_order`)
- Per gallery: drag-and-drop image ordering, set cover image

### Images (`/admin/images`)
- Upload: drag-and-drop zone or file picker, supports multi-file upload
- "Unsorted" pool view: images not assigned to any gallery
- Bulk assign images to a gallery
- Edit alt text per image
- Delete images: null any `cover_image_id` FK referencing this image, then remove from S3 and database
- Thumbnails auto-generated on upload

### Site Settings (`/admin/settings`)
- Edit about page text and photo
- Edit contact email
- Toggle contact form on/off
- Manage social links (add/remove/reorder)
- Edit tagline

### Messages (`/admin/messages`)
- List contact submissions, newest first
- Mark as read/unread
- Delete submissions

### Admin UX Decisions
- No rich text editor — plain text with line breaks. Keeps it simple.
- All image uploads use presigned S3 URLs (browser uploads directly to S3)
- Drag-and-drop powered by @dnd-kit

## Image Pipeline

### Upload Flow
1. Mindy selects files in the admin UI (drag-and-drop or file picker)
2. Client requests presigned S3 upload URL from `/api/admin/images/upload-url`
3. Browser uploads file directly to S3 via presigned URL
4. Client notifies API of completed upload
5. Server-side: Sharp extracts dimensions, generates WebP thumbnail
6. Thumbnail uploaded to S3
7. Image record created in Turso with all URLs and metadata

### S3 Structure
```
originals/{image_id}.{ext}    — full-resolution uploads
thumbnails/{image_id}.webp    — smaller versions for grids
```

### Delivery
- CloudFront CDN in front of S3 for global delivery
- Next.js `<Image>` handles responsive sizing and format negotiation (WebP/AVIF) on the public site
- Lazy loading on gallery pages — images load as the user scrolls

### Constraints
- Warning shown for files above 20MB (no hard block)
- Accepted formats: JPEG, PNG, WebP, TIFF
- Thumbnails always converted to WebP, max 800px on the long edge
- EXIF data stripped on upload (prevents leaking GPS coordinates)
- Orphaned S3 objects (uploaded but never registered in DB) cleaned via S3 lifecycle rule: delete objects in `originals/` and `thumbnails/` older than 24 hours with no matching DB record

## Security

- **Auth:** bcrypt password hashing, HTTP-only secure SameSite=Strict session cookies
- **Presigned URLs:** 5-minute expiry, scoped to specific S3 key prefixes
- **Contact form:** Rate-limited to 5 submissions per IP per hour
- **CSRF:** Next.js Server Actions provide built-in CSRF protection. Admin API routes use same-origin checks via SameSite cookie.
- **Input sanitization:** All contact form fields sanitized before storage
- **Slugs:** Auto-generated from gallery title (kebab-case). Editable in admin but uniqueness enforced. No redirect on slug change (acceptable for a small site).

## Future Considerations (Not in Scope)

- Blog/journal section
- Wedding photography galleries (may expand later — gallery categories would support this)
- Email notifications on new contact submissions
- Multiple admin users
- Client proofing / private galleries

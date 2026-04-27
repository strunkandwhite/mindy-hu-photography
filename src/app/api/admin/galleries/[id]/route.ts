import { validateSession } from "@/lib/auth";
import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/slugify";

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

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (normalizedSlug !== undefined) updates.slug = normalizedSlug;
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Null out cover image reference
  await db
    .update(galleries)
    .set({ coverImageId: null })
    .where(eq(galleries.id, id));

  // Null out galleryId on all images in this gallery
  await db
    .update(images)
    .set({ galleryId: null })
    .where(eq(images.galleryId, id));

  // Delete the gallery
  await db.delete(galleries).where(eq(galleries.id, id));

  return Response.json({ success: true });
}

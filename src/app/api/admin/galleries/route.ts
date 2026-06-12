import { db } from "@/db/client";
import { galleries } from "@/db/schema";
import { eq, max } from "drizzle-orm";
import { slugify } from "@/lib/slugify";
import { withAdminAuth, parseJsonBody, revalidatePublicGalleryPages } from "@/lib/api-helpers";

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ title?: string; description?: string }>(request);
  if (!parsed.ok) return parsed.response;

  const { title, description } = parsed.body;
  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  // Generate slug and check uniqueness
  let slug = slugify(title);

  const existing = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    slug = `${slug}-${Date.now()}`;
  }

  // Get next sort order
  const maxSort = await db
    .select({ value: max(galleries.sortOrder) })
    .from(galleries);
  const nextSortOrder = (maxSort[0]?.value ?? -1) + 1;

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const record = {
    id,
    title,
    slug,
    description: description ?? null,
    sortOrder: nextSortOrder,
    isPublished: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(galleries).values(record);

  revalidatePublicGalleryPages();

  return Response.json(record, { status: 201 });
});

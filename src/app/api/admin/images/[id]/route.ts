import { db } from "@/db/client";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAdminAuth, parseJsonBody, revalidatePublicGalleryPages } from "@/lib/api-helpers";

export const PUT = withAdminAuth(async (request, { params }) => {
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

  const [updated] = await db
    .update(images)
    .set({ altText })
    .where(eq(images.id, id))
    .returning();

  revalidatePublicGalleryPages();

  return Response.json(updated);
});

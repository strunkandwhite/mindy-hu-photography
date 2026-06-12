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

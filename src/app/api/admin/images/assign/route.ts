import { db } from "@/db/client";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";
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

  const stmts = imageIds.map((id) =>
    db.update(images).set({ galleryId: galleryId ?? null }).where(eq(images.id, id)),
  );
  await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);

  revalidatePath("/galleries");
  revalidatePath("/portfolio/[slug]", "page");

  return Response.json({ success: true });
});

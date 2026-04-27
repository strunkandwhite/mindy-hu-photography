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

  await Promise.all(
    imageIds.map((imageId) =>
      db
        .update(images)
        .set({ galleryId: galleryId ?? null })
        .where(eq(images.id, imageId))
    )
  );

  revalidatePath("/galleries");
  revalidatePath("/portfolio/[slug]", "page");

  return Response.json({ success: true });
});

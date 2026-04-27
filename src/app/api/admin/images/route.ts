import { db } from "@/db/client";
import { images, galleries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCdnUrl, getThumbnailKey, uploadBuffer, deleteS3Object, getObjectBuffer } from "@/lib/s3";
import { processImage } from "@/lib/images";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";
import { revalidatePath } from "next/cache";

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{
    imageId?: string;
    s3Key?: string;
    ext?: string;
    filename?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;

  const { imageId, s3Key, ext, filename } = parsed.body;
  if (!imageId || !s3Key || !ext || !filename) {
    return Response.json(
      { error: "imageId, s3Key, ext, and filename are required" },
      { status: 400 },
    );
  }

  const buffer = await getObjectBuffer(s3Key);
  const { width, height, thumbnail } = await processImage(buffer);
  const cdnUrl = getCdnUrl(s3Key);

  // Upload thumbnail to S3
  const thumbnailKey = getThumbnailKey(imageId);
  await uploadBuffer(thumbnailKey, thumbnail, "image/webp");

  const thumbnailUrl = getCdnUrl(thumbnailKey);
  const now = new Date().toISOString();

  const record = {
    id: imageId,
    filename,
    s3Key,
    cdnUrl,
    thumbnailUrl,
    width,
    height,
    sortOrder: 0,
    createdAt: now,
  };

  await db.insert(images).values(record);

  revalidatePath("/galleries");
  revalidatePath("/portfolio/[slug]", "page");

  return Response.json(record, { status: 201 });
});

export const DELETE = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ imageId?: string }>(request);
  if (!parsed.ok) return parsed.response;

  const { imageId } = parsed.body;
  if (!imageId) {
    return Response.json(
      { error: "imageId is required" },
      { status: 400 },
    );
  }

  // Look up the image to get its S3 keys
  const rows = await db
    .select()
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);

  const image = rows[0];
  if (!image) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  // Null out any gallery cover references to this image
  await db
    .update(galleries)
    .set({ coverImageId: null })
    .where(eq(galleries.coverImageId, imageId));

  // Delete original and thumbnail from S3
  const thumbnailKey = getThumbnailKey(imageId);
  await Promise.all([
    deleteS3Object(image.s3Key),
    deleteS3Object(thumbnailKey),
  ]);

  // Delete from DB
  await db.delete(images).where(eq(images.id, imageId));

  revalidatePath("/galleries");
  revalidatePath("/portfolio/[slug]", "page");

  return Response.json({ success: true });
});

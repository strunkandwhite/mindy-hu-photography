import { db } from "@/db/client";
import { images, galleries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCdnUrl, getThumbnailKey, getDisplayKey, uploadBuffer, deleteS3Object, getObjectBufferWithSizeCap, ObjectTooLargeError } from "@/lib/s3";
import { processImage } from "@/lib/images";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";
import { revalidatePath } from "next/cache";

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{
    imageId?: string;
    s3Key?: string;
    filename?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;

  const { imageId, s3Key, filename } = parsed.body;
  if (!imageId || !s3Key || !filename) {
    return Response.json(
      { error: "imageId, s3Key, and filename are required" },
      { status: 400 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = await getObjectBufferWithSizeCap(s3Key);
  } catch (err) {
    if (err instanceof ObjectTooLargeError) {
      await deleteS3Object(s3Key).catch((cleanupErr) => {
        console.error("Failed to delete oversized upload:", cleanupErr);
      });
      return Response.json(
        { error: "Uploaded file exceeds size limit" },
        { status: 413 },
      );
    }
    console.error("Failed to read uploaded object:", err);
    return Response.json(
      { error: "Could not read the uploaded file. Please try again." },
      { status: 502 },
    );
  }
  const { width, height, thumbnail, display } = await processImage(buffer);
  const cdnUrl = getCdnUrl(s3Key);

  // Upload renditions to S3
  const thumbnailKey = getThumbnailKey(imageId);
  const displayKey = getDisplayKey(imageId);
  await Promise.all([
    uploadBuffer(thumbnailKey, thumbnail, "image/webp"),
    uploadBuffer(displayKey, display, "image/webp"),
  ]);

  const thumbnailUrl = getCdnUrl(thumbnailKey);
  const displayUrl = getCdnUrl(displayKey);
  const now = new Date().toISOString();

  const record = {
    id: imageId,
    filename,
    s3Key,
    cdnUrl,
    thumbnailUrl,
    displayUrl,
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

  // Delete original, thumbnail, and display rendition from S3
  await Promise.all([
    deleteS3Object(image.s3Key),
    deleteS3Object(getThumbnailKey(imageId)),
    deleteS3Object(getDisplayKey(imageId)),
  ]);

  // Delete from DB
  await db.delete(images).where(eq(images.id, imageId));

  revalidatePath("/galleries");
  revalidatePath("/portfolio/[slug]", "page");

  return Response.json({ success: true });
});

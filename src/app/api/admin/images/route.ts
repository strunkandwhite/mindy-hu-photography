import { validateSession } from "@/lib/auth";
import { db } from "@/db/client";
import { images, galleries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCdnUrl, getThumbnailKey, uploadBuffer, deleteS3Object } from "@/lib/s3";
import { processImage } from "@/lib/images";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    imageId?: string;
    s3Key?: string;
    ext?: string;
    filename?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageId, s3Key, ext, filename } = body;
  if (!imageId || !s3Key || !ext || !filename) {
    return Response.json(
      { error: "imageId, s3Key, ext, and filename are required" },
      { status: 400 },
    );
  }

  // Fetch the uploaded original from CDN
  const cdnUrl = getCdnUrl(s3Key);
  const response = await fetch(cdnUrl);
  if (!response.ok) {
    return Response.json(
      { error: "Failed to fetch uploaded image from CDN" },
      { status: 502 },
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const { width, height, thumbnail } = await processImage(buffer);

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
}

export async function DELETE(request: Request) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { imageId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageId } = body;
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
}

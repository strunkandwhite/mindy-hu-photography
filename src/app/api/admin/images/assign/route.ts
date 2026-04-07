import { validateSession } from "@/lib/auth";
import { db } from "@/db/client";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: Request) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { imageIds?: string[]; galleryId?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageIds, galleryId } = body;
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

  return Response.json({ success: true });
}

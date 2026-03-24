import { validateSession } from "@/lib/auth";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getS3Key, createPresignedUploadUrl } from "@/lib/s3";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
]);

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/tiff": "tiff",
};

export async function POST(request: Request) {
  const sessionId = await validateSession(request, db, sessions, eq);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { filename?: string; contentType?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { filename, contentType } = body;
  if (!filename || !contentType) {
    return Response.json(
      { error: "filename and contentType are required" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return Response.json(
      { error: "Unsupported content type. Allowed: jpeg, png, webp, tiff" },
      { status: 400 },
    );
  }

  const imageId = crypto.randomUUID();
  const ext = EXT_MAP[contentType];
  const s3Key = getS3Key(imageId, ext);
  const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);

  return Response.json({ uploadUrl, imageId, s3Key, ext });
}

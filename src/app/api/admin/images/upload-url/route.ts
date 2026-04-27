import { getS3Key, createPresignedUploadUrl } from "@/lib/s3";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";

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

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ filename?: string; contentType?: string }>(request);
  if (!parsed.ok) return parsed.response;

  const { filename, contentType } = parsed.body;
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
});

import { getS3Key, createPresignedUploadUrl } from "@/lib/s3";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";
import { IMAGE_EXT_BY_TYPE } from "@/lib/image-types";

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

  const ext = contentType ? IMAGE_EXT_BY_TYPE[contentType] : undefined;
  if (!ext) {
    return Response.json(
      { error: "Unsupported content type. Allowed: jpeg, png, webp, tiff" },
      { status: 400 },
    );
  }

  const imageId = crypto.randomUUID();
  const s3Key = getS3Key(imageId, ext);
  const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);

  return Response.json({ uploadUrl, imageId, s3Key });
});

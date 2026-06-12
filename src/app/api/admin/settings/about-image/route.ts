import { createPresignedUploadUrl, getCdnUrl } from "@/lib/s3";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";
import { IMAGE_EXT_BY_TYPE } from "@/lib/image-types";

// TIFF is excluded: the about image is rendered directly by browsers.
const BROWSER_RENDERABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ contentType?: string }>(request);
  if (!parsed.ok) return parsed.response;

  const { contentType } = parsed.body;
  if (!contentType || !BROWSER_RENDERABLE.has(contentType)) {
    return Response.json(
      { error: "Unsupported content type. Allowed: jpeg, png, webp" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const ext = IMAGE_EXT_BY_TYPE[contentType];
  const s3Key = `about/${id}.${ext}`;
  const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);
  const cdnUrl = getCdnUrl(s3Key);

  return Response.json({ uploadUrl, cdnUrl });
});

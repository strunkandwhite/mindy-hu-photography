import { createPresignedUploadUrl, getCdnUrl } from "@/lib/s3";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ contentType?: string }>(request);
  if (!parsed.ok) return parsed.response;

  const { contentType } = parsed.body;
  if (!contentType || !(contentType in ALLOWED_TYPES)) {
    return Response.json(
      { error: "Unsupported content type. Allowed: jpeg, png, webp" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const ext = ALLOWED_TYPES[contentType];
  const s3Key = `about/${id}.${ext}`;
  const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);
  const cdnUrl = getCdnUrl(s3Key);

  return Response.json({ uploadUrl, cdnUrl });
});

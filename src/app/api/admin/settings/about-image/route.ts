import { createPresignedUploadUrl, getCdnUrl } from "@/lib/s3";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";

export const POST = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{ contentType?: string; ext?: string }>(request);
  if (!parsed.ok) return parsed.response;

  const { contentType, ext } = parsed.body;
  if (!contentType || !ext) {
    return Response.json(
      { error: "contentType and ext are required" },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9]{1,5}$/i.test(ext)) {
    return Response.json({ error: "Invalid extension" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const s3Key = `about/${id}.${ext}`;
  const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);
  const cdnUrl = getCdnUrl(s3Key);

  return Response.json({ uploadUrl, cdnUrl });
});

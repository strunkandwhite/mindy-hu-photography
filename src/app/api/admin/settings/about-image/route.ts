import { validateSession } from "@/lib/auth";
import { createPresignedUploadUrl, getCdnUrl } from "@/lib/s3";

export async function POST(request: Request) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { contentType?: string; ext?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { contentType, ext } = body;
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
}

import { db } from "@/db/client";
import { contactSubmissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";

export const PUT = withAdminAuth(async (request, { params }) => {
  const { id } = await params;

  // Check existence first
  const existing = await db
    .select()
    .from(contactSubmissions)
    .where(eq(contactSubmissions.id, id))
    .limit(1);

  if (!existing[0]) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody<{ isRead?: number }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  if (body.isRead === undefined) {
    return Response.json({ error: "isRead is required" }, { status: 400 });
  }

  if (body.isRead !== 0 && body.isRead !== 1) {
    return Response.json({ error: "isRead must be 0 or 1" }, { status: 400 });
  }

  await db
    .update(contactSubmissions)
    .set({ isRead: body.isRead })
    .where(eq(contactSubmissions.id, id));

  return Response.json({ ...existing[0], isRead: body.isRead });
});

export const DELETE = withAdminAuth(async (_request, { params }) => {
  const { id } = await params;

  await db
    .delete(contactSubmissions)
    .where(eq(contactSubmissions.id, id));

  return Response.json({ success: true });
});

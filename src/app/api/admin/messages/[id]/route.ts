import { validateSession } from "@/lib/auth";
import { db } from "@/db/client";
import { contactSubmissions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { isRead?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.isRead === undefined) {
    return Response.json({ error: "isRead is required" }, { status: 400 });
  }

  await db
    .update(contactSubmissions)
    .set({ isRead: body.isRead })
    .where(eq(contactSubmissions.id, id));

  const rows = await db
    .select()
    .from(contactSubmissions)
    .where(eq(contactSubmissions.id, id))
    .limit(1);

  if (!rows[0]) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  return Response.json(rows[0]);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db
    .delete(contactSubmissions)
    .where(eq(contactSubmissions.id, id));

  return Response.json({ success: true });
}

import { validateSession } from "@/lib/auth";
import { db } from "@/db/client";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: Request) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { order?: { id: string; sortOrder: number }[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { order } = body;
  if (!order || !Array.isArray(order)) {
    return Response.json(
      { error: "order array is required" },
      { status: 400 },
    );
  }

  for (const item of order) {
    await db
      .update(images)
      .set({ sortOrder: item.sortOrder })
      .where(eq(images.id, item.id));
  }

  return Response.json({ success: true });
}

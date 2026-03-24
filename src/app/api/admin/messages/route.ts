import { validateSession } from "@/lib/auth";
import { db } from "@/db/client";
import { sessions, contactSubmissions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const sessionId = await validateSession(request, db, sessions, eq);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await db
    .select()
    .from(contactSubmissions)
    .orderBy(desc(contactSubmissions.createdAt));

  return Response.json(messages);
}

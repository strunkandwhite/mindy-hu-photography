import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { parseSessionCookie, createSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const sessionId = parseSessionCookie(cookieHeader);

  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  return Response.json(
    { success: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": createSessionCookie(""),
      },
    },
  );
}

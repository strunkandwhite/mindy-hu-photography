import { eq, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { adminUser, sessions } from "@/db/schema";
import { createSessionCookie, getNewExpiresAt } from "@/lib/auth";

const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_MAX = 10;
const attempts = new Map<string, number[]>();

function recordAttempt(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - LOGIN_ATTEMPT_WINDOW_MS;
  const list = (attempts.get(ip) ?? []).filter((t) => t > windowStart);
  list.push(now);
  attempts.set(ip, list);
  return list.length <= LOGIN_ATTEMPT_MAX;
}

function getIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const ip = getIp(request);
  if (!recordAttempt(ip)) {
    return Response.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return Response.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const users = await db
    .select()
    .from(adminUser)
    .where(eq(adminUser.email, email))
    .limit(1);

  const user = users[0];
  if (!user) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Lazy-clean expired sessions (fire and forget)
  db.delete(sessions)
    .where(lt(sessions.expiresAt, new Date().toISOString()))
    .then(() => {})
    .catch((err) => console.error("Failed to clean expired sessions:", err));

  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(sessions).values({
    id: sessionId,
    adminUserId: user.id,
    expiresAt: getNewExpiresAt(),
    createdAt: now,
  });

  return Response.json(
    { success: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": createSessionCookie(sessionId),
      },
    },
  );
}

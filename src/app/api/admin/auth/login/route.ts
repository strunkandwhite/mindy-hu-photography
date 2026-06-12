import { eq, lt, gt, and, or, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { adminUser, sessions, loginAttempts } from "@/db/schema";
import { parseJsonBody } from "@/lib/api-helpers";
import { createSessionCookie, getNewExpiresAt } from "@/lib/auth";

const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_MAX = 10;

// On Vercel x-forwarded-for is set by the platform; on other hosts these
// headers are client-suppliable, and the bcrypt cost is the real backstop.
function getIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function windowStartIso(): string {
  return new Date(Date.now() - LOGIN_ATTEMPT_WINDOW_MS).toISOString();
}

async function countRecentFailures(ip: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), gt(loginAttempts.attemptedAt, windowStartIso())));
  return row.total;
}

async function recordFailure(ip: string): Promise<void> {
  await db.insert(loginAttempts).values({
    id: crypto.randomUUID(),
    ip,
    attemptedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const ip = getIp(request);
  if ((await countRecentFailures(ip)) >= LOGIN_ATTEMPT_MAX) {
    return Response.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const parsed = await parseJsonBody<{ email?: string; password?: string }>(request);
  if (!parsed.ok) return parsed.response;

  const { email, password } = parsed.body;
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
    await recordFailure(ip);
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    await recordFailure(ip);
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Lazy cleanup on success (fire and forget): this IP's failures plus any
  // stale rows from other IPs outside the window.
  db.delete(loginAttempts)
    .where(or(eq(loginAttempts.ip, ip), lt(loginAttempts.attemptedAt, windowStartIso())))
    .then(() => {})
    .catch((err) => console.error("Failed to clean login attempts:", err));

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

import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { sessions as sessionsTable } from "@/db/schema";

const COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createSessionCookie(sessionId: string): string {
  if (!sessionId) {
    return `${COOKIE_NAME}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
  }
  return `${COOKIE_NAME}=${sessionId}; Path=/admin; HttpOnly; Secure; SameSite=Strict`;
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name.trim() === COOKIE_NAME) {
      const value = rest.join("=").trim();
      return value || null;
    }
  }
  return null;
}

export function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function getNewExpiresAt(): string {
  return new Date(Date.now() + SESSION_DURATION_MS).toISOString();
}

/**
 * Validates a session from the incoming request's cookies.
 * Parses the cookie, looks up the session in DB, checks expiry,
 * and refreshes the expires_at timestamp if valid.
 * Returns the sessionId if valid, null otherwise.
 */
export async function validateSession(
  request: { headers: { get(name: string): string | null } },
  db: LibSQLDatabase<Record<string, unknown>>,
  table: typeof sessionsTable,
  eqFn: typeof eq,
): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie");
  const sessionId = parseSessionCookie(cookieHeader);
  if (!sessionId) return null;

  const rows = await db
    .select()
    .from(table)
    .where(eqFn(table.id, sessionId))
    .limit(1);

  const session = rows[0];
  if (!session) return null;

  if (isSessionExpired(session.expiresAt)) {
    await db.delete(table).where(eqFn(table.id, sessionId));
    return null;
  }

  // Refresh the session expiry
  await db
    .update(table)
    .set({ expiresAt: getNewExpiresAt() })
    .where(eqFn(table.id, sessionId));

  return sessionId;
}

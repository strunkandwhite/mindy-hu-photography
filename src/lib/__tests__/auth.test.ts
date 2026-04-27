import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSessionCookie,
  parseSessionCookie,
  isSessionExpired,
  getNewExpiresAt,
} from "../auth";

describe("createSessionCookie", () => {
  it("creates a cookie with the session ID and Max-Age", () => {
    const cookie = createSessionCookie("abc123");
    expect(cookie).toContain("admin_session=abc123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).not.toContain("Max-Age=0");
  });

  it("creates a clear cookie when sessionId is empty", () => {
    const cookie = createSessionCookie("");
    expect(cookie).toContain("admin_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
  });
});

describe("parseSessionCookie", () => {
  it("extracts the session ID from a cookie header", () => {
    const result = parseSessionCookie("admin_session=abc123; other=value");
    expect(result).toBe("abc123");
  });

  it("returns null when cookie header is null", () => {
    expect(parseSessionCookie(null)).toBeNull();
  });

  it("returns null when cookie is not present", () => {
    expect(parseSessionCookie("other=value")).toBeNull();
  });

  it("returns null when cookie value is empty", () => {
    expect(parseSessionCookie("admin_session=")).toBeNull();
  });
});

describe("isSessionExpired", () => {
  it("returns true for a past date", () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    expect(isSessionExpired(pastDate)).toBe(true);
  });

  it("returns false for a future date", () => {
    const futureDate = new Date(Date.now() + 60_000).toISOString();
    expect(isSessionExpired(futureDate)).toBe(false);
  });
});

describe("getNewExpiresAt", () => {
  it("returns an ISO string roughly 7 days in the future", () => {
    const result = getNewExpiresAt();
    const diff = new Date(result).getTime() - Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    // Allow 5 seconds of tolerance
    expect(diff).toBeGreaterThan(sevenDaysMs - 5000);
    expect(diff).toBeLessThanOrEqual(sevenDaysMs);
  });
});

describe("validateSession", () => {
  beforeEach(() => vi.resetModules());

  it("returns null when no cookie header", async () => {
    const { validateSession } = await import("@/lib/auth");
    const sid = await validateSession({ headers: { get: () => null } });
    expect(sid).toBeNull();
  });

  it("returns null when cookie has no session id", async () => {
    const { validateSession } = await import("@/lib/auth");
    const sid = await validateSession({
      headers: { get: () => "other=value" },
    });
    expect(sid).toBeNull();
  });

  it("returns null and deletes session when expired", async () => {
    const deleted: string[] = [];
    vi.doMock("@/db/client", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "sid-1",
                  adminUserId: "u1",
                  expiresAt: new Date(Date.now() - 1000).toISOString(),
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
          }),
        }),
        delete: () => ({
          where: async () => {
            deleted.push("sid-1");
          },
        }),
        update: () => ({ set: () => ({ where: async () => {} }) }),
      },
    }));
    const { validateSession } = await import("@/lib/auth");
    const sid = await validateSession({
      headers: { get: () => "admin_session=sid-1" },
    });
    expect(sid).toBeNull();
    expect(deleted).toContain("sid-1");
    vi.doUnmock("@/db/client");
  });

  it("returns sessionId and refreshes expiry on valid session", async () => {
    let updated = false;
    vi.doMock("@/db/client", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "sid-1",
                  adminUserId: "u1",
                  expiresAt: new Date(Date.now() + 60_000).toISOString(),
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: async () => {
              updated = true;
            },
          }),
        }),
        delete: () => ({ where: async () => {} }),
      },
    }));
    const { validateSession } = await import("@/lib/auth");
    const sid = await validateSession({
      headers: { get: () => "admin_session=sid-1" },
    });
    expect(sid).toBe("sid-1");
    expect(updated).toBe(true);
    vi.doUnmock("@/db/client");
  });
});

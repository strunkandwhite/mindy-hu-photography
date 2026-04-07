import { describe, it, expect } from "vitest";
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

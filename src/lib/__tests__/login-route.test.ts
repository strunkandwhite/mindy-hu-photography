import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/db/client", () => {
  const sessions: unknown[] = [];
  const adminUsers = [
    { id: "u1", email: "admin@x", passwordHash: "$2a$10$validhash" },
  ];
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => adminUsers,
          }),
        }),
      }),
      insert: () => ({ values: async (v: unknown) => sessions.push(v) }),
      delete: () => ({ where: () => Promise.resolve() }),
    },
  };
});

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async (pw: string) => pw === "correct") },
}));

describe("POST /api/admin/auth/login", () => {
  beforeEach(() => vi.resetModules());

  it("returns 400 on invalid JSON", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(new Request("http://x", { method: "POST", body: "junk" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when fields missing", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 on wrong password", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ email: "admin@x", password: "wrong" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 + Set-Cookie on success", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ email: "admin@x", password: "correct" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/admin_session=/);
  });

  it("returns 429 after 11 attempts from same IP", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const ip = "1.2.3.4";
    for (let i = 0; i < 10; i++) {
      await POST(
        new Request("http://x", {
          method: "POST",
          headers: { "x-forwarded-for": ip },
          body: JSON.stringify({ email: "admin@x", password: "wrong" }),
        }),
      );
    }
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({ email: "admin@x", password: "wrong" }),
      }),
    );
    expect(res.status).toBe(429);
  });
});

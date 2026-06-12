import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  userRows: [] as { id: string; email: string; passwordHash: string }[],
  failures: [] as { ip: string }[],
  sessions: [] as unknown[],
}));

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          const countResult = Promise.resolve([{ total: state.failures.length }]);
          return Object.assign(countResult, {
            limit: async () => state.userRows,
          });
        },
      }),
    }),
    insert: () => ({
      values: async (v: Record<string, unknown>) => {
        if ("ip" in v) state.failures.push(v as { ip: string });
        else state.sessions.push(v);
      },
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  },
}));

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async (pw: string) => pw === "correct") },
}));

const ADMIN = { id: "u1", email: "admin@x", passwordHash: "$2a$10$validhash" };

describe("POST /api/admin/auth/login", () => {
  beforeEach(() => {
    vi.resetModules();
    state.userRows = [ADMIN];
    state.failures.length = 0;
    state.sessions.length = 0;
  });

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

  it("returns 401 and records a failure for an unknown email", async () => {
    state.userRows = [];
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ email: "nobody@x", password: "whatever" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(state.failures).toHaveLength(1);
  });

  it("returns 401 on wrong password and records a failure", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ email: "admin@x", password: "wrong" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(state.failures).toHaveLength(1);
  });

  it("returns 200 + Set-Cookie on success without recording a failure", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ email: "admin@x", password: "correct" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/admin_session=/);
    expect(state.failures).toHaveLength(0);
  });

  it("returns 429 once 10 failures have accumulated", async () => {
    const { POST } = await import("@/app/api/admin/auth/login/route");
    const attempt = () =>
      POST(
        new Request("http://x", {
          method: "POST",
          headers: { "x-forwarded-for": "1.2.3.4" },
          body: JSON.stringify({ email: "admin@x", password: "wrong" }),
        }),
      );
    for (let i = 0; i < 10; i++) {
      expect((await attempt()).status).toBe(401);
    }
    expect((await attempt()).status).toBe(429);
    expect(state.failures).toHaveLength(10); // the blocked attempt records nothing
  });
});

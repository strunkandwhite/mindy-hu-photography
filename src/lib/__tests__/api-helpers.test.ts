import { describe, it, expect, vi, afterEach } from "vitest";
import { parseJsonBody } from "@/lib/api-helpers";

describe("parseJsonBody", () => {
  it("returns parsed object on valid JSON", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
      headers: { "content-type": "application/json" },
    });
    const result = await parseJsonBody<{ a: number }>(req);
    expect(result).toEqual({ ok: true, body: { a: 1 } });
  });

  it("returns error on invalid JSON", async () => {
    const req = new Request("http://x", { method: "POST", body: "not json" });
    const result = await parseJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });
});

describe("withAdminAuth", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/auth");
  });

  it("returns 401 when validateSession returns null", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", () => ({ validateSession: async () => null }));
    const { withAdminAuth } = await import("@/lib/api-helpers");
    const handler = withAdminAuth(async () => Response.json({ ok: true }));
    const res = await handler(new Request("http://x"));
    expect(res.status).toBe(401);
  });

  it("calls the handler when authenticated and passes route params through", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", () => ({ validateSession: async () => "sid-123" }));
    const { withAdminAuth } = await import("@/lib/api-helpers");
    const handler = withAdminAuth<{ id: string }>(async (_req, ctx) => {
      const { id } = await ctx.params;
      return Response.json({ id });
    });
    const res = await handler(new Request("http://x"), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "g1" });
  });
});

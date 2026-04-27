import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function makeRequest(pathname: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(new URL(`http://localhost${pathname}`), { headers });
}

describe("proxy", () => {
  it("allows /admin/login without auth", () => {
    const res = proxy(makeRequest("/admin/login"));
    expect(res.status).toBe(200); // NextResponse.next()
  });

  it("allows /api/admin/auth/login without auth", () => {
    const res = proxy(makeRequest("/api/admin/auth/login"));
    expect(res.status).toBe(200);
  });

  it("returns 401 JSON on /api/admin/* without session cookie", async () => {
    const res = proxy(makeRequest("/api/admin/galleries"));
    expect(res.status).toBe(401);
    const body = await (res as Response).json();
    expect(body.error).toMatch(/auth/i);
  });

  it("redirects to /admin/login on /admin/* without session cookie", () => {
    const res = proxy(makeRequest("/admin/galleries"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/admin\/login$/);
  });

  it("allows authenticated /admin/* through", () => {
    const res = proxy(makeRequest("/admin/galleries", "admin_session=sid-x"));
    expect(res.status).toBe(200);
  });
});

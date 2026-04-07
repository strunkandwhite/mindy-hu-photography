import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseSessionCookie } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip login page and auth API routes
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth/")
  ) {
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get("cookie");
  const sessionId = parseSessionCookie(cookieHeader);

  if (!sessionId) {
    // API routes get a 401 JSON response
    if (pathname.startsWith("/api/admin")) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Admin pages redirect to login
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

import { NextRequest, NextResponse } from "next/server";

// Gates every /dashboard page behind a single shared password (set as
// DASHBOARD_PASSWORD in Vercel's Environment Variables). This is Phil's own
// private analytics view, not customer-facing — a single password is
// intentionally simple rather than a full login system.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard/login")) {
    return NextResponse.next();
  }

  const expected = process.env.DASHBOARD_PASSWORD;
  const cookie = req.cookies.get("vec_dash_auth")?.value;

  if (!expected || cookie !== expected) {
    const loginUrl = new URL("/dashboard/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

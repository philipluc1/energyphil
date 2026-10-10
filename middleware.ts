import { NextRequest, NextResponse } from "next/server";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";

// Gates every /dashboard page behind a single shared password (set as
// DASHBOARD_PASSWORD in Vercel's Environment Variables). This is Phil's own
// private analytics view, not customer-facing. The page re-checks too.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/dashboard/login")) return NextResponse.next();

  if (!(await dashCookieValid(req.cookies.get(DASH_COOKIE)?.value))) {
    const loginUrl = new URL("/dashboard/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

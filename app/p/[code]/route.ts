import { NextRequest, NextResponse } from "next/server";
import { SRC_COOKIE, SRC_MAX_AGE, cleanCode, formatSource } from "@/lib/attribution";
import { findPartner } from "@/lib/partners";

// A partner's link: utilo.com.au/p/<code>. Remembers the partner for 90 days
// (so their checks and members are counted) and lands on the home page, which
// shows a welcome line. Unknown codes just go to the home page.
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const partner = findPartner(cleanCode(code));
  const res = NextResponse.redirect(new URL("/", req.url));
  if (partner) {
    res.cookies.set(SRC_COOKIE, formatSource({ kind: "partner", code: partner.code }), {
      maxAge: SRC_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
    });
  }
  return res;
}

import { NextRequest, NextResponse } from "next/server";
import { SRC_COOKIE, SRC_MAX_AGE, cleanReferralCode, formatSource } from "@/lib/attribution";
import { referrerFor } from "@/lib/referrals";

// A member's referral link: utilo.com.au/r/<CODE>. When the code belongs to an
// active member, it's remembered for 90 days so the friend's discount applies
// at checkout and the member is credited. Lands on the home page, which tells
// the visitor about the discount. Unknown codes just go to the home page.
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const clean = cleanReferralCode(code);
  const res = NextResponse.redirect(new URL("/", req.url));
  if (clean && (await referrerFor(clean))) {
    res.cookies.set(SRC_COOKIE, formatSource({ kind: "referral", code: clean }), {
      maxAge: SRC_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
    });
  }
  return res;
}

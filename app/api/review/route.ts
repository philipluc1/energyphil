import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { REVIEW_SOURCES, reviewUrl, type ReviewSource } from "@/lib/reviews";

// The review link in emails and on the dashboard (2 Nov 2026): counts the
// click for the owner dashboard, then opens the review page (in-house since 14 Nov 2026).
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT = /bot|crawler|spider|preview|headless|slurp|facebookexternalhit|linkexpander|safelinks/i;

export async function GET(req: NextRequest) {
  const to = new URL(reviewUrl(), req.url);
  const src = req.nextUrl.searchParams.get("src") as ReviewSource | null;
  const id = req.nextUrl.searchParams.get("id");
  // Mail scanners open links before people do; don't count those.
  if (supabaseAdmin && !BOT.test(req.headers.get("user-agent") ?? "") && src && REVIEW_SOURCES.includes(src)) {
    const sid = id && UUID.test(id) ? id : null;
    const { error } = await supabaseAdmin.from("review_clicks").insert({ subscriber_id: sid, source: src });
    if (error && !/does not exist|schema cache/i.test(error.message)) console.error("review click not saved", error.message);
    if (sid) await supabaseAdmin.from("subscribers").update({ review_clicked_at: new Date().toISOString() }).eq("id", sid).is("review_clicked_at", null);
  }
  return NextResponse.redirect(to, 302);
}

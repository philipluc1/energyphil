import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";
import { LIVE_WINDOW_MS, liveNow } from "@/lib/visits";

// "On the site now" for the owner dashboard, refreshed every few seconds.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await dashCookieValid(req.cookies.get(DASH_COOKIE)?.value))) return NextResponse.json({ ok: false }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not connected" });
  const since = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
  const { data, error } = await supabaseAdmin.from("live_sessions").select("sid, path, last_seen").gte("last_seen", since).limit(5000);
  if (error) return NextResponse.json({ ok: false, message: /does not exist|schema cache/i.test(error.message) ? "Run the latest SQL to turn this on." : error.message });
  return NextResponse.json({ ok: true, ...liveNow(data ?? [], Date.now()) }, { headers: { "cache-control": "no-store" } });
}

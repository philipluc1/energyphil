import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sourceValue } from "@/lib/attribution";
import { cleanPath, deviceOf, refHost } from "@/lib/visits";

// Page views and "on the site now" (2 Nov 2026), for the owner dashboard. See
// lib/visits.ts for what's kept: no name, email, IP address or browser string.
// Always answers 204: counting is best-effort and never slows a page.
const BOT = /bot|crawler|spider|preview|headless|lighthouse|slurp|facebookexternalhit/i;

export async function POST(req: NextRequest) {
  const none = new NextResponse(null, { status: 204 });
  if (!supabaseAdmin) return none;
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT.test(ua)) return none;
  const b = await req.json().catch(() => null);
  const sid = String(b?.sid ?? "");
  const path = cleanPath(b?.path);
  if (!/^[a-z0-9]{12,40}$/.test(sid) || !path || path.startsWith("/dashboard")) return none;
  const now = new Date().toISOString();
  const quiet = (e: { message: string } | null) => {
    if (e && !/does not exist|schema cache/i.test(e.message)) console.error("visit not saved", e.message);
  };

  if (b?.t === "view") {
    const source = sourceValue(req.cookies.get("utilo_src")?.value);
    const { error } = await supabaseAdmin.from("page_views").insert({
      sid,
      path,
      ref: b?.first ? refHost(b?.ref, req.headers.get("host")) : null,
      device: deviceOf(ua),
      first: !!b?.first,
      source,
    });
    quiet(error);
  }
  const { error } = await supabaseAdmin.from("live_sessions").upsert({ sid, path, last_seen: now }, { onConflict: "sid" });
  quiet(error);
  // Now and then, clear out tabs that closed more than a day ago.
  if (Math.random() < 0.02) await supabaseAdmin.from("live_sessions").delete().lt("last_seen", new Date(Date.now() - 86_400_000).toISOString());
  return none;
}

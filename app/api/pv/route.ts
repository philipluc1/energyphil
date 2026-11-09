import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sourceValue } from "@/lib/attribution";
import { activeSecondsToAdd, cleanPath, deviceOf, refHost } from "@/lib/visits";

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
  // 9 Nov 2026: the same row keeps a running total of time on site (seconds
  // the tab was open and in view) and pages seen, for the owner dashboard.
  const prev = await supabaseAdmin.from("live_sessions").select("last_seen, started_at, active_seconds, pages").eq("sid", sid).limit(1);
  const p = (prev.error ? null : prev.data?.[0]) as { last_seen?: string; started_at?: string | null; active_seconds?: number | null; pages?: number | null } | null;
  let { error } = await supabaseAdmin.from("live_sessions").upsert({
    sid,
    path,
    last_seen: now,
    started_at: p?.started_at ?? now,
    active_seconds: (p?.active_seconds ?? 0) + activeSecondsToAdd(p?.last_seen, Date.now()),
    pages: (p?.pages ?? 0) + (b?.t === "view" ? 1 : 0),
  }, { onConflict: "sid" });
  // Before the 9 Nov SQL is run: still count "on the site now".
  if (error && /column|schema cache/i.test(error.message)) ({ error } = await supabaseAdmin.from("live_sessions").upsert({ sid, path, last_seen: now }, { onConflict: "sid" }));
  quiet(error);
  // Now and then, clear out visits older than 13 months (kept for time on site).
  if (Math.random() < 0.01) await supabaseAdmin.from("live_sessions").delete().lt("last_seen", new Date(Date.now() - 400 * 86_400_000).toISOString());
  return none;
}

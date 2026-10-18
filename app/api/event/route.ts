import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sourceValue } from "@/lib/attribution";
import { CHECK_EVENTS, type CheckEvent } from "@/lib/track";
import { DISTRIBUTORS } from "@/lib/plans";

// Anonymous check counts (see lib/track.ts). No name, email or IP address is
// stored. One row per browser-tab session per step, so a refresh or a second
// click doesn't count twice. Always answers 204: counting is best-effort.
const USAGE = new Set(["bill", "estimate", "average"]);
const BOT = /bot|crawler|spider|preview|headless|lighthouse/i;

export async function POST(req: NextRequest) {
  const none = new NextResponse(null, { status: 204 });
  if (!supabaseAdmin) return none;
  if (BOT.test(req.headers.get("user-agent") ?? "")) return none;
  const b = await req.json().catch(() => null);
  const event = String(b?.event ?? "") as CheckEvent;
  const sid = String(b?.sid ?? "");
  if (!CHECK_EVENTS.includes(event) || !/^[a-z0-9]{12,40}$/.test(sid)) return none;
  const distributor = (DISTRIBUTORS as readonly string[]).includes(String(b?.distributor)) ? String(b.distributor) : null;
  const usage = USAGE.has(String(b?.usage)) ? String(b.usage) : null;
  // The source comes from the request's own cookie when it has one.
  const source = sourceValue(req.cookies.get("utilo_src")?.value) ?? sourceValue(typeof b?.source === "string" ? b.source : null);
  const { error } = await supabaseAdmin
    .from("check_events")
    .upsert({ sid, event, source, distributor, usage_source: usage }, { onConflict: "sid,event", ignoreDuplicates: true });
  if (error && !/does not exist|schema cache/i.test(error.message)) console.error("check event not saved", error.message);
  return none;
}

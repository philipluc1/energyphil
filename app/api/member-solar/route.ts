import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// A member's solar: how much they send to the grid per bill (kWh) and the
// feed-in tariff their retailer pays (c/kWh). Saved on their record so the
// daily re-check counts it.
// Body: { exportKwh: number | null, fitCents: number | null }
export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not available yet." });

  const b = await req.json().catch(() => null);
  const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
  const exportKwh = num(b?.exportKwh, 20000);
  const fitCents = num(b?.fitCents, 60);
  if (b?.exportKwh != null && exportKwh === null) return NextResponse.json({ ok: false, message: "That kWh figure doesn't look right." }, { status: 400 });
  if (b?.fitCents != null && fitCents === null) return NextResponse.json({ ok: false, message: "Feed-in tariffs are between 0 and 60c a kWh." }, { status: 400 });

  const { data: sub } = await supabaseAdmin
    .from("subscribers")
    .select("id, current_rates")
    .eq("email", member.email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return NextResponse.json({ ok: false, message: "No active membership found." });

  const empty = { supply: null, anytime: null, peak: null, shoulder: null, offpeak: null, cl: null, solarFit: null };
  const rates = { ...empty, ...((sub.current_rates as Record<string, number | null> | null) ?? {}), solarFit: fitCents === null ? null : Math.round(fitCents * 1000) / 100000 };
  const update = {
    has_solar: (exportKwh ?? 0) > 0 || (fitCents ?? 0) > 0,
    solar_export_kwh: exportKwh,
    current_rates: rates,
  };
  let { error } = await supabaseAdmin.from("subscribers").update(update).eq("id", sub.id);
  // Database without the pricing columns yet: save the export at least.
  if (error && /column|schema cache/i.test(error.message)) {
    ({ error } = await supabaseAdmin.from("subscribers").update({ has_solar: update.has_solar, solar_export_kwh: exportKwh }).eq("id", sub.id));
  }
  if (error) {
    console.error("member-solar", error.message);
    return NextResponse.json({ ok: false, message: "Couldn't save that. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...update });
}

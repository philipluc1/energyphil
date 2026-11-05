import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { referralSummary } from "@/lib/referrals";
import { ALERT_MIN_CHOICES, WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import { DISTRIBUTORS } from "@/lib/plans";
import { addFound, foundTotals } from "@/lib/moneyFound";

// A member's own settings: their referral link (made on first request) and the
// smallest yearly saving worth an email.
//   GET  → { ok, referral: { code, joined, credited } | null, alertMin, monthlySummary }
//   POST { alertMin } or { monthlySummary } → { ok, ... }

export async function GET(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  const referral = await referralSummary(member.email).catch(() => null);
  let alertMin = WORTH_SWITCHING_PER_YEAR;
  let monthlySummary = true;
  let { data, error } = await supabaseAdmin!
    .from("subscribers")
    .select("alert_min_saving, monthly_summary")
    .eq("email", member.email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Older database without the column: read the rest.
  if (error && /column|schema cache/i.test(error.message ?? "")) ({ data, error } = await supabaseAdmin!
    .from("subscribers")
    .select("alert_min_saving")
    .eq("email", member.email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle());
  const row = data as { alert_min_saving?: number | null; monthly_summary?: boolean | null } | null;
  if (!error && row && typeof row.alert_min_saving === "number") alertMin = row.alert_min_saving;
  if (!error && row && row.monthly_summary === false) monthlySummary = false;
  // 5 Nov 2026: money found on their bills (an older database without the column just shows nothing).
  const { data: mf, error: mfErr } = await supabaseAdmin!.from("subscribers").select("money_found").eq("email", member.email).eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const moneyFound = mfErr ? null : foundTotals((mf as { money_found?: unknown } | null)?.money_found);
  return NextResponse.json({ ok: true, referral, alertMin, monthlySummary, moneyFound });
}

export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  const b = await req.json().catch(() => null);
  // Their electricity network, changed on My home.
  if (typeof b?.distributor === "string") {
    if (!(DISTRIBUTORS as readonly string[]).includes(b.distributor)) {
      return NextResponse.json({ ok: false, message: "Pick one of the networks shown." }, { status: 400 });
    }
    const { error } = await supabaseAdmin!.from("subscribers").update({ distributor: b.distributor }).eq("email", member.email).eq("status", "active");
    if (error) {
      console.error("network not saved", error.message);
      return NextResponse.json({ ok: false, message: "Couldn't save that just now. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, distributor: b.distributor });
  }
  // 5 Nov 2026: one bill's findings, added to the running total (merged when the same bill comes twice).
  if (b?.moneyFound && typeof b.moneyFound === "object") {
    const { data: row, error } = await supabaseAdmin!.from("subscribers").select("id, money_found").eq("email", member.email).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !row) return NextResponse.json({ ok: true, saved: false });
    const next = addFound((row as { money_found?: unknown }).money_found, { ...b.moneyFound, at: new Date().toISOString() });
    await supabaseAdmin!.from("subscribers").update({ money_found: next }).eq("id", (row as { id: string }).id);
    return NextResponse.json({ ok: true, saved: true, moneyFound: foundTotals(next) });
  }
  // 5 Nov 2026: has a concession card (asked on the bill check). Saved quietly; an older database just skips it.
  if (typeof b?.concessionCard === "boolean") {
    const { error } = await supabaseAdmin!.from("subscribers").update({ concession_card: b.concessionCard }).eq("email", member.email).eq("status", "active");
    if (error) console.warn("concession_card not saved (run supabase/schema.sql)", error.message);
    return NextResponse.json({ ok: true, concessionCard: b.concessionCard });
  }
  // The monthly summary email: on or off.
  if (typeof b?.monthlySummary === "boolean") {
    const { error } = await supabaseAdmin!.from("subscribers").update({ monthly_summary: b.monthlySummary }).eq("email", member.email).eq("status", "active");
    if (error) {
      console.error("monthly summary setting not saved", error.message);
      return NextResponse.json({ ok: false, message: "Couldn't save that just now. Re-run supabase/schema.sql if this keeps happening." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, monthlySummary: b.monthlySummary });
  }
  const alertMin = Number(b?.alertMin);
  if (!(ALERT_MIN_CHOICES as readonly number[]).includes(alertMin)) {
    return NextResponse.json({ ok: false, message: "Pick one of the amounts shown." }, { status: 400 });
  }
  const { error } = await supabaseAdmin!
    .from("subscribers")
    .update({ alert_min_saving: alertMin })
    .eq("email", member.email)
    .eq("status", "active");
  if (error) {
    console.error("alert setting not saved", error.message);
    return NextResponse.json({ ok: false, message: "Couldn't save that just now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, alertMin });
}

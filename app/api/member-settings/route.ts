import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { referralSummary } from "@/lib/referrals";
import { ALERT_MIN_CHOICES, WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import { DISTRIBUTORS } from "@/lib/plans";

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
  return NextResponse.json({ ok: true, referral, alertMin, monthlySummary });
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

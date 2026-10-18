import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { referralSummary } from "@/lib/referrals";
import { ALERT_MIN_CHOICES, WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";

// A member's own settings: their referral link (made on first request) and the
// smallest yearly saving worth an email.
//   GET  → { ok, referral: { code, joined, credited } | null, alertMin }
//   POST { alertMin } → { ok, alertMin }

export async function GET(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  const referral = await referralSummary(member.email).catch(() => null);
  let alertMin = WORTH_SWITCHING_PER_YEAR;
  const { data, error } = await supabaseAdmin!
    .from("subscribers")
    .select("alert_min_saving")
    .eq("email", member.email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!error && data && typeof data.alert_min_saving === "number") alertMin = data.alert_min_saving;
  return NextResponse.json({ ok: true, referral, alertMin });
}

export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  const b = await req.json().catch(() => null);
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

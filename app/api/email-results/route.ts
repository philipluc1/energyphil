import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { emailConfigured, sendEmail } from "@/lib/email";
import { ratesFromJson } from "@/lib/billReconcile";
import { memberSummary, type SummaryMember } from "@/lib/memberSummary";

// "Email me my results" on the dashboard (2 Nov 2026): today's results, worked
// out and written exactly as the monthly summary, sent to the member now.
// POST (signed in) → { ok, message }
const COLS = "id, email, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, solar_export_kwh, reference_total, baseline_total, home_profile, gas_zone, gas_billing_days, gas_mj, gas_reference_total, switched_at, switched_to, last_notified_retailer, last_notified_plan_name, baseline_retailer, baseline_plan_name, current_rates, customer_name, current_retailer, discount_ends_at, current_price_fixed_until";
const GAP_MS = 5 * 60_000;

export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!emailConfigured) return NextResponse.json({ ok: false, message: "Email isn't set up on the server yet." });
  const pick = (cols: string) => supabaseAdmin!.from("subscribers").select(cols).eq("email", member.email).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  let { data, error } = await pick(`${COLS}, results_emailed_at`);
  if (error && /column|schema cache/i.test(error.message ?? "")) ({ data, error } = await pick(COLS));
  if (error || !data) return NextResponse.json({ ok: false, message: "Couldn't find your membership." });
  const row = data as unknown as SummaryMember & { current_rates: unknown; customer_name: string | null; current_retailer: string | null; discount_ends_at: string | null; current_price_fixed_until: string | null; results_emailed_at?: string | null };
  // One every few minutes is plenty: a second tap just says it's on its way.
  if (row.results_emailed_at && Date.now() - Date.parse(row.results_emailed_at) < GAP_MS) {
    return NextResponse.json({ ok: true, message: `Sent to ${member.email} a moment ago. Check your inbox (and spam).` });
  }
  const origin = process.env.SITE_URL || req.nextUrl.origin;
  const r = memberSummary(row, {
    rates: ratesFromJson(row.current_rates),
    name: row.customer_name,
    currentRetailer: row.current_retailer,
    discountEndsAt: row.discount_ends_at,
    fixedUntil: row.current_price_fixed_until,
  }, origin, new Date());
  if (!r) return NextResponse.json({ ok: false, message: "Add a bill first, then we can email your results." });
  const sent = await sendEmail({ to: member.email, subject: r.email.subject, title: r.email.title, html: r.email.html });
  if (!sent) return NextResponse.json({ ok: false, message: "Couldn't send just now. Try again in a minute." });
  await supabaseAdmin!.from("subscribers").update({ results_emailed_at: new Date().toISOString() }).eq("id", row.id);
  return NextResponse.json({ ok: true, message: `Sent to ${member.email}. It's the same summary you get on the 1st of each month.` });
}

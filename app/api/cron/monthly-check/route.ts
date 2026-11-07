import { foundSentence, foundTotals } from "@/lib/moneyFound";
import { withGasReference } from "@/lib/gasReference";
import { melbourneDay } from "@/lib/switchReminder";
import { activeRowsToEmail } from "@/lib/oneMemberPerEmail";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail, emailConfigured, sendHealthEmail } from "@/lib/email";
import { ratesFromJson } from "@/lib/billReconcile";
import type { CurrentRates } from "@/lib/billExtraction";
import { rejectUnlessCron } from "@/lib/cronAuth";
import { memberSummary } from "@/lib/memberSummary";
import { sendPush } from "@/lib/push";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";

// Runs on the 1st of each month (see vercel.json). For every active member it
// re-prices their saved profile against current plan data, records that
// month's check on My Dashboard, and emails the monthly summary: the check,
// the market, what's coming up (next bill, a discount ending), what's worth
// a look (Midday Power Saver, the biggest sign-up credit, homes like yours)
// and one tip. Sent even when nothing changed, so members see the service is
// working. MONTHLY_SUMMARY_EXTRAS in lib/monthlySummary.ts turns the extras off.
export const maxDuration = 60;

interface Row {
  home_profile?: unknown;
  id: string;
  email: string;
  distributor: string | null;
  billing_days: number | null;
  peak_kwh: number | null;
  shoulder_kwh: number | null;
  offpeak_kwh: number | null;
  anytime_kwh: number | null;
  controlled_load_kwh: number | null;
  solar_export_kwh: number | null;
  demand_kw?: number | null;
  reference_total: number | null;
  baseline_total: number | null;
  unsubscribed: boolean | null;
  gas_zone?: string | null;
  gas_billing_days?: number | null;
  gas_mj?: number | null;
  gas_reference_total?: number | null;
  gas_rates?: { supply: number | null; usage: number | null } | null;
  switched_at?: string | null;
  switched_to?: string | null;
  monthly_summary?: boolean | null;
  last_notified_retailer?: string | null;
  last_notified_plan_name?: string | null;
  baseline_retailer?: string | null;
  baseline_plan_name?: string | null;
}

export async function GET(req: NextRequest) {
  const denied = rejectUnlessCron(req);
  if (denied) return denied;
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Supabase not configured." });

  const origin = process.env.SITE_URL || req.nextUrl.origin;
  const now = new Date();
  // 3 Nov 2026: runs every morning at 8am Melbourne (7am in winter) and only does
  // anything on the 1st there. A once-a-month UTC schedule landed on the 2nd.
  // ?any_day=1 (still needs the cron secret) runs it on another day, for testing.
  const today = melbourneDay(now);
  if (!today.endsWith("-01") && req.nextUrl.searchParams.get("any_day") !== "1") {
    return NextResponse.json({ ok: true, skipped: `Not the 1st in Melbourne (${today}).` });
  }
  const month = `${today.slice(0, 7)}-01`;

  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .select(
      "id, email, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, solar_export_kwh, reference_total, baseline_total, unsubscribed, home_profile, gas_zone, gas_billing_days, gas_mj, gas_reference_total, gas_rates, switched_at, switched_to, last_notified_retailer, last_notified_plan_name, baseline_retailer, baseline_plan_name",
    )
    .eq("status", "active")
    .not("distributor", "is", null);
  if (error) {
    console.error("monthly-check: load failed", error);
    return NextResponse.json({ ok: false, message: "Couldn't load members." }, { status: 500 });
  }

  // Members' own rates, to check a bill total fits the usage on file.
  // Loaded separately so an older database without the column still runs.
  const ratesOf = new Map<string, CurrentRates>();
  {
    const { data: rs, error: rErr } = await supabaseAdmin.from("subscribers").select("id, current_rates").eq("status", "active").not("current_rates", "is", null);
    if (!rErr) for (const x of (rs ?? []) as { id: string; current_rates: unknown }[]) { const r = ratesFromJson(x.current_rates); if (r) ratesOf.set(x.id, r); }
  }

  // 2 Nov 2026: name and current retailer, for "Hi Philip" and "than your last bill with Tango".
  const who = new Map<string, { name: string | null; retailer: string | null }>();
  {
    const { data: ws, error: wErr } = await supabaseAdmin.from("subscribers").select("id, customer_name, current_retailer").eq("status", "active");
    if (wErr) console.error("monthly-check: names", wErr.message);
    for (const w of (ws ?? []) as { id: string; customer_name: string | null; current_retailer: string | null }[]) who.set(w.id, { name: w.customer_name, retailer: w.current_retailer });
  }

  // Who has turned the monthly summary off (separate query, so an older database without the column still sends).
  const summaryOn = new Map<string, boolean>();
  {
    const { data: ms, error: mErr } = await supabaseAdmin.from("subscribers").select("id, monthly_summary").eq("status", "active").eq("monthly_summary", false);
    if (!mErr) for (const x of (ms ?? []) as { id: string }[]) summaryOn.set(x.id, false);
  }

  // Discount and fixed-price end dates (separate query, so an older database without the columns still runs).
  const datesOf = new Map<string, { discount: string | null; fixed: string | null }>();
  {
    const { data: ds, error: dErr } = await supabaseAdmin.from("subscribers").select("id, discount_ends_at, current_price_fixed_until").eq("status", "active");
    if (!dErr) for (const x of (ds ?? []) as { id: string; discount_ends_at: string | null; current_price_fixed_until: string | null }[]) datesOf.set(x.id, { discount: x.discount_ends_at, fixed: x.current_price_fixed_until });
  }

  // 5 Nov 2026: money found on their bills (separate query, so an older database without the column still sends).
  const foundOf = new Map<string, string | null>();
  {
    const { data: fs, error: fErr } = await supabaseAdmin.from("subscribers").select("id, money_found").eq("status", "active").not("money_found", "is", null);
    if (!fErr) for (const x of (fs ?? []) as { id: string; money_found: unknown }[]) foundOf.set(x.id, foundSentence(foundTotals(x.money_found)));
  }

  let saved = 0;
  let emailed = 0;
  let errors = 0;
  // One email per address, from the newest active membership (2 Nov 2026).
  const keep = await activeRowsToEmail(supabaseAdmin);
  for (const raw of (data ?? []) as Row[]) {
    const sub = withGasReference(raw); // 8 Nov 2026: gas yardstick from the bill's rates
    if (keep && !keep.has(sub.id)) continue;
    try {
      // Worked out and written once, in lib/memberSummary.ts (the dashboard's "Email me my results" uses the same).
      const dates = datesOf.get(sub.id);
      const r = memberSummary(sub, { rates: ratesOf.get(sub.id) ?? null, name: who.get(sub.id)?.name ?? null, currentRetailer: who.get(sub.id)?.retailer ?? null, discountEndsAt: dates?.discount ?? null, fixedUntil: dates?.fixed ?? null, found: foundOf.get(sub.id) ?? null }, origin, now);
      if (!r) continue;
      const { best, reference, saving, days } = r;
      // A new pick (cheaper by the threshold, or the old one withdrawn): store it so tomorrow's check agrees.
      if (best.reason !== "kept") {
        await supabaseAdmin.from("subscribers").update({ last_notified_total: best.bestTotal, last_notified_retailer: best.bestRetailer, last_notified_plan_name: best.bestPlanName }).eq("id", sub.id);
      }

      const { error: upErr } = await supabaseAdmin.from("bill_checks").upsert(
        {
          email: sub.email,
          month,
          source: "auto",
          billing_days: days,
          reference_total: reference,
          best_total: best.bestTotal,
          best_retailer: best.bestRetailer,
          best_plan_name: best.bestPlanName,
          saving,
        },
        { onConflict: "email,month,source" },
      );
      if (upErr) throw upErr;
      saved++;

      // The check is always saved; the email only if they haven't turned the summary off.
      if (emailConfigured && !sub.unsubscribed && summaryOn.get(sub.id) !== false) {
        const ok = await sendEmail({ to: sub.email, subject: r.email.subject, title: r.email.title, html: r.email.html });
        if (ok) emailed++;
      }
      // A nudge on their phone too, if they turned notifications on and still want the summary.
      if (summaryOn.get(sub.id) !== false) {
        const monthName = now.toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
        const yearly = (saving * 365) / days;
        await sendPush(sub.email, {
          title: `Your ${monthName} check is ready`,
          body: yearly >= WORTH_SWITCHING_PER_YEAR ? `About $${Math.round(yearly).toLocaleString("en-AU")} a year to save. Tap for your month at a glance.` : "You're on a good deal. Tap for your month at a glance.",
          url: "/account?open=year#home",
          tag: "monthly-check",
        });
      }
    } catch (err) {
      console.error("monthly-check: member failed", sub.id, err);
      errors++;
    }
  }
  await sendHealthEmail("monthly check", { "checks saved": saved, "summaries emailed": emailed, errors });
  return NextResponse.json({ ok: true, saved, emailed, errors });
}

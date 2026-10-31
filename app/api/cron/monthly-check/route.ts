import { NextRequest, NextResponse } from "next/server";
import { activityWords, marketActivity } from "@/lib/marketActivity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail, emailConfigured, sendHealthEmail } from "@/lib/email";
import { monthlyCheck } from "@/lib/emailTemplates";
import { GAS_ZONES, bestGasPlan, type GasZone } from "@/lib/gasPlans";
import { computeBest, referenceForUsage } from "@/lib/priceWatch";
import { ratesFromJson } from "@/lib/billReconcile";
import { switchedPlanNow } from "@/lib/switched";
import type { CurrentRates } from "@/lib/billExtraction";
import type { Distributor } from "@/lib/plans";
import { rejectUnlessCron } from "@/lib/cronAuth";
import { MONTHLY_SUMMARY_EXTRAS, summaryFacts, type SummaryFacts } from "@/lib/monthlySummary";
import { DEFAULT_PROFILE, type HomeProfile } from "@/lib/profileUsage";
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
  switched_at?: string | null;
  switched_to?: string | null;
  monthly_summary?: boolean | null;
}

export async function GET(req: NextRequest) {
  const denied = rejectUnlessCron(req);
  if (denied) return denied;
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Supabase not configured." });

  const origin = process.env.SITE_URL || req.nextUrl.origin;
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .select(
      "id, email, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, solar_export_kwh, reference_total, baseline_total, unsubscribed, home_profile, gas_zone, gas_billing_days, gas_mj, gas_reference_total, switched_at, switched_to",
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

  let saved = 0;
  let emailed = 0;
  let errors = 0;
  for (const sub of (data ?? []) as Row[]) {
    try {
      const days = sub.billing_days ?? 91;
      const watch = {
        distributor: sub.distributor as Distributor,
        billingDays: days,
        peak: sub.peak_kwh ?? 0,
        shoulder: sub.shoulder_kwh ?? 0,
        offpeak: sub.offpeak_kwh ?? 0,
        anytime: sub.anytime_kwh ?? 0,
        cl: sub.controlled_load_kwh ?? 0,
        solarExportKwh: sub.solar_export_kwh ?? 0,
        demandKw: sub.demand_kw ?? null,
        ev: hasEv(sub.home_profile),
      };
      const best = computeBest(watch);
      // The bill total only when it fits the usage on file (else their rates
      // on that usage, or the default offer), as the dashboard shows it.
      // Switched? Compare with the plan they're on now, not the old bill.
      const moved = sub.switched_at ? switchedPlanNow(sub.switched_to, watch.distributor, { days, peak: watch.peak, shoulder: watch.shoulder, offpeak: watch.offpeak, anytime: watch.anytime, cl: watch.cl, solarExportKwh: watch.solarExportKwh }) : null;
      const ref = moved ? { total: moved.total, vsBill: true } : sub.reference_total !== null ? referenceForUsage(watch, sub.reference_total, ratesOf.get(sub.id) ?? null) : sub.baseline_total !== null ? { total: sub.baseline_total, vsBill: false } : null;
      const reference = ref ? ref.total : null;
      if (!best || reference === null) continue;

      const saving = reference - best.bestTotal;
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
        const monthName = now.toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
        const act = marketActivity({ network: sub.distributor, days: 31 });
        // The extra sections never stop the email: if anything fails, send the short check.
        let facts: SummaryFacts | null = null;
        if (MONTHLY_SUMMARY_EXTRAS && !best.average) {
          try {
            const dates = datesOf.get(sub.id);
            facts = summaryFacts({
              network: watch.distributor,
              usage: { days, peak: watch.peak, shoulder: watch.shoulder, offpeak: watch.offpeak, anytime: watch.anytime, cl: watch.cl, solarExportKwh: watch.solarExportKwh, demandKw: watch.demandKw },
              reference,
              vsBill: !!ref?.vsBill,
              rates: moved ? null : ratesOf.get(sub.id) ?? null,
              profile: answeredProfile(sub.home_profile),
              ev: watch.ev,
              best: { retailer: best.bestRetailer, planName: best.bestPlanName, total: best.bestTotal },
              discountEndsAt: dates?.discount ?? null,
              fixedUntil: dates?.fixed ?? null,
              now,
            });
          } catch (err) {
            console.error("monthly-check: summary facts failed", sub.id, err);
          }
        }
        const e = monthlyCheck({
          origin,
          monthName,
          // 1 July is when Victorian retailers usually reprice: say so.
          isJuly: now.getUTCMonth() === 6,
          retailer: best.bestRetailer,
          planName: best.bestPlanName,
          yearly: (saving * 365) / days,
          unsubscribeUrl: `${origin}/api/unsubscribe?type=subscriber&id=${sub.id}`,
          gas: gasSummary(sub),
          activity: act.ready ? activityWords(act) || null : null,
          activityCount: act.ready ? act.newOffers + act.priceChanges : null,
          facts,
        });
        const ok = await sendEmail({ to: sub.email, subject: e.subject, title: e.title, html: e.html });
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

/** Their home answers, when they've given them. */
function answeredProfile(p: unknown): HomeProfile | null {
  if (!p || typeof p !== "object") return null;
  const hp = p as Partial<HomeProfile> & { answered?: boolean };
  if (hp.answered === false || typeof hp.daytimeHome !== "string") return null;
  return { ...DEFAULT_PROFILE, ...hp } as HomeProfile;
}

/** True when the saved home answers say they charge an EV at home. */
function hasEv(profile: unknown): boolean {
  return !!profile && typeof profile === "object" && (profile as { ev?: unknown }).ev === true;
}

/** The cheapest gas plan vs the member's gas bill, when they have one on file. */
function gasSummary(sub: Row): { retailer: string; planName: string; yearly: number } | null {
  if (!sub.gas_zone || !GAS_ZONES.includes(sub.gas_zone as GasZone) || !sub.gas_mj || !sub.gas_reference_total) return null;
  const days = sub.gas_billing_days ?? 91;
  const top = bestGasPlan(sub.gas_zone as GasZone, { days, mj: sub.gas_mj });
  if (!top) return null;
  return { retailer: top.plan[0], planName: top.plan[2], yearly: ((sub.gas_reference_total - top.total) * 365) / days };
}

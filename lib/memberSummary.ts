import "server-only";
import { activityWords, marketActivity } from "./marketActivity";
import { monthlyCheck, type Email } from "./emailTemplates";
import { GAS_ZONES, bestGasPlan, type GasZone } from "./gasPlans";
import { computePick, referenceForUsage } from "./priceWatch";
import { switchedPlanNow } from "./switched";
import type { CurrentRates } from "./billExtraction";
import type { Distributor } from "./plans";
import { MONTHLY_SUMMARY_EXTRAS, summaryFacts, type SummaryFacts } from "./monthlySummary";
import { DEFAULT_PROFILE, type HomeProfile } from "./profileUsage";

// A member's results, worked out and written as the monthly summary email
// (2 Nov 2026). Used by the monthly cron and by "Email me my results" on the
// dashboard, so both say exactly the same thing.

export interface SummaryMember {
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
  home_profile?: unknown;
  gas_zone?: string | null;
  gas_billing_days?: number | null;
  gas_mj?: number | null;
  gas_reference_total?: number | null;
  switched_at?: string | null;
  switched_to?: string | null;
  last_notified_retailer?: string | null;
  last_notified_plan_name?: string | null;
  baseline_retailer?: string | null;
  baseline_plan_name?: string | null;
}

export interface SummaryExtras {
  rates: CurrentRates | null;
  name: string | null;
  currentRetailer: string | null;
  discountEndsAt: string | null;
  fixedUntil: string | null;
  /** 5 Nov 2026: "We've caught 3 things on your bills…" (lib/moneyFound.ts), or nothing. */
  found?: string | null;
}

export interface MemberSummary {
  best: NonNullable<ReturnType<typeof computePick>>;
  reference: number;
  saving: number;
  days: number;
  email: Email;
}

export function memberSummary(sub: SummaryMember, x: SummaryExtras, origin: string, now: Date): MemberSummary | null {
  if (!sub.distributor) return null;
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
  // The same pick the dashboard and the daily alerts show (lib/stickyPick.ts).
  const best = computePick(watch, { retailer: sub.last_notified_retailer ?? sub.baseline_retailer ?? null, plan: sub.last_notified_plan_name ?? sub.baseline_plan_name ?? null });
  // The bill total only when it fits the usage on file (else their rates on
  // that usage, or the default offer). Switched? The plan they're on now.
  const moved = sub.switched_at ? switchedPlanNow(sub.switched_to ?? null, watch.distributor, { days, peak: watch.peak, shoulder: watch.shoulder, offpeak: watch.offpeak, anytime: watch.anytime, cl: watch.cl, solarExportKwh: watch.solarExportKwh }) : null;
  const ref = moved ? { total: moved.total, vsBill: true } : sub.reference_total !== null ? referenceForUsage(watch, sub.reference_total, x.rates) : sub.baseline_total !== null ? { total: sub.baseline_total, vsBill: false } : null;
  if (!best || !ref) return null;
  const reference = ref.total;
  const saving = reference - best.bestTotal;
  const monthName = now.toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
  const act = marketActivity({ network: sub.distributor, days: 31 });
  // The extra sections never stop the email: if anything fails, the short check.
  let facts: SummaryFacts | null = null;
  if (MONTHLY_SUMMARY_EXTRAS && !best.average) {
    try {
      facts = summaryFacts({
        network: watch.distributor,
        usage: { days, peak: watch.peak, shoulder: watch.shoulder, offpeak: watch.offpeak, anytime: watch.anytime, cl: watch.cl, solarExportKwh: watch.solarExportKwh, demandKw: watch.demandKw },
        reference,
        vsBill: !!ref.vsBill,
        rates: moved ? null : x.rates,
        profile: answeredProfile(sub.home_profile),
        ev: watch.ev,
        best: { retailer: best.bestRetailer, planName: best.bestPlanName, total: best.bestTotal },
        discountEndsAt: x.discountEndsAt,
        fixedUntil: x.fixedUntil,
        now,
      });
    } catch (err) {
      console.error("member summary: facts failed", sub.id, err);
    }
  }
  const email = monthlyCheck({
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
    customerName: x.name,
    nearTies: best.nearTies,
    currentRetailer: x.currentRetailer,
    found: x.found ?? null,
  });
  return { best, reference, saving, days, email };
}

/** Their home answers, when they've given them. */
export function answeredProfile(p: unknown): HomeProfile | null {
  if (!p || typeof p !== "object") return null;
  const hp = p as Partial<HomeProfile> & { answered?: boolean };
  if (hp.answered === false || typeof hp.daytimeHome !== "string") return null;
  return { ...DEFAULT_PROFILE, ...hp } as HomeProfile;
}

/** True when the saved home answers say they charge an EV at home. */
export function hasEv(profile: unknown): boolean {
  return !!profile && typeof profile === "object" && (profile as { ev?: unknown }).ev === true;
}

/** The cheapest gas plan vs the member's gas bill, when they have one on file. */
export function gasSummary(sub: SummaryMember): { retailer: string; planName: string; yearly: number } | null {
  if (!sub.gas_zone || !GAS_ZONES.includes(sub.gas_zone as GasZone) || !sub.gas_mj || !sub.gas_reference_total) return null;
  const days = sub.gas_billing_days ?? 91;
  const top = bestGasPlan(sub.gas_zone as GasZone, { days, mj: sub.gas_mj });
  if (!top) return null;
  return { retailer: top.plan[0], planName: top.plan[2], yearly: ((sub.gas_reference_total - top.total) * 365) / days };
}

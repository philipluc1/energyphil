import "server-only";
import { Distributor, rankPlans, topOpen, type UsageInput } from "@/lib/plans";
import { usageOrAverage } from "@/lib/profileUsage";

// Shared by app/api/cron/recheck-prices — kept separate from that route so
// the actual "what's the cheapest plan for this profile right now" logic is
// in one place, the same question the live comparator answers.

export interface WatchProfile {
  distributor: Distributor;
  billingDays: number;
  peak: number;
  shoulder: number;
  offpeak: number;
  anytime: number;
  cl: number;
  solarExportKwh?: number;
  /** Charges an EV at home (only then are EV-only plans considered). */
  ev?: boolean;
}

export interface WatchResult {
  bestTotal: number;
  bestRetailer: string;
  bestPlanName: string;
  /** Priced for the average home because there wasn't enough usage on file:
   *  don't compare it with their bill total. */
  average: boolean;
}

/** The member's usage, or the average Victorian home (4,000 kWh a year) when
 *  there isn't enough on file: the same rule as the dashboard. */
function watchUsage(profile: WatchProfile): { usage: UsageInput; average: boolean } {
  return usageOrAverage({
    days: profile.billingDays,
    peak: profile.peak,
    shoulder: profile.shoulder,
    offpeak: profile.offpeak,
    anytime: profile.anytime,
    cl: profile.cl,
    solarExportKwh: profile.solarExportKwh ?? 0,
  });
}

export function computeBest(profile: WatchProfile): WatchResult | null {
  const { usage, average } = watchUsage(profile);
  const top = topOpen(rankPlans(profile.distributor, usage, { ev: profile.ev === true }));
  if (!top) return null;
  return { bestTotal: top.total, bestRetailer: top.plan[0], bestPlanName: top.plan[2], average };
}

/** Today's price of one named plan for this profile, or null if it's no longer
 *  offered (or can't be priced for this usage). Used to re-price the plan we
 *  last recommended, so a retailer raising that plan's prices is noticed. */
export function priceOfPlan(profile: WatchProfile, retailer: string | null, planName: string | null): number | null {
  if (!retailer || !planName) return null;
  const match = rankPlans(profile.distributor, watchUsage(profile).usage, { ev: true }).find((m) => m.plan[0] === retailer && m.plan[2] === planName);
  return match ? match.total : null;
}

import { WORTH_SWITCHING_PER_YEAR } from "./dataPolicy";

/** Worth telling someone only if the new plan beats the previous one by at
 *  least WORTH_SWITCHING_PER_YEAR, scaled from the billing period. Filters
 *  rounding noise and the churn of small weekly repricing. */
export function isMeaningfullyCheaper(newBest: number, previousBest: number | null, billingDays = 91, minPerYear: number = WORTH_SWITCHING_PER_YEAR): boolean {
  if (previousBest === null || !Number.isFinite(previousBest)) return false;
  const days = billingDays > 0 ? billingDays : 91;
  const min = Number.isFinite(minPerYear) && minPerYear > 0 ? minPerYear : WORTH_SWITCHING_PER_YEAR;
  return ((previousBest - newBest) / days) * 365 >= min;
}

export function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

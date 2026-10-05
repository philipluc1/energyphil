import "server-only";
import { Distributor, rankPlans } from "@/lib/plans";

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
}

export interface WatchResult {
  bestTotal: number;
  bestRetailer: string;
  bestPlanName: string;
}

export function computeBest(profile: WatchProfile): WatchResult | null {
  const matches = rankPlans(profile.distributor, {
    days: profile.billingDays,
    peak: profile.peak,
    shoulder: profile.shoulder,
    offpeak: profile.offpeak,
    anytime: profile.anytime,
    cl: profile.cl,
    solarExportKwh: profile.solarExportKwh ?? 0,
  });
  const top = matches[0];
  if (!top) return null;
  return { bestTotal: top.total, bestRetailer: top.plan[0], bestPlanName: top.plan[2] };
}

// Minimum improvement (dollars, for the whole billing period) before it's
// worth emailing someone — filters out noise from rounding-level
// recalculations rather than a genuinely better deal. Tune freely.
const MIN_IMPROVEMENT = 3;

export function isMeaningfullyCheaper(newBest: number, previousBest: number | null): boolean {
  if (previousBest === null || !Number.isFinite(previousBest)) return false;
  return previousBest - newBest >= MIN_IMPROVEMENT;
}

export function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

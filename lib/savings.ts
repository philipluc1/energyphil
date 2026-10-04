import { DISTRIBUTORS, benchmarkBill, rankPlans, type UsageInput } from "./plans";

export interface PeriodBreakdown {
  quarterly: number;
  halfYearly: number;
  annual: number;
}

/**
 * Extrapolates one known saving (for a bill covering `days`) out to the
 * three periods customers actually think in. This is a flat daily-rate
 * projection, not a seasonal forecast — usage varies month to month, so we
 * say "based on this bill" rather than promising it as a guarantee.
 */
export function periodBreakdown(saveForPeriod: number, days: number): PeriodBreakdown {
  const daily = days > 0 ? saveForPeriod / days : 0;
  return {
    quarterly: daily * 91,
    halfYearly: daily * 182,
    annual: daily * 365,
  };
}

export interface TypicalExample extends PeriodBreakdown {
  annualUsageKwh: number;
}

/**
 * Illustrative, homepage-only example: a typical single-rate Victorian
 * household (~4,000kWh/year), priced on a 91-day quarterly bill against the
 * cheapest comparable plan on each of the five networks, averaged. This is
 * computed live from the same plan data the real comparator uses — not a
 * made-up figure — but it's still an example, not a quote: the page must
 * label it clearly and point people at the real tool for their own number.
 */
export function typicalHouseholdExample(): TypicalExample {
  const ANNUAL_KWH = 4000;
  const DAYS = 91;
  const usage: UsageInput = {
    days: DAYS,
    peak: 0,
    shoulder: 0,
    offpeak: 0,
    anytime: (ANNUAL_KWH / 365) * DAYS,
    cl: 0,
  };

  let totalSave = 0;
  let count = 0;
  for (const distributor of DISTRIBUTORS) {
    const bench = benchmarkBill(distributor, DAYS, null);
    const best = rankPlans(distributor, usage)[0];
    if (!best) continue;
    totalSave += Math.max(0, bench - best.total);
    count++;
  }
  const avgQuarterlySave = count > 0 ? totalSave / count : 0;

  return { ...periodBreakdown(avgQuarterlySave, DAYS), annualUsageKwh: ANNUAL_KWH };
}

// --- Accumulated savings (subscriber account history) ---
//
// A subscriber's savings_episodes rows (see supabase/schema.sql) each cover
// a stretch of time during which one particular plan was "the cheapest match
// we had them on" — opened at signup, closed and replaced whenever the daily
// recheck job finds something cheaper. Accumulated savings is just the sum,
// across every episode, of (how many days it ran) × (its daily saving rate).
// This is a projection, not a confirmed figure — see the caller for the
// "estimate" framing shown to the customer.
export interface SavingsEpisode {
  startedAt: string; // ISO timestamp
  endedAt: string | null; // ISO timestamp, or null = still the current episode
  dailyRate: number; // dollars/day, vs the customer's original reference bill
}

export interface AccumulatedSavings {
  total: number;
  sinceDate: string | null; // ISO of the earliest episode, or null if there's no history yet
}

export function accumulatedSavings(episodes: SavingsEpisode[], now: Date = new Date()): AccumulatedSavings {
  if (episodes.length === 0) return { total: 0, sinceDate: null };
  let total = 0;
  let earliest: Date | null = null;
  for (const ep of episodes) {
    const start = new Date(ep.startedAt);
    const end = ep.endedAt ? new Date(ep.endedAt) : now;
    const days = Math.max(0, (end.getTime() - start.getTime()) / 86_400_000);
    total += days * ep.dailyRate;
    if (!earliest || start < earliest) earliest = start;
  }
  return { total: Math.max(0, total), sinceDate: earliest ? earliest.toISOString() : null };
}

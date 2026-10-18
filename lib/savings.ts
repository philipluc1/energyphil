import { DISTRIBUTORS, benchmarkBill, bestPlan, computeBill, type Distributor, type UsageInput } from "./plans";
import { DEFAULT_PROFILE, averageUsage, estimateUsage, vdoBillForUsage, type HomeProfile } from "./profileUsage";

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
  /** average yearly cost on the default offer vs the cheapest market plan */
  annualBench: number;
  annualBest: number;
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
  let totalBench = 0;
  let totalBest = 0;
  let count = 0;
  for (const distributor of DISTRIBUTORS) {
    const bench = benchmarkBill(distributor, DAYS, null);
    const best = bestPlan(distributor, usage);
    if (!best) continue;
    totalSave += Math.max(0, bench - best.total);
    totalBench += bench;
    totalBest += Math.min(bench, best.total);
    count++;
  }
  const avgQuarterlySave = count > 0 ? totalSave / count : 0;

  const perYear = count > 0 ? 365 / DAYS / count : 0;
  return {
    ...periodBreakdown(avgQuarterlySave, DAYS),
    annualUsageKwh: ANNUAL_KWH,
    annualBench: totalBench * perYear,
    annualBest: totalBest * perYear,
  };
}

// --- Three homes (home page) ---
//
// The point of reading a bill: the cheapest plan, and what it saves, depend on
// the home. We price three homes on one network with today's plan data: the
// 4,000 kWh "typical household" (the regulator's figure), a single person in
// a flat, and a family of five with electric heating and hot water. Live
// figures from the same pricing as the check; the page labels them as
// estimates from our household model.

export const THREE_HOMES_NETWORK: Distributor = "Powercor"; // Melbourne's west and western Victoria

export interface HomeExample {
  key: "typical" | "single" | "family";
  title: string;
  detail: string;
  annualKwh: number;
  /** A year on the cheapest plan this home can get. */
  best: number;
  /** A year on the Victorian Default Offer, for the same usage. */
  vdo: number;
  saving: number;
  /** True when this home's cheapest plan isn't the typical home's pick. */
  differentPlan: boolean;
  /** What the typical home's pick would cost this home a year on top of its own cheapest (0 when the same). */
  typicalPickCostsMore: number | null;
}

const HOMES: { key: HomeExample["key"]; title: string; detail: string; profile: Partial<HomeProfile> | null }[] = [
  { key: "single", title: "One person in a flat", detail: "Out at work, gas heating, no air-con", profile: { people: 1, cooling: false, daytimeHome: "away" } },
  { key: "typical", title: "The \u201ctypical household\u201d", detail: "4,000 kWh a year, the regulator\u2019s \u201ctypical\u201d figure", profile: null },
  { key: "family", title: "A family of five", detail: "Reverse-cycle heating, electric hot water on controlled load", profile: { people: 5, heating: "reverse_cycle", hotWater: "electric_controlled", daytimeHome: "away" } },
];

function homeUsage(profile: Partial<HomeProfile> | null, days: number): UsageInput {
  if (!profile) return averageUsage(days);
  const e = estimateUsage({ ...DEFAULT_PROFILE, ...profile }, days);
  return { days, peak: e.peak, shoulder: e.shoulder, offpeak: e.offpeak, anytime: 0, cl: e.cl, solarExportKwh: e.solarExportKwh };
}

export function threeHomesExample(network: Distributor = THREE_HOMES_NETWORK): HomeExample[] {
  const DAYS = 365;
  const typicalPick = bestPlan(network, averageUsage(DAYS));
  const out: HomeExample[] = [];
  for (const h of HOMES) {
    const u = homeUsage(h.profile, DAYS);
    const best = bestPlan(network, u);
    if (!best) continue;
    const vdo = vdoBillForUsage(network, u);
    const pickCost = typicalPick ? computeBill(typicalPick.plan, u) : null;
    const differentPlan = !!typicalPick && best.plan !== typicalPick.plan;
    out.push({
      key: h.key,
      title: h.title,
      detail: h.detail,
      annualKwh: Math.round(u.peak + u.shoulder + u.offpeak + u.anytime + u.cl),
      best: best.total,
      vdo,
      saving: Math.max(0, vdo - best.total),
      differentPlan,
      // null: the typical home's pick can't price this home (e.g. no controlled-load rate).
      typicalPickCostsMore: pickCost === null ? null : Math.max(0, pickCost - best.total),
    });
  }
  return out;
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

export interface MonthlySaving {
  key: string; // "2026-10"
  label: string; // "Oct 2026"
  amount: number;
  partial: boolean; // true for the current, still-running month
  /** true when this month's amount comes from a saved check, not the running estimate */
  measured?: boolean;
}

/** Splits the same episode-based estimate as accumulatedSavings() into
 * calendar months (Melbourne-agnostic: UTC month boundaries are close enough
 * for a daily-rate estimate). Newest month first; months with no
 * overlapping episode are skipped only before the first episode starts. */
export function monthlySavings(episodes: SavingsEpisode[], now: Date = new Date()): MonthlySaving[] {
  if (episodes.length === 0) return [];
  const starts = episodes.map((e) => new Date(e.startedAt).getTime());
  const first = new Date(Math.min(...starts));
  const out: MonthlySaving[] = [];
  let cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  while (cursor <= now) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    let amount = 0;
    for (const ep of episodes) {
      const s = Math.max(new Date(ep.startedAt).getTime(), cursor.getTime());
      const e = Math.min(ep.endedAt ? new Date(ep.endedAt).getTime() : now.getTime(), next.getTime(), now.getTime());
      if (e > s) amount += ((e - s) / 86_400_000) * ep.dailyRate;
    }
    out.push({
      key: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
      label: cursor.toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" }),
      amount: Math.max(0, amount),
      partial: next > now,
    });
    cursor = next;
  }
  return out.reverse();
}


export interface SavedCheck {
  month: string; // 'YYYY-MM-01'
  billing_days: number;
  saving: number; // for billing_days
}

/** Overlay saved monthly checks onto the estimate: a month with a saved check
 * uses that check's daily saving × days in the month. Months that only have a
 * check (no episodes yet) are added. Newest first, like monthlySavings(). */
export function mergeChecks(estimated: MonthlySaving[], checks: SavedCheck[], now: Date = new Date()): MonthlySaving[] {
  const byKey = new Map<string, MonthlySaving>(estimated.map((m) => [m.key, { ...m }]));
  for (const c of checks) {
    const key = c.month.slice(0, 7);
    const [y, m] = key.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const amount = c.billing_days > 0 ? Math.max(0, (c.saving / c.billing_days) * daysInMonth) : 0;
    const prev = byKey.get(key);
    const partial = prev?.partial ?? (now.getUTCFullYear() === y && now.getUTCMonth() + 1 === m);
    byKey.set(key, {
      key,
      label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" }),
      amount,
      partial,
      measured: true,
    });
  }
  return [...byKey.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

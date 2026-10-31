// The gas side of the dashboard insights (1 Nov 2026), built the same way as
// electricity's (lib/homeInsights.ts): a what-if on usage, the seasons, a
// year-ahead forecast and the gas market. Victoria has no default offer for
// gas, so "now" is the member's own bill (split into a supply charge and an
// average rate) or, with no bill, the middle of the market.

import { GAS_PLANS, computeGasBill, rankGasPlans, type GasPlanRow, type GasUsage, type GasZone } from "./gasPlans";
import { annualFromGasBill, monthsFromAnnual } from "./gasUsage";

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** The middle supply charge ($ a day) of the gas plans on a network. */
export function medianGasSupply(zone: GasZone, plans: GasPlanRow[] = GAS_PLANS): number {
  const s = plans.filter((p) => p[1] === zone && p[3] !== "STANDING").map((p) => p[4]).sort((a, b) => a - b);
  if (!s.length) return 0;
  return s[Math.floor(s.length / 2)];
}

/**
 * What their own gas plan would charge for other usage. Their bill is split
 * into a typical supply charge for the period and an average rate per MJ for
 * the rest, so more gas costs more at their rate, and fewer days cost less
 * supply. Never negative.
 */
export function gasPricer(o: { bill: number; mj: number; days: number; supplyPerDay: number }): (u: GasUsage) => number {
  const supply = Math.min(o.supplyPerDay * o.days, o.bill * 0.9);
  const perDay = o.days > 0 ? supply / o.days : 0;
  const rate = o.mj > 0 ? Math.max(0, o.bill - supply) / o.mj : 0;
  return (u) => Math.max(0, perDay * u.days + rate * u.mj);
}

/**
 * How a winter or a summer bill compares with their bill's daily average,
 * for the what-if chips. Uses the share of their gas that's heating.
 */
export function gasSeasonFactors(heatingShare: number): { winter: number; summer: number } {
  const m = monthsFromAnnual(365, heatingShare); // 1 MJ a day on average
  const per = (idx: number[]) => idx.reduce((a, i) => a + m.heating[i] + m.other[i], 0) / idx.reduce((a, i) => a + DAYS_IN_MONTH[i], 0);
  return { winter: per([5, 6, 7]), summer: per([11, 0, 1]) };
}

export interface GasForecastMonth { month: number; year: number; days: number; mj: number; now: number; best: number }
export interface GasForecast {
  months: GasForecastMonth[];
  next: { days: number; end: Date; mj: number; now: number; best: number };
  yearNow: number;
  yearBest: number;
  annualMj: number;
}

/**
 * Twelve months of gas from today: a year's MJ (from their bill and its
 * season) spread over the calendar, each month priced on their plan and on
 * the cheapest plan. The next bill is the next `days` days.
 */
export function forecastGasYear(o: {
  mj: number;
  days: number;
  endIso: string | null;
  heatingShare: number;
  now: (u: GasUsage) => number;
  best: (u: GasUsage) => number;
  today?: Date;
}): GasForecast | null {
  if (!(o.mj > 0) || !(o.days > 0)) return null;
  const annual = annualFromGasBill(o.mj, o.days, o.endIso, o.heatingShare);
  if (!(annual > 0)) return null;
  const m = monthsFromAnnual(annual, o.heatingShare);
  const perDay = (month: number) => (m.heating[month] + m.other[month]) / DAYS_IN_MONTH[month];
  const t0 = o.today ?? new Date();
  // Calendar days (not 24-hour steps, which drift across daylight saving).
  const dayAt = (i: number) => new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i);

  const months: GasForecastMonth[] = [];
  let nextMj = 0;
  for (let i = 0; i < 365; i++) {
    const d = dayAt(i);
    const mo = d.getMonth();
    const yr = d.getFullYear();
    const last = months[months.length - 1];
    if (!last || last.month !== mo || last.year !== yr) months.push({ month: mo, year: yr, days: 0, mj: 0, now: 0, best: 0 });
    const cur = months[months.length - 1];
    cur.days++;
    cur.mj += perDay(mo);
    if (i < o.days) nextMj += perDay(mo);
  }
  for (const x of months) {
    x.now = o.now({ days: x.days, mj: x.mj });
    x.best = o.best({ days: x.days, mj: x.mj });
    x.mj = Math.round(x.mj);
  }
  const next = { days: o.days, end: dayAt(o.days - 1), mj: Math.round(nextMj), now: o.now({ days: o.days, mj: nextMj }), best: o.best({ days: o.days, mj: nextMj }) };
  return {
    months,
    next,
    yearNow: months.reduce((a, x) => a + x.now, 0),
    yearBest: months.reduce((a, x) => a + x.best, 0),
    annualMj: Math.round(annual),
  };
}

/** A typical (middle of the market) gas plan's price, for "now" when we don't know their bill. */
export function typicalGasPricer(zone: GasZone): (u: GasUsage) => number {
  return (u) => {
    const r = rankGasPlans(zone, u);
    return r.length ? r[Math.floor(r.length / 2)].total : 0;
  };
}

/** One plan's price for any usage (0 if it can't be priced). */
export function planGasPricer(plan: GasPlanRow): (u: GasUsage) => number {
  return (u) => computeGasBill(plan, u) ?? 0;
}

/** The "retailer|plan" keys of the gas market offers, optionally on one network: for marketEvents({ keys }). */
export function gasOfferKeys(zone: GasZone | null = null, plans: GasPlanRow[] = GAS_PLANS): Set<string> {
  return new Set(plans.filter((p) => p[3] !== "STANDING" && (!zone || p[1] === zone)).map((p) => `${p[0]}|${p[2]}`));
}

export interface GasZoneSaving {
  zone: GasZone;
  /** $ a year: a typical (middle of the market) gas plan minus the cheapest one anyone can get. */
  save: number;
  typical: number;
  cheapest: number;
}

/**
 * The /gas page's savings line: for a gas-heated Victorian home (45 GJ a
 * year by default), the cheapest open gas plan against the middle of the
 * market on each network. Victoria has no default offer for gas, so the
 * middle plan is the yardstick.
 */
export function gasSavingsByZone(mjYear = 45_000, plans: GasPlanRow[] = GAS_PLANS): GasZoneSaving[] {
  const out: GasZoneSaving[] = [];
  const zones = [...new Set(plans.map((p) => p[1]))] as GasZone[];
  for (const zone of zones) {
    const r = rankGasPlans(zone, { days: 365, mj: mjYear });
    const open = r.filter((m) => !m.restricted);
    if (r.length < 3 || !open.length) continue;
    const typical = r[Math.floor(r.length / 2)].total;
    const cheapest = open[0].total;
    out.push({ zone, save: Math.max(0, typical - cheapest), typical, cheapest });
  }
  return out.sort((a, b) => b.save - a.save);
}

// Gas use for a Victorian home: how much, and when in the year. Gas is
// seasonal in a way electricity isn't: a home with gas heating burns most of
// its gas from May to September, so a winter bill scaled straight to a year
// overstates it badly and a summer bill understates it. These figures are
// typical Melbourne-climate values, rounded, used for the no-bill estimate
// and for spreading a bill's usage across the year on the chart.

export type GasHeating = "ducted" | "space" | "none";

export interface GasProfile {
  heating: GasHeating;
  hotWater: boolean;
  cooking: boolean;
  people: number; // 1..5 (5 = 5+)
}

export const DEFAULT_GAS_PROFILE: GasProfile = { heating: "ducted", hotWater: true, cooking: true, people: 3 };

/** Typical annual gas use, MJ, for the copy: a Victorian home with gas heating sits around 40-55 GJ a year; without, 10-20 GJ. */
export const VIC_GAS_HEATED_GJ = 45;
export const VIC_GAS_UNHEATED_GJ = 15;

// Share of each use that falls in each month, Jan..Dec (sums to 1).
const HEATING_BY_MONTH = [0.02, 0.02, 0.04, 0.08, 0.14, 0.18, 0.2, 0.17, 0.1, 0.04, 0.01, 0];
const HOT_WATER_BY_MONTH = [0.07, 0.065, 0.075, 0.08, 0.09, 0.1, 0.1, 0.1, 0.09, 0.085, 0.075, 0.07];
const FLAT_BY_MONTH = Array(12).fill(1 / 12) as number[];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface GasBreakdown {
  heating: number;
  hotWater: number;
  cooking: number;
  total: number;
}

/** A year's gas use in MJ, by what it's used for. */
export function estimateGasAnnual(p: GasProfile): GasBreakdown {
  const people = Math.min(5, Math.max(1, Math.round(p.people)));
  const heating = p.heating === "ducted" ? 32000 : p.heating === "space" ? 14000 : 0;
  const hotWater = p.hotWater ? 4000 + 3200 * people : 0;
  const cooking = p.cooking ? 1500 + 500 * people : 0;
  return { heating, hotWater, cooking, total: heating + hotWater + cooking };
}

/** MJ in each month, Jan..Dec, split into heating and everything else. */
export function gasByMonth(b: Pick<GasBreakdown, "heating" | "hotWater" | "cooking">): { heating: number[]; other: number[] } {
  const heating = HEATING_BY_MONTH.map((w) => b.heating * w);
  const other = HOT_WATER_BY_MONTH.map((w, i) => b.hotWater * w + b.cooking * FLAT_BY_MONTH[i]);
  return { heating, other };
}

/** The share of a year's gas that falls in a billing period ending on `endIso`
 *  (YYYY-MM-DD), for a home whose gas is `heatingShare` heating (0..1). Days
 *  are weighted by their month's share. Null end date: a flat days/365. */
export function periodShareOfYear(days: number, endIso: string | null, heatingShare: number): number {
  if (!(days > 0)) return 0;
  const end = endIso && /^\d{4}-\d{2}-\d{2}$/.test(endIso) ? new Date(`${endIso}T00:00:00Z`) : null;
  if (!end || Number.isNaN(end.getTime())) return days / 365;
  const hs = Math.min(1, Math.max(0, heatingShare));
  let share = 0;
  const d = new Date(end);
  for (let i = 0; i < days; i++) {
    const m = d.getUTCMonth();
    const perDay = (hs * HEATING_BY_MONTH[m] + (1 - hs) * HOT_WATER_BY_MONTH[m]) / DAYS_IN_MONTH[m];
    share += perDay;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return Math.min(1.5, share);
}

/** How much of a home's gas is heating: known from the profile, or guessed from how much it uses a day. */
export function heatingShareFor(p: GasProfile | null, mjPerDay: number | null): number {
  if (p) { const b = estimateGasAnnual(p); return b.total > 0 ? b.heating / b.total : 0; }
  // A home using more than about 60 MJ a day on average is almost certainly heating with gas.
  if (mjPerDay !== null && mjPerDay > 60) return 0.65;
  if (mjPerDay !== null && mjPerDay > 35) return 0.4;
  return 0.1;
}

/** A year's gas, MJ, from one bill: the period's MJ divided by that period's share of the year. */
export function annualFromGasBill(mj: number, days: number, endIso: string | null, heatingShare: number): number {
  const share = periodShareOfYear(days, endIso, heatingShare);
  return share > 0 ? mj / share : 0;
}

/** The months (0..11) a billing period touches, for highlighting on the chart. */
export function periodMonths(days: number, endIso: string | null): number[] {
  const end = endIso && /^\d{4}-\d{2}-\d{2}$/.test(endIso) ? new Date(`${endIso}T00:00:00Z`) : null;
  if (!end || Number.isNaN(end.getTime()) || !(days > 0)) return [];
  const out = new Set<number>();
  const d = new Date(end);
  for (let i = 0; i < days; i++) { out.add(d.getUTCMonth()); d.setUTCDate(d.getUTCDate() - 1); }
  return [...out];
}

/** MJ per month for a home whose year is `annual` MJ with `heatingShare` of it heating. */
export function monthsFromAnnual(annual: number, heatingShare: number): { heating: number[]; other: number[] } {
  const hs = Math.min(1, Math.max(0, heatingShare));
  return gasByMonth({ heating: annual * hs, hotWater: annual * (1 - hs), cooking: 0 });
}

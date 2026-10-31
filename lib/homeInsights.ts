// Dashboard insights built from the member's own usage (31 Oct 2026):
// a year forecast month by month, priced on their plan and the cheapest
// plan; and how their usage compares with what our model expects for a home
// with their setup. Estimates, and the pages say so.

import { VDO, computeBill, type Distributor, type PlanRow, type UsageInput } from "./plans";
import type { CurrentRates } from "./billExtraction";
import { MONTH_DAYS, forecastFromBill, monthlyEstimate, type HomeProfile, type UsageBreakdown } from "./profileUsage";

/** Grid kWh in a usage (all bands plus controlled load). */
export const kwhOf = (u: UsageInput) => u.peak + u.shoulder + u.offpeak + u.anytime + u.cl;

/** The same mix of bands, scaled to `kwh` over `days`, with a given export. */
export function scaleUsage(u: UsageInput, kwh: number, days: number, exportKwh: number): UsageInput {
  const base = kwhOf(u);
  const f = base > 0 ? kwh / base : 0;
  return { ...u, days, peak: u.peak * f, shoulder: u.shoulder * f, offpeak: u.offpeak * f, anytime: u.anytime * f, cl: u.cl * f, solarExportKwh: exportKwh };
}

/** Their own plan as a priceable row, when the bill gave us its rates. */
export function planFromRates(r: CurrentRates | null | undefined, network: Distributor): PlanRow | null {
  if (!r || r.supply === null || (r.anytime === null && r.peak === null)) return null;
  return ["Your plan", network, "Your plan", "MARKET", r.supply, r.anytime, r.peak, r.shoulder, r.offpeak, r.cl, r.solarFit];
}

export type Pricer = (u: UsageInput) => number;

/**
 * How we price "your plan" at another usage: the bill's own rates when we have
 * them; otherwise the bill split into the network's typical supply charge and
 * one average price per kWh (good enough for a forecast, and labelled so).
 */
export function currentPricer(opts: { rates?: CurrentRates | null; network: Distributor; you: number; base: UsageInput }): Pricer {
  const row = planFromRates(opts.rates, opts.network);
  if (row) {
    const check = computeBill(row, opts.base);
    if (check !== null) return (u) => computeBill(row, u) ?? 0;
  }
  const supply = VDO[opts.network].supply;
  const kwh = kwhOf(opts.base);
  const rate = kwh > 0 ? Math.max(0.05, (opts.you - supply * opts.base.days) / kwh) : VDO[opts.network].usage;
  return (u) => supply * u.days + rate * kwhOf(u);
}

export interface ForecastMonth {
  /** 0 = January */
  month: number;
  year: number;
  days: number;
  kwh: number;
  now: number;
  best: number;
}

export interface Forecast {
  months: ForecastMonth[];
  yearNow: number;
  yearBest: number;
  /** The next bill: from today, as long as their last one. */
  next: { days: number; end: Date; kwh: number; now: number; best: number };
  /** Was the seasonal shape from their answers (true) or flat (false)? */
  seasonal: boolean;
  /** The month we assumed their last bill ended in. */
  billEndMonth: number;
}

/**
 * Twelve months from this month. kWh follow the home's seasonal shape (from
 * their answers, scaled so the bill's months match the bill) or, without
 * answers, the bill's daily average. Each month is priced on their plan and
 * on the cheapest plan.
 */
export function forecastYear(opts: {
  base: UsageInput;
  profile: HomeProfile | null;
  now: Pricer;
  best: Pricer;
  today?: Date;
  /** Month their last bill ended in (0 = Jan). Defaults to last month. */
  billEndMonth?: number;
}): Forecast | null {
  const { base } = opts;
  const baseKwh = kwhOf(base);
  if (!(baseKwh > 0) || !(base.days > 0)) return null;
  const today = opts.today ?? new Date();
  const billEndMonth = opts.billEndMonth ?? (today.getMonth() + 11) % 12;
  const fc = opts.profile ? forecastFromBill(opts.profile, { kwh: baseKwh, days: base.days, endMonth: billEndMonth }) : null;
  const perDay = baseKwh / base.days;
  const exportYear = ((base.solarExportKwh ?? 0) / base.days) * 365;
  const modelExports = fc ? fc.months.map((m) => m.solarExportKwh) : null;
  const exportSum = modelExports ? modelExports.reduce((a, b) => a + b, 0) : 0;

  const months: ForecastMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const month = (today.getMonth() + i) % 12;
    const year = today.getFullYear() + Math.floor((today.getMonth() + i) / 12);
    const days = MONTH_DAYS[month];
    const kwh = fc ? fc.months[month].kwh : perDay * days;
    const exp = exportYear > 0 ? (modelExports && exportSum > 0 ? exportYear * (modelExports[month] / exportSum) : (exportYear * days) / 365) : 0;
    const u = scaleUsage(base, kwh, days, exp);
    months.push({ month, year, days, kwh: Math.round(kwh), now: opts.now(u), best: opts.best(u) });
  }

  // The next bill: today forward for as many days as the last one.
  let left = Math.round(base.days);
  let i = 0;
  let firstLeft = MONTH_DAYS[today.getMonth()] - today.getDate() + 1;
  const next = { days: left, end: new Date(today.getTime() + left * 86400000), kwh: 0, now: 0, best: 0 };
  while (left > 0 && i < 12) {
    const m = months[i];
    const take = Math.min(left, i === 0 ? firstLeft : m.days);
    const share = take / m.days;
    next.kwh += m.kwh * share;
    next.now += m.now * share;
    next.best += m.best * share;
    left -= take;
    i++;
    firstLeft = 0;
  }
  next.kwh = Math.round(next.kwh);
  return {
    months,
    yearNow: months.reduce((a, m) => a + m.now, 0),
    yearBest: months.reduce((a, m) => a + m.best, 0),
    next,
    seasonal: !!fc,
    billEndMonth,
  };
}

export interface LikeYours {
  /** Their grid kWh a day. */
  you: number;
  /** What our model expects for a home with their setup, kWh a day. */
  typical: number;
  /** you ÷ typical (1 = spot on). */
  ratio: number;
  breakdown: UsageBreakdown;
}

/** Their usage against the model's figure for a home with their answers. */
export function likeYours(profile: HomeProfile, base: UsageInput): LikeYours | null {
  const kwh = kwhOf(base);
  if (!(kwh > 0) || !(base.days > 0)) return null;
  const { breakdown } = monthlyEstimate(profile);
  const typical = breakdown.total / 365;
  if (!(typical > 0)) return null;
  const you = kwh / base.days;
  return { you, typical, ratio: you / typical, breakdown };
}

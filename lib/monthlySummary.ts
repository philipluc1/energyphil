// The facts for a member's monthly summary email (31 Oct 2026). Pure: the
// cron gathers the member's row, this works out the numbers with the same
// maths as the dashboard cards (year ahead, Midday Power Saver, price-rise
// watch, rewards, homes like yours), and lib/emailTemplates.ts words it.

import { computeBill, findPlanRow, rankPlans, topOpen, type Distributor, type UsageInput } from "./plans";
import { MONTH_NAMES } from "./profileUsage";
import type { CurrentRates } from "./billExtraction";
import type { HomeProfile } from "./profileUsage";
import { currentPricer, forecastYear, kwhOf, likeYours } from "./homeInsights";
import { middayEstimate, shiftToMidday } from "./middayPowerSaver";
import { vdoBillForUsage } from "./profileUsage";
import { dailyChanges, marketEvents } from "./marketActivity";
import { shapeForProfile, usageCurve } from "./usageShape";
import { extrasFor } from "./planExtras";
import { rewardsIn } from "./rewards";
import { SAVE_TIPS, type SaveTip } from "./learnContent";
import { WORTH_SWITCHING_PER_YEAR } from "./dataPolicy";

/** Turn the extra sections off here to go back to the short monthly check. */
export const MONTHLY_SUMMARY_EXTRAS = true;

export interface SummaryInput {
  network: Distributor;
  usage: UsageInput;
  /** What they pay now for `usage` (bill, their rates, or the default offer). */
  reference: number;
  vsBill: boolean;
  rates: CurrentRates | null;
  profile: HomeProfile | null;
  ev: boolean;
  best: { retailer: string; planName: string; total: number };
  discountEndsAt: string | null;
  fixedUntil: string | null;
  now: Date;
}

export interface SummaryFacts {
  /** Next bill, from today, as long as their last one. */
  nextBill: { now: number; best: number; days: number; end: string } | null;
  /** The nearest discount or fixed-price end within 90 days. */
  ending: { what: "discount" | "fixed price"; date: string; days: number } | null;
  /** Midday Power Saver, a year. */
  midday: { asIsYear: number; choresYear: number; bestYear: number } | null;
  /** The biggest sign-up credit on their network, on that retailer's cheapest plan carrying it. */
  credit: { retailer: string; amount: number; yearOneVsNow: number } | null;
  /** Their kWh a day against the model for their setup. */
  like: { you: number; typical: number } | null;
  tip: SaveTip;
  /** For the charts. */
  charts: {
    /** A year on: what they pay now, the cheapest plan, the default offer. */
    year: { you: number; best: number; vdo: number; vsBill: boolean };
    /** Twelve months from this one, on their plan; `next` marks the next bill. */
    months: { label: string; now: number; best: number; next: boolean }[] | null;
    /** Changes on their network each day of the last 30. */
    market: { newOffers: number; priceChanges: number }[] | null;
    /** Their day, hour by hour, with washing and the dishwasher at midday. */
    hourly: number[] | null;
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);

export function summaryFacts(i: SummaryInput): SummaryFacts {
  const u = i.usage;
  const today = iso(i.now);
  const perYear = 365 / u.days;

  // Year ahead: only against a real bill (an estimate of an estimate helps nobody).
  let nextBill: SummaryFacts["nextBill"] = null;
  let months: SummaryFacts["charts"]["months"] = null;
  const bestRow = findPlanRow(i.best.retailer, i.best.planName, i.network);
  if (i.vsBill && bestRow && kwhOf(u) > 0) {
    const now = currentPricer({ rates: i.rates, network: i.network, you: i.reference, base: u });
    const f = forecastYear({ base: u, profile: i.profile, now, best: (x) => computeBill(bestRow, x) ?? 0, today: i.now });
    if (f) {
      nextBill = { now: f.next.now, best: f.next.best, days: f.next.days, end: iso(f.next.end) };
      // Which months the next bill covers (today's month first).
      let left = f.next.days - (f.months[0].days - i.now.getUTCDate() + 1);
      months = f.months.map((m, k) => {
        const next = k === 0 || left > 0;
        if (k > 0) left -= m.days;
        return { label: MONTH_NAMES[m.month].slice(0, 1), now: m.now, best: m.best, next };
      });
    }
  }

  // The nearest date they told us about, if it's within three months.
  const dates = [
    i.discountEndsAt ? { what: "discount" as const, date: i.discountEndsAt } : null,
    i.fixedUntil ? { what: "fixed price" as const, date: i.fixedUntil } : null,
  ]
    .filter((x): x is { what: "discount" | "fixed price"; date: string } => !!x)
    .map((x) => ({ ...x, days: daysBetween(today, x.date) }))
    .filter((x) => x.days >= 0 && x.days <= 90)
    .sort((a, b) => a.days - b.days);
  const ending = dates[0] ?? null;

  // Midday Power Saver: like for like, without solar credit or hot-water meter.
  let midday: SummaryFacts["midday"] = null;
  let hourly: number[] | null = null;
  const general = u.peak + u.shoulder + u.offpeak + u.anytime;
  if (general > 0) {
    const plain = { ...u, cl: 0, solarExportKwh: 0 };
    const top = topOpen(rankPlans(i.network, plain, { ev: i.ev, hasSolar: false }));
    if (top) {
      const shape = shapeForProfile(i.profile);
      const curve = usageCurve(shape, general / u.days, { evOvernight: !!i.profile?.ev && i.profile.evCharging !== "anytime" });
      midday = middayEstimate({ network: i.network, dailyKwh: general / u.days, hourly: curve.grid, bestYear: top.total * perYear });
      hourly = shiftToMidday(shiftToMidday(curve.grid, 2, "evening"), 1.2, "evening");
    }
  }

  // The biggest sign-up credit any retailer offers on their network.
  let credit: SummaryFacts["credit"] = null;
  for (const m of rankPlans(i.network, u, { ev: i.ev, hasSolar: (u.solarExportKwh ?? 0) > 0 })) {
    if (m.restricted) continue;
    for (const r of rewardsIn(extrasFor("E", m.plan[0], m.plan[2], m.plan[1]))) {
      if (r.kind !== "credit" || !(r.value > 0)) continue;
      const yearOneVsNow = (i.reference - m.total) * perYear + r.value;
      if (!credit || r.value > credit.amount || (r.value === credit.amount && yearOneVsNow > credit.yearOneVsNow)) {
        credit = { retailer: m.plan[0], amount: r.value, yearOneVsNow };
      }
    }
  }

  const l = i.profile && i.vsBill ? likeYours(i.profile, u) : null;
  const usageTips = SAVE_TIPS.filter((t) => t.group !== "Plan");
  const tip = usageTips[(i.now.getUTCFullYear() * 12 + i.now.getUTCMonth()) % usageTips.length];

  const events = marketEvents({ days: 30, network: i.network, now: i.now.getTime() });
  const market = events.length ? dailyChanges(events, 30, i.now.getTime()).map((d) => ({ newOffers: d.newOffers, priceChanges: d.priceChanges })) : null;

  return {
    charts: {
      year: { you: i.reference * perYear, best: i.best.total * perYear, vdo: vdoBillForUsage(i.network, u) * perYear, vsBill: i.vsBill },
      months,
      market,
      hourly,
    },
    nextBill,
    ending,
    midday,
    credit,
    like: l ? { you: l.you, typical: l.typical } : null,
    tip,
  };
}

/** Is the Midday Power Saver worth a line in the email? */
export const middayWorthIt = (m: SummaryFacts["midday"]) => !!m && m.bestYear - m.choresYear >= WORTH_SWITCHING_PER_YEAR;

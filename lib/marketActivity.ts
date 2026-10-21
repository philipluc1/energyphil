// How busy the market has been: new offers and price changes, counted from
// the offer dates the daily pull keeps (lib/planTerms.ts PLAN_DATES). Used to
// show, with real numbers, that offers keep changing and members don't need
// to keep up. Counts offers (retailer + plan name), not network rows.
//
// "New" uses the same rule as the "New offer" badge on plan lists: the day
// Utilo first saw the offer, or, for offers already there when tracking began,
// the date the retailer says it took effect (CDR effectiveFrom).

import { PLANS } from "./plans";
import { PLAN_DATES, PLAN_TERMS_DATE, type PlanDates } from "./planTerms";

const DAY = 86_400_000;

export interface MarketActivity {
  /** Offers that are new in the window. */
  newOffers: number;
  /** Offers whose prices changed in the window (not counting new ones). */
  priceChanges: number;
  /** Retailers behind those offers. */
  retailers: number;
  /** True once the daily pull has dated offers; false on the starter data. */
  ready: boolean;
}

/** One offer's latest change in the window. */
export interface MarketEvent {
  /** ISO day, e.g. "2026-10-19". */
  date: string;
  retailer: string;
  plan: string;
  kind: "new" | "price";
}

interface Opts {
  days?: number;
  since?: string | null;
  network?: string | null;
  now?: number;
  dates?: Record<string, PlanDates>;
}

function isReady(opts: Opts) {
  return opts.dates ? true : !!PLAN_TERMS_DATE && Object.keys(PLAN_DATES).length > 0;
}

/** Every offer that changed in the window, newest first. */
export function marketEvents(opts: Opts = {}): MarketEvent[] {
  if (!isReady(opts)) return [];
  const now = opts.now ?? Date.now();
  const dates = opts.dates ?? PLAN_DATES;
  const since = opts.since ? Date.parse(opts.since) : NaN;
  const cutoff = Number.isFinite(since) ? since : now - (opts.days ?? 30) * DAY;
  // Offers dated ahead (effective next week) count once their day comes.
  const inWindow = (iso: string | null): iso is string => {
    if (!iso) return false;
    const t = Date.parse(`${iso}T00:00:00Z`);
    return t >= cutoff && t <= now;
  };
  const keys = new Set(PLANS.filter((p) => !opts.network || p[1] === opts.network).map((p) => `${p[0]}|${p[2]}`));
  const out: MarketEvent[] = [];
  for (const key of keys) {
    const d = dates[key];
    if (!d) continue;
    const [retailer, ...rest] = key.split("|");
    const plan = rest.join("|");
    const newDate = d.seen ?? d.from;
    if (inWindow(newDate)) out.push({ date: newDate, retailer, plan, kind: "new" });
    else if (inWindow(d.priceChanged)) out.push({ date: d.priceChanged, retailer, plan, kind: "price" });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.retailer.localeCompare(b.retailer)));
}

export function marketActivity(opts: Opts = {}): MarketActivity {
  const ready = isReady(opts);
  if (!ready) return { newOffers: 0, priceChanges: 0, retailers: 0, ready };
  const events = marketEvents(opts);
  return {
    newOffers: events.filter((e) => e.kind === "new").length,
    priceChanges: events.filter((e) => e.kind === "price").length,
    retailers: new Set(events.map((e) => e.retailer)).size,
    ready,
  };
}

/** Changes per day for the last `days` days (oldest first), for a bar chart. */
export function dailyChanges(events: MarketEvent[], days = 30, now = Date.now()): { date: string; newOffers: number; priceChanges: number }[] {
  const today = new Date(now).toISOString().slice(0, 10);
  const end = Date.parse(`${today}T00:00:00Z`);
  const out = Array.from({ length: days }, (_, i) => ({ date: new Date(end - (days - 1 - i) * DAY).toISOString().slice(0, 10), newOffers: 0, priceChanges: 0 }));
  const at = new Map(out.map((d, i) => [d.date, i]));
  for (const e of events) {
    const i = at.get(e.date);
    if (i === undefined) continue;
    if (e.kind === "new") out[i].newOffers++;
    else out[i].priceChanges++;
  }
  return out;
}

/** "12 new offers and 30 price changes" (or just one part when the other is 0). */
export function activityWords(a: MarketActivity): string {
  const n = (k: number, one: string, many: string) => `${k.toLocaleString("en-AU")} ${k === 1 ? one : many}`;
  const parts = [a.newOffers ? n(a.newOffers, "new offer", "new offers") : "", a.priceChanges ? n(a.priceChanges, "price change", "price changes") : ""].filter(Boolean);
  return parts.join(" and ");
}

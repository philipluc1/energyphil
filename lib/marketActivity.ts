// How busy the market has been: new offers and price changes, counted from
// the offer dates the daily pull keeps (lib/planTerms.ts PLAN_DATES). Used to
// show, with real numbers, that offers keep changing and members don't need
// to keep up. Counts offers (retailer + plan name), not network rows.

import { PLANS } from "./plans";
import { PLAN_DATES, PLAN_TERMS_DATE, type PlanDates } from "./planTerms";

export interface MarketActivity {
  /** Offers first seen in the window. */
  newOffers: number;
  /** Offers whose prices changed in the window (not counting new ones). */
  priceChanges: number;
  /** Retailers behind those offers. */
  retailers: number;
  /** True once the daily pull has dated offers; false on the starter data. */
  ready: boolean;
}

export function marketActivity(opts: { days?: number; since?: string | null; network?: string | null; now?: number; dates?: Record<string, PlanDates> } = {}): MarketActivity {
  const now = opts.now ?? Date.now();
  const dates = opts.dates ?? PLAN_DATES;
  const ready = opts.dates ? true : !!PLAN_TERMS_DATE && Object.keys(PLAN_DATES).length > 0;
  if (!ready) return { newOffers: 0, priceChanges: 0, retailers: 0, ready };
  const since = opts.since ? Date.parse(opts.since) : NaN;
  const cutoff = Number.isFinite(since) ? since : now - (opts.days ?? 30) * 86_400_000;
  const keys = new Set(PLANS.filter((p) => !opts.network || p[1] === opts.network).map((p) => `${p[0]}|${p[2]}`));
  const after = (iso: string | null) => !!iso && Date.parse(`${iso}T00:00:00Z`) >= cutoff;
  let newOffers = 0;
  let priceChanges = 0;
  const retailers = new Set<string>();
  for (const key of keys) {
    const d = dates[key];
    if (!d) continue;
    if (after(d.seen)) newOffers++;
    else if (after(d.priceChanged)) priceChanges++;
    else continue;
    retailers.add(key.split("|")[0]);
  }
  return { newOffers, priceChanges, retailers: retailers.size, ready };
}

/** "12 new offers and 30 price changes" (or just one part when the other is 0). */
export function activityWords(a: MarketActivity): string {
  const n = (k: number, one: string, many: string) => `${k.toLocaleString("en-AU")} ${k === 1 ? one : many}`;
  const parts = [a.newOffers ? n(a.newOffers, "new offer", "new offers") : "", a.priceChanges ? n(a.priceChanges, "price change", "price changes") : ""].filter(Boolean);
  return parts.join(" and ");
}

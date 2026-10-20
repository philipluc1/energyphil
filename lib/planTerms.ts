// Fixed vs variable prices for each plan.
//
// The daily pull (scripts/pull-plans.mjs) rewrites the two constants below
// from each plan's Consumer Data Right `isFixed` flag. Until the first pull
// has run, we fall back to the plan name ("Rate Fix", "Fixed", "Price Lock").

export const PLAN_TERMS_DATE: string | null = null;

export const FIXED_PLAN_KEYS: string[] = [];

export type PriceType = "fixed" | "variable";

const FIXED = new Set(FIXED_PLAN_KEYS);

export function planPriceType(retailer: string, planName: string): PriceType {
  if (PLAN_TERMS_DATE) return FIXED.has(`${retailer}|${planName}`) ? "fixed" : "variable";
  return /rate ?fix|fixed|price ?lock|locked|guarantee/i.test(planName) ? "fixed" : "variable";
}

export const PRICE_TYPE_LABEL: Record<PriceType, string> = { fixed: "Fixed", variable: "Can change" };

export const PRICE_TYPE_HELP: Record<PriceType, string> = {
  variable: "Prices can change: the retailer can change your rates with notice (most plans work like this). In Victoria it usually happens once a year, around 1 July.",
  fixed: "Fixed: your rates are locked for a set period (usually 1–2 years). Check the end date, because the rates can jump when it ends.",
};

// ---------------------------------------------------------------------------
// Offer dates. The daily pull rewrites PLAN_DATES below:
//   from          the date the retailer says this offer took effect (CDR effectiveFrom)
//   updated       when the retailer last updated the offer (CDR lastUpdated)
//   seen          the day Utilo first saw the offer (null = here before tracking began)
//   priceChanged  the last day we saw its prices change
// Keyed "retailer|plan name". Empty until the first pull with this code.

export interface PlanDates {
  from: string | null;
  updated: string | null;
  seen: string | null;
  priceChanged: string | null;
}

export const PLAN_DATES: Record<string, PlanDates> = {};

/** How many days an offer counts as "new" or a price change as "recent". */
export const RECENT_DAYS = 30;

const daysAgo = (iso: string | null, now = Date.now()) =>
  iso ? Math.floor((now - Date.parse(iso + "T00:00:00Z")) / 86_400_000) : Infinity;

export function fmtOfferDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export interface OfferDateInfo {
  /** e.g. "Offer from 3 Oct 2026" */
  label: string | null;
  /** A short badge: "New" or "Price cut" or "Price change", recent only. */
  badge: "New" | "Price change" | null;
  /** The date behind the badge, e.g. "12 Oct 2026". */
  badgeDate: string | null;
}

export function offerDates(retailer: string, planName: string, now = Date.now()): OfferDateInfo {
  const d = PLAN_DATES[`${retailer}|${planName}`];
  if (!d) return { label: null, badge: null, badgeDate: null };
  const start = d.from ?? d.seen;
  const label = start ? `Offer from ${fmtOfferDate(start)}` : null;
  const newDate = d.seen ?? d.from;
  if (daysAgo(newDate, now) <= RECENT_DAYS) return { label, badge: "New", badgeDate: newDate ? fmtOfferDate(newDate) : null };
  if (daysAgo(d.priceChanged, now) <= RECENT_DAYS) return { label, badge: "Price change", badgeDate: fmtOfferDate(d.priceChanged as string) };
  return { label, badge: null, badgeDate: null };
}

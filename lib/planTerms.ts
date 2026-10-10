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

export const PRICE_TYPE_LABEL: Record<PriceType, string> = { fixed: "🔒 Fixed", variable: "Can change" };

export const PRICE_TYPE_HELP: Record<PriceType, string> = {
  variable: "Prices can change: the retailer can change your rates with notice (most plans work like this). In Victoria it usually happens once a year, around 1 July.",
  fixed: "Fixed: your rates are locked for a set period (usually 1–2 years). Check the end date, because the rates can jump when it ends.",
};

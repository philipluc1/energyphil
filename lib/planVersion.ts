// Is the plan named on a bill the same product as one a retailer sells today?
// Retailers reuse names: a customer can be on an older, dearer version of
// "Saver Plus" while today's "Saver Plus" costs less (the ESC counts about
// 360,000 Victorians in this spot). We match on the words of the plan name,
// ignoring the retailer's own name and filler words.

const FILLER = new Set(["plan", "the", "and", "with", "for", "residential", "home", "energy", "electricity", "power", "offer", "market", "vic", "victoria"]);

function words(s: string, drop: Set<string>): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !FILLER.has(w) && !drop.has(w));
}

/** True when nearly every word of the bill's plan name appears in the published plan name. */
export function samePlanName(billPlan: string, publishedPlan: string, retailer: string): boolean {
  const drop = new Set(words(retailer, new Set()));
  const a = words(billPlan, drop);
  if (a.length === 0) return false;
  const b = new Set(words(publishedPlan, drop));
  const hit = a.filter((w) => b.has(w)).length;
  return hit >= Math.min(2, a.length) && hit / a.length >= 0.8;
}

export type PlanVsBill = "yourPlan" | "newRates" | "sameName" | "yourRetailer" | null;

/**
 * How a plan on sale today relates to the plan on the member's bill (1 Nov 2026):
 * - "yourPlan": same retailer, same plan name, and today's rates match the
 *   rates on their bill (within half a cent, or 1%). It really is what they pay.
 * - "newRates": same retailer and plan name, but the rates differ. Retailers
 *   reprice a plan under the same name; it's a new price, not the plan they're on.
 * - "sameName": same retailer and plan name, but we don't have their rates to compare.
 * - "yourRetailer": same retailer, a different plan.
 */
export function planVsBill(
  plan: readonly unknown[],
  bill: { retailer: string | null; planName: string | null; rates: { supply: number | null; anytime: number | null; peak: number | null; shoulder: number | null; offpeak: number | null; cl: number | null } | null },
): PlanVsBill {
  const retailer = plan[0] as string;
  if (!bill.retailer || bill.retailer !== retailer) return null;
  const name = (bill.planName ?? "").trim();
  if (!name || !samePlanName(name, plan[2] as string, retailer)) return "yourRetailer";
  const r = bill.rates;
  if (!r) return "sameName";
  const pairs: [number | null, number | null][] = [
    [r.supply, plan[4] as number | null],
    [r.anytime, plan[5] as number | null],
    [r.peak, plan[6] as number | null],
    [r.shoulder, plan[7] as number | null],
    [r.offpeak, plan[8] as number | null],
    [r.cl, plan[9] as number | null],
  ];
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.005, 0.01 * Math.max(a, b));
  let compared = 0;
  for (const [mine, theirs] of pairs) {
    if (mine === null || mine === undefined) continue;
    // A rate on the bill that the plan doesn't have (or the other way round) is a different tariff.
    if (theirs === null || theirs === undefined) return "newRates";
    if (!close(mine, theirs)) return "newRates";
    compared++;
  }
  return compared >= 2 ? "yourPlan" : "sameName";
}

export const PLAN_VS_BILL_TAG: Record<Exclude<PlanVsBill, null>, { short: string; help: string }> = {
  yourPlan: { short: "Your plan", help: "Same plan and the same rates as your bill." },
  newRates: { short: "Same name, new rates", help: "Same plan name as your bill, but the retailer has changed the rates. This is today's price for new customers, not what you're billed." },
  sameName: { short: "Same name as yours", help: "Same plan name as your bill. Add your bill's rates to see whether the price has changed." },
  yourRetailer: { short: "Your retailer", help: "A different plan from your retailer." },
};

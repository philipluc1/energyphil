import { computeBill, findPlanRow, type UsageInput } from "./plans";
import type { CurrentRates } from "./billExtraction";

/** "OVO Energy — The One Plan" (as stored when a member says they switched) → its parts. */
export function parseSwitchedTo(s: string | null | undefined): { retailer: string; plan: string } | null {
  if (!s) return null;
  const i = s.indexOf(" — ");
  if (i <= 0) return null;
  const retailer = s.slice(0, i).trim();
  const plan = s.slice(i + 3).trim();
  return retailer && plan ? { retailer, plan } : null;
}

/**
 * After a member switches, the plan they're on now is the one they moved to:
 * priced today for their usage, with its rates. Null if that plan has since
 * been withdrawn or renamed (then the last bill stands).
 */
export function switchedPlanNow(switchedTo: string | null | undefined, distributor: string, u: UsageInput): { retailer: string; plan: string; total: number; rates: CurrentRates } | null {
  const p = parseSwitchedTo(switchedTo);
  if (!p) return null;
  const row = findPlanRow(p.retailer, p.plan, distributor);
  if (!row) return null;
  const total = computeBill(row, u);
  if (total === null) return null;
  // Published rates, before the plan's discounts (the total has them).
  const rates: CurrentRates = { supply: row[4], anytime: row[5], peak: row[6], shoulder: row[7], offpeak: row[8], cl: row[9], solarFit: row[10] };
  return { retailer: p.retailer, plan: p.plan, total, rates };
}

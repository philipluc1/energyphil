// "% vs the default offer" beside each plan (4 Nov 2026, Phil). Like the
// figure retailers publish: a standard home, not this customer's bill, so the
// two line up. Dollar prices and savings elsewhere still use the customer's bill.
//
// - Usage: 4,000 kWh a year (the ESC's reference amount for homes, determination clause 5.2).
// - Single-rate plans: against the flat default offer.
// - Time-of-use plans: against the time-of-use default offer, both at 70% peak and
//   30% off-peak. The ESC leaves the split to each retailer (clause 5.4); 70/30 is
//   Utilo's stated assumption. Solar soak and solar feed-in are not counted.
// - Plans that need a controlled-load meter or a demand reading get no figure.
// Default offer rates: ESC, 1 July 2026 to 30 June 2027, GST included.
import { computeBill, type Distributor, type PlanRow } from "./plans";

export const STANDARD_KWH = 4000;
export const TOU_SPLIT = { peak: 0.7, offpeak: 0.3 };

export const VDO_FLAT: Record<Distributor, { supply: number; usage: number }> = {
  "Citipower":       { supply: 1.2114, usage: 0.2596 },
  "Powercor":        { supply: 1.3805, usage: 0.2822 },
  "United Energy":   { supply: 1.1912, usage: 0.2735 },
  "Jemena":          { supply: 1.2713, usage: 0.2747 },
  "AusNet Services": { supply: 1.2824, usage: 0.3198 },
};
/** Three-period time-of-use default offer: peak 4–9pm, off-peak 9pm–11am (solar soak 11am–4pm not used here). */
export const VDO_TOU: Record<Distributor, { supply: number; peak: number; offpeak: number }> = {
  "Citipower":       { supply: 1.2114, peak: 0.3831, offpeak: 0.2117 },
  "Powercor":        { supply: 1.3805, peak: 0.4167, offpeak: 0.2249 },
  "United Energy":   { supply: 1.1912, peak: 0.4032, offpeak: 0.2214 },
  "Jemena":          { supply: 1.2712, peak: 0.3757, offpeak: 0.2176 },
  "AusNet Services": { supply: 1.2824, peak: 0.4764, offpeak: 0.2260 },
};

/** The plan's yearly cost for the standard home, and the matching default offer. Null when it can't be compared fairly. */
export function standardVsVdo(plan: PlanRow): { plan: number; vdo: number; pct: number; tou: boolean } | null {
  const network = plan[1] as Distributor;
  const flat = VDO_FLAT[network];
  const tou = VDO_TOU[network];
  if (!flat || !tou) return null;
  const single = plan[5] !== null;
  const usage = single
    ? { days: 365, peak: 0, shoulder: 0, offpeak: 0, anytime: STANDARD_KWH, cl: 0, solarExportKwh: 0, demandKw: null }
    : { days: 365, peak: STANDARD_KWH * TOU_SPLIT.peak, shoulder: 0, offpeak: STANDARD_KWH * TOU_SPLIT.offpeak, anytime: 0, cl: 0, solarExportKwh: 0, demandKw: null };
  const cost = computeBill(plan, usage);
  if (cost === null) return null;
  const vdo = single
    ? flat.supply * 365 + flat.usage * STANDARD_KWH
    : tou.supply * 365 + STANDARD_KWH * (TOU_SPLIT.peak * tou.peak + TOU_SPLIT.offpeak * tou.offpeak);
  return { plan: cost, vdo, pct: (cost - vdo) / vdo, tou: !single };
}

// Does the bill total match the usage we're comparing on?
//
// The comparison prices every plan for one usage figure, then sets those
// prices against "what you pay now". That's only fair if "what you pay now"
// is for the same usage. A bill total for 164 kWh set against plans priced
// for 1,150 kWh makes a dear plan look cheap. So before comparing:
//   - With the customer's own rates, price their plan for the same usage and
//     check the bill total agrees (within normal discounts, fees and
//     concessions). If it doesn't, compare on their rates (like for like)
//     and flag the mismatch, with the kWh the bill really stands for.
//   - Without their rates, check the bill against the default offer for the
//     same usage. Far out (under half or over double), flag it and don't
//     compare against the bill.

import type { CurrentRates } from "./billExtraction";
import { costFromRates } from "./currentRates";
import { VDO, type Distributor, type UsageInput } from "./plans";
import { vdoBillForUsage } from "./profileUsage";

/** Bills often differ from rates × usage by discounts, fees or a concession (17.5% in Victoria). Beyond this, something's off. */
const WITH_RATES = { low: 0.75, high: 1.33 };
/** Against the default offer, plans genuinely vary a lot; only flag the clearly impossible. */
const WITHOUT_RATES = { low: 0.5, high: 2 };

export interface BillMismatch {
  billTotal: number;
  /** What the usage on file would cost: at their own rates, or on the default offer. */
  usageCost: number;
  usageKwh: number;
  days: number;
  /** About how many kWh (general use) the bill total stands for. */
  impliedKwh: number | null;
  basis: "rates" | "default";
}

export interface Reconciled {
  /** What they pay now for THIS usage, for the comparison; null when we can't say (compare with the default offer). */
  you: number | null;
  basis: "bill" | "rates" | null;
  mismatch: BillMismatch | null;
}

/** Rates as stored (JSON from the database): plausible numbers only, else null. */
export function ratesFromJson(v: unknown): CurrentRates | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const num = (k: string) => (typeof r[k] === "number" && Number.isFinite(r[k]) && (r[k] as number) >= 0 && (r[k] as number) < 6 ? (r[k] as number) : null);
  const out: CurrentRates = { supply: num("supply"), anytime: num("anytime"), peak: num("peak"), shoulder: num("shoulder"), offpeak: num("offpeak"), cl: num("cl"), solarFit: num("solarFit") };
  return Object.values(out).some((x) => x !== null) ? out : null;
}

const kwhOf = (u: UsageInput) => u.peak + u.shoulder + u.offpeak + u.anytime + u.cl;

/** The usage price that applies to general use: single rate, or a time-of-use blend weighted by this usage. */
function unitRate(r: CurrentRates, u: UsageInput): number | null {
  if (r.anytime !== null) return r.anytime;
  if (r.peak === null || r.offpeak === null) return null;
  const sh = r.shoulder ?? r.peak;
  const p = u.peak + u.anytime;
  const total = p + u.shoulder + u.offpeak;
  if (total <= 0) return (r.peak + r.offpeak) / 2;
  return (r.peak * p + sh * u.shoulder + r.offpeak * u.offpeak) / total;
}

/**
 * About how many kWh of general use a bill total stands for: take off supply
 * (and controlled load), add back any solar credit, divide by the usage rate.
 * Their own rates when we have them, else the default offer's for the network.
 */
export function kwhFromBill(o: { billTotal: number; days: number; distributor: Distributor; rates?: CurrentRates | null; usage?: UsageInput | null }): number | null {
  if (!(o.billTotal > 0) || !(o.days > 0)) return null;
  const u = o.usage ?? { days: o.days, peak: 0, shoulder: 0, offpeak: 0, anytime: 0, cl: 0, solarExportKwh: 0 };
  const r = o.rates ?? null;
  const own = r && r.supply !== null ? unitRate(r, u) : null;
  if (r && r.supply !== null && own !== null && own > 0) {
    const cl = u.cl > 0 && r.cl !== null ? r.cl * u.cl : 0;
    const solar = (u.solarExportKwh ?? 0) > 0 && r.solarFit !== null ? r.solarFit * (u.solarExportKwh ?? 0) : 0;
    const kwh = (o.billTotal - r.supply * o.days - cl + solar) / own;
    return kwh > 0 ? Math.round(kwh) : null;
  }
  const v = VDO[o.distributor];
  if (!v) return null;
  const kwh = (o.billTotal - v.supply * o.days) / v.usage;
  return kwh > 0 ? Math.round(kwh) : null;
}

/**
 * A bill's total moved to a different amount of use at the bill's own price
 * per kWh: the supply part stays, the usage part scales. For an estimate
 * matched to a winter bill, say: the bill covered a heavy quarter, but plans
 * are priced on the year's average for the same number of days, so the bill
 * has to be put on that same usage before the two are compared.
 */
export function billAtUsage(o: { billTotal: number; billKwh: number; usageKwh: number; days: number; supplyPerDay: number }): number {
  if (!(o.billKwh > 0) || !(o.usageKwh >= 0)) return o.billTotal;
  const fixed = o.supplyPerDay * o.days;
  const energy = o.billTotal - fixed;
  if (!(energy > 0)) return o.billTotal;
  return Math.round((fixed + energy * (o.usageKwh / o.billKwh)) * 100) / 100;
}

export function reconcileBill(o: { billTotal: number | null; rates: CurrentRates | null; usage: UsageInput; distributor: Distributor }): Reconciled {
  const bill = o.billTotal !== null && Number.isFinite(o.billTotal) && o.billTotal > 0 ? o.billTotal : null;
  const rc = costFromRates(o.rates, o.usage);
  const usageKwh = kwhOf(o.usage);
  if (bill !== null) {
    if (rc.ok && rc.total > 0) {
      const ratio = bill / rc.total;
      if (ratio < WITH_RATES.low || ratio > WITH_RATES.high) {
        return {
          you: rc.total,
          basis: "rates",
          mismatch: { billTotal: bill, usageCost: rc.total, usageKwh, days: o.usage.days, impliedKwh: kwhFromBill({ billTotal: bill, days: o.usage.days, distributor: o.distributor, rates: o.rates, usage: o.usage }), basis: "rates" },
        };
      }
      return { you: bill, basis: "bill", mismatch: null };
    }
    const vdo = vdoBillForUsage(o.distributor, o.usage);
    const ratio = vdo > 0 ? bill / vdo : 1;
    if (ratio < WITHOUT_RATES.low || ratio > WITHOUT_RATES.high) {
      return {
        you: null,
        basis: null,
        mismatch: { billTotal: bill, usageCost: vdo, usageKwh, days: o.usage.days, impliedKwh: kwhFromBill({ billTotal: bill, days: o.usage.days, distributor: o.distributor }), basis: "default" },
      };
    }
    return { you: bill, basis: "bill", mismatch: null };
  }
  if (rc.ok) return { you: rc.total, basis: "rates", mismatch: null };
  return { you: null, basis: null, mismatch: null };
}

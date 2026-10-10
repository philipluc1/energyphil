// The rates someone pays now, typed in from their bill (or read off it).
// The form holds what they typed (cents, as printed); everything else uses
// GST-inclusive dollars, the same units as lib/plans.ts.

import type { CurrentRates } from "./billExtraction";
import { computeBill, type PlanRow, type UsageInput } from "./plans";

export type PriceTypeAnswer = "variable" | "fixed" | "unsure";

export interface RatesForm {
  supply: string;   // c/day
  anytime: string;  // c/kWh
  peak: string;
  shoulder: string;
  offpeak: string;
  cl: string;
  fit: string;      // solar feed-in, c/kWh (no GST)
  exGst: boolean;   // true when the bill shows rates excluding GST
  priceType: PriceTypeAnswer;
  fixedUntil: string; // YYYY-MM-DD
  discountEnds: string; // YYYY-MM-DD, when a discount / benefit period ends
  planName: string;
}

export const EMPTY_RATES_FORM: RatesForm = {
  supply: "", anytime: "", peak: "", shoulder: "", offpeak: "", cl: "", fit: "",
  exGst: false, priceType: "unsure", fixedUntil: "", discountEnds: "", planName: "",
};

function centsToDollars(raw: string, max: number, gst: number, allowZero = false): number | null {
  if (raw.trim() === "") return null;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < 0 || (n === 0 && !allowZero) || n > max) return null;
  return Math.round((n / 100) * gst * 1e5) / 1e5;
}

/** Typed rates → GST-inclusive dollars, or null if nothing usable was entered. */
export function ratesFromForm(f: RatesForm): CurrentRates | null {
  const gst = f.exGst ? 1.1 : 1;
  const r: CurrentRates = {
    supply: centsToDollars(f.supply, 500, gst),
    anytime: centsToDollars(f.anytime, 120, gst),
    peak: centsToDollars(f.peak, 120, gst, true),
    shoulder: centsToDollars(f.shoulder, 120, gst, true),
    offpeak: centsToDollars(f.offpeak, 120, gst, true),
    cl: centsToDollars(f.cl, 120, gst),
    solarFit: centsToDollars(f.fit, 60, 1),
  };
  return Object.values(r).some((v) => v !== null) ? r : null;
}

const toCents = (v: number | null) => (v === null ? "" : String(Math.round(v * 100 * 100) / 100));

/** Rates read off a bill → the form, so people can see and fix them. */
export function ratesToForm(r: CurrentRates | null, extra?: Partial<RatesForm>): RatesForm {
  return {
    ...EMPTY_RATES_FORM,
    ...(r
      ? { supply: toCents(r.supply), anytime: toCents(r.anytime), peak: toCents(r.peak), shoulder: toCents(r.shoulder), offpeak: toCents(r.offpeak), cl: toCents(r.cl), fit: toCents(r.solarFit) }
      : {}),
    ...extra,
  };
}

export type RatesCostResult =
  | { ok: true; total: number }
  | { ok: false; reason: "incomplete" | "needSplit" | "needCl" };

/** What their own plan costs for this usage, priced from the rates they typed. */
export function costFromRates(r: CurrentRates | null, usage: UsageInput): RatesCostResult {
  if (!r || r.supply === null) return { ok: false, reason: "incomplete" };
  const hasSingle = r.anytime !== null;
  const hasTou = r.peak !== null && r.offpeak !== null;
  if (!hasSingle && !hasTou) return { ok: false, reason: "incomplete" };
  if (usage.cl > 0 && r.cl === null) return { ok: false, reason: "needCl" };
  const row: PlanRow = ["Your plan", "", "Your plan", "MARKET", r.supply, hasSingle ? r.anytime : null, hasSingle ? null : r.peak, hasSingle ? null : r.shoulder, hasSingle ? null : r.offpeak, r.cl, r.solarFit];
  const total = computeBill(row, usage);
  if (total === null) return { ok: false, reason: hasTou && !hasSingle ? "needSplit" : "incomplete" };
  return { ok: true, total };
}

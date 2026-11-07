import { DISTRIBUTORS, Distributor } from "./plans";

export interface ExtractedBill {
  isElectricityBill: boolean;
  fuel: "electricity" | "gas" | "dual" | null;
  gasDistributor: string | null;
  gasBillingDays: number | null;
  gasMj: number | null;
  gasBillTotal: number | null;
  gasPlanName: string | null;
  /** 7 Nov 2026: the gas rates printed on the bill, for "your rates vs the cheapest" on the gas dashboard. */
  gasSupplyCentsPerDay: number | null;
  gasUsageCentsPerMj: number | null;
  distributor: Distributor | null;
  retailerName: string | null;
  nmi: string | null;
  planName: string | null;
  tariffType: string | null;
  billingDays: number | null;
  /** Last day of the billing period, YYYY-MM-DD, when the bill shows it. */
  periodEnd: string | null;
  /** This bill's own charges (2 Nov 2026): the new charges when the bill shows them, so a balance
   *  carried over from an earlier bill (or a payment taken off) never counts as this period's cost. */
  currentBill: number | null;
  /** The total amount due as printed, when it differs from this bill's charges. Shown, never stored. */
  amountDue?: number | null;
  usageMode: "simple" | "detailed" | null;
  anytimeKwh: number | null;
  peakKwh: number | null;
  shoulderKwh: number | null;
  offpeakKwh: number | null;
  controlledLoadKwh: number | null;
  // Account holder's name and supply address, read straight off the bill —
  // used to pre-fill the sign-up form, never required to see a comparison.
  customerName: string | null;
  address: string | null;
  suburb: string | null;
  postcode: string | null;
  /** Residential or business account, if the bill says. */
  accountType: "residential" | "business" | null;
  /** Supplied through a building's private (embedded) network. */
  embeddedNetwork: boolean;
  /** The bill has a demand charge ($/kW or $/kVA): a demand tariff (some homes, most businesses). */
  demandCharge: boolean;
  /** The max demand that charge was based on, in kW, when the bill shows it. */
  demandKw: number | null;
  // True if the bill shows any solar feed-in credit line, even a small one.
  hasSolar: boolean;
  /** The retailer estimated the read (7 Nov 2026): the usage may be corrected on the next bill. */
  usageEstimated: boolean;
  solarExportKwh: number | null;
  /** Current plan's rates in GST-inclusive dollars (supply per day, usage per kWh), as read off the bill. */
  currentRates: CurrentRates | null;
  priceType: "fixed" | "variable" | null;
  priceFixedUntil: string | null;
  /** When a discount or benefit period ends, if the bill says. */
  discountEndsAt: string | null;
  /** Bill checks: was the meter read, any debt, a concession, the retailer's own best offer message. */
  readingType: "actual" | "estimated" | "mixed" | null;
  overdueAmount: number | null;
  paymentPlan: boolean;
  concessionApplied: boolean;
  bestOffer: { planName: string | null; savingPerYear: number | null; saysOnBest: boolean } | null;
  /** 2 Nov 2026: this period's new charges (before balances carried forward), fees, and a lost discount. */
  newCharges: number | null;
  fees: { kind: "late_payment" | "paper_bill" | "payment_processing" | "reconnection" | "other"; amount: number }[];
  discountLost: boolean;
  /** Looks like only part of a longer bill (e.g. "Page 1 of 2", or the summary page without usage and charges). */
  looksPartial: boolean;
  /** How many pages (photos) this read came from. */
  pages?: number;
  warnings: string[];
}

export interface CurrentRates {
  supply: number | null;
  anytime: number | null;
  peak: number | null;
  shoulder: number | null;
  offpeak: number | null;
  cl: number | null;
  solarFit: number | null;
}

const FEE_KINDS = ["late_payment", "paper_bill", "payment_processing", "reconnection", "other"] as const;
/** Fees off the bill: known kinds only, positive amounts under $500, at most 6. */
export function readFees(v: unknown): ExtractedBill["fees"] {
  if (!Array.isArray(v)) return [];
  const out: ExtractedBill["fees"] = [];
  for (const f of v.slice(0, 6)) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const kind = FEE_KINDS.find((k) => k === o.kind) ?? "other";
    const amount = toFiniteNumber(o.amount_dollars ?? o.amount);
    if (amount !== null && amount > 0 && amount < 500) out.push({ kind, amount: Math.round(amount * 100) / 100 });
  }
  return out;
}

/** Bill rates arrive in cents as printed; convert to GST-inclusive dollars
 *  (the same units as lib/plans.ts) and drop anything implausible. */
function readRates(r: Record<string, unknown>): CurrentRates | null {
  const gst = r.rates_include_gst === false ? 1.1 : 1;
  const cents = (k: string, max: number, withGst = true, allowZero = false) => {
    // Bills often print the feed-in as a credit ("-0.040 c/kWh"): the rate is what matters, not the sign.
    const raw = k === "solar_fit_cents" && typeof r[k] === "number" ? Math.abs(r[k] as number) : r[k];
    const n = toFiniteNumber(raw);
    if (n === null || (n === 0 && !allowZero) || n > max) return null;
    return Math.round((n / 100) * (withGst ? gst : 1) * 1e5) / 1e5;
  };
  const rates: CurrentRates = {
    supply: cents("supply_charge_cents_per_day", 500),
    anytime: cents("anytime_rate_cents", 120),
    peak: cents("peak_rate_cents", 120, true, true),
    shoulder: cents("shoulder_rate_cents", 120, true, true),
    offpeak: cents("offpeak_rate_cents", 120, true, true),
    cl: cents("controlled_load_rate_cents", 120),
    solarFit: cents("solar_fit_cents", 60, false),
  };
  return Object.values(rates).some((v) => v !== null) ? normaliseRates(rates) : null;
}

/**
 * The feed-in rate against the credit actually paid (2 Nov 2026: a Tango bill
 * paid 7c for 163 kWh, i.e. 0.04c a kWh, but the rate came through as 4c).
 * When the credit and the export are both shown and the rate is out by more
 * than 3 times, the credit wins: it's the money on the bill.
 */
export function checkFit(r: CurrentRates | null, exportKwh: number | null, credit: number | null): CurrentRates | null {
  if (!exportKwh || exportKwh < 5 || credit === null || credit < 0 || credit > 5000) return r;
  const implied = Math.round((credit / exportKwh) * 1e6) / 1e6;
  if (implied > 0.6) return r;
  if (!r) return { supply: null, anytime: null, peak: null, shoulder: null, offpeak: null, cl: null, solarFit: implied };
  if (r.solarFit === null || (implied > 0 && (r.solarFit / implied > 3 || r.solarFit / implied < 1 / 3))) return { ...r, solarFit: implied };
  return r;
}

/**
 * One usage price on its own is a single rate, whatever the bill calls it
 * (2 Nov 2026: a Tango bill's one "peak" price showed as "Usage, peak" and
 * "Time of use"). Peak only counts as time of use next to an off-peak or shoulder price.
 */
export function normaliseRates<T extends CurrentRates | null | undefined>(r: T): T {
  if (!r || r.anytime !== null || r.peak === null || r.offpeak !== null || r.shoulder !== null) return r;
  return { ...r, anytime: r.peak, peak: null };
}
/** True when the rates are one price all day (after normaliseRates). */
export const isSingleRate = (r: CurrentRates | null | undefined) => !!r && r.anytime !== null && r.offpeak === null && r.shoulder === null;

/**
 * What this bill period cost. The amount due can include an overdue balance
 * from an earlier bill (or have a payment taken off it), so: the new charges
 * when shown; otherwise the amount due less any overdue balance; otherwise the amount due.
 */
export function periodCharges(amountDue: number | null, newCharges: number | null, overdue: number | null): { currentBill: number | null; amountDue: number | null } {
  const due = amountDue !== null && amountDue > 0 && amountDue < 100000 ? amountDue : null;
  const fresh = newCharges !== null && newCharges > 0 && newCharges < 100000 ? newCharges : null;
  const owed = overdue !== null && overdue > 0 ? overdue : null;
  const bill = fresh ?? (due !== null && owed !== null && due - owed > 5 ? Math.round((due - owed) * 100) / 100 : due);
  return { currentBill: bill, amountDue: due !== null && bill !== null && Math.abs(due - bill) >= 1 ? due : null };
}

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toPositiveInt(v: unknown): number | null {
  const n = toFiniteNumber(v);
  return n !== null ? Math.round(n) : null;
}

/**
 * Turns whatever the model's tool call handed back into our known shape.
 * Server-only trust boundary: an LLM response is untrusted input just like
 * any other external API, so every field is re-validated rather than cast.
 */
export function sanitizeExtractedBill(raw: unknown): ExtractedBill {
  const r = (raw ?? {}) as Record<string, unknown>;

  const warnings = Array.isArray(r.warnings)
    ? r.warnings.filter((w): w is string => typeof w === "string").slice(0, 10)
    : [];

  const distributorRaw = typeof r.distributor === "string" ? r.distributor : null;
  const distributor = distributorRaw && (DISTRIBUTORS as readonly string[]).includes(distributorRaw)
    ? (distributorRaw as Distributor)
    : null;

  const usageModeRaw = r.usage_mode;
  const usageMode = usageModeRaw === "simple" || usageModeRaw === "detailed" ? usageModeRaw : null;

  const billingDaysRaw = toPositiveInt(r.billing_days);
  const billingDays = billingDaysRaw !== null && billingDaysRaw >= 1 && billingDaysRaw <= 366 ? billingDaysRaw : null;

  const postcodeRaw = typeof r.postcode === "string" ? r.postcode.trim() : "";
  const postcode = /^\d{4}$/.test(postcodeRaw) ? postcodeRaw : null;

  // One usage band on its own is single-rate use, whatever the bill calls it (2 Nov 2026).
  const lonePeak = toFiniteNumber(r.peak_kwh) !== null && !toFiniteNumber(r.shoulder_kwh) && !toFiniteNumber(r.offpeak_kwh) && !toFiniteNumber(r.anytime_kwh) && (toFiniteNumber(r.peak_kwh) ?? 0) > 0;
  return {
    isElectricityBill: r.is_electricity_bill === true,
    fuel: r.fuel === "electricity" || r.fuel === "gas" || r.fuel === "dual" ? r.fuel : null,
    gasDistributor: ["Australian Gas Networks", "Multinet", "AusNet Services"].includes(r.gas_distributor as string) ? (r.gas_distributor as string) : null,
    gasBillingDays: (() => { const d = toPositiveInt(r.gas_billing_days); return d !== null && d >= 1 && d <= 366 ? d : null; })(),
    gasMj: toFiniteNumber(r.gas_mj),
    periodEnd: typeof r.period_end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.period_end) ? r.period_end : null,
    gasBillTotal: toFiniteNumber(r.gas_bill_total),
    gasPlanName: typeof r.gas_plan_name === "string" ? r.gas_plan_name.slice(0, 120) : null,
    gasSupplyCentsPerDay: (() => { const v = toFiniteNumber(r.gas_supply_cents_per_day); return v !== null && v > 0 && v < 1000 ? v : null; })(),
    gasUsageCentsPerMj: (() => { const v = toFiniteNumber(r.gas_usage_cents_per_mj); return v !== null && v > 0 && v < 100 ? v : null; })(),
    distributor,
    retailerName: typeof r.retailer_name === "string" ? r.retailer_name.slice(0, 80) : null,
    nmi: typeof r.nmi === "string" && /^[A-Za-z0-9]{10,11}$/.test(r.nmi.trim()) ? r.nmi.trim().toUpperCase() : null,
    planName: typeof r.plan_name === "string" ? r.plan_name.slice(0, 120) : null,
    tariffType: lonePeak && r.tariff_type === "time_of_use" ? "single_rate" : typeof r.tariff_type === "string" ? r.tariff_type.slice(0, 20) : null,
    billingDays,
    ...periodCharges(toFiniteNumber(r.current_bill_total), toFiniteNumber(r.new_charges_total), toFiniteNumber(r.overdue_amount)),
    usageMode: lonePeak ? "simple" : usageMode,
    anytimeKwh: lonePeak ? toFiniteNumber(r.peak_kwh) : toFiniteNumber(r.anytime_kwh),
    peakKwh: lonePeak ? null : toFiniteNumber(r.peak_kwh),
    shoulderKwh: toFiniteNumber(r.shoulder_kwh),
    offpeakKwh: toFiniteNumber(r.offpeak_kwh),
    controlledLoadKwh: toFiniteNumber(r.controlled_load_kwh),
    customerName: typeof r.customer_name === "string" ? r.customer_name.slice(0, 120) : null,
    address: typeof r.address === "string" ? r.address.slice(0, 200) : null,
    suburb: typeof r.suburb === "string" ? r.suburb.slice(0, 80) : null,
    postcode,
    accountType: r.account_type === "residential" || r.account_type === "business" ? r.account_type : null,
    embeddedNetwork: r.embedded_network === true,
    demandCharge: r.has_demand_charge === true,
    demandKw: (() => { const n = toFiniteNumber(r.max_demand_kw); return n !== null && n > 0 && n < 500 ? n : null; })(),
    hasSolar: r.has_solar === true,
    usageEstimated: r.usage_estimated === true,
    solarExportKwh: toFiniteNumber(r.solar_export_kwh),
    currentRates: checkFit(readRates(r), toFiniteNumber(r.solar_export_kwh), typeof r.solar_credit_total === "number" ? Math.abs(r.solar_credit_total) : null),
    priceType: r.price_type === "fixed" || r.price_type === "variable" ? r.price_type : null,
    priceFixedUntil: typeof r.price_fixed_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.price_fixed_until) ? r.price_fixed_until : null,
    discountEndsAt: typeof r.discount_ends === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.discount_ends) ? r.discount_ends : null,
    readingType: r.reading_type === "actual" || r.reading_type === "estimated" || r.reading_type === "mixed" ? r.reading_type : null,
    overdueAmount: (() => { const n = toFiniteNumber(r.overdue_amount); return n !== null && n > 0 && n < 100000 ? n : null; })(),
    paymentPlan: r.payment_plan === true,
    concessionApplied: r.concession_applied === true,
    bestOffer:
      typeof r.best_offer_plan === "string" || toFiniteNumber(r.best_offer_saving) !== null || r.best_offer_says_on_best === true
        ? {
            planName: typeof r.best_offer_plan === "string" ? r.best_offer_plan.slice(0, 120) : null,
            savingPerYear: (() => { const n = toFiniteNumber(r.best_offer_saving); return n !== null && n >= 0 && n < 10000 ? n : null; })(),
            saysOnBest: r.best_offer_says_on_best === true,
          }
        : null,
    newCharges: (() => { const n = toFiniteNumber(r.new_charges_total); return n !== null && n > 0 && n < 100000 ? n : null; })(),
    fees: readFees(r.fees),
    discountLost: r.discount_not_applied === true,
    looksPartial: r.looks_partial === true,
    warnings,
  };
}

// --- What a read is missing ----------------------------------------------
// A photo of a bill's first page often has the amount due but not the usage,
// the billing period or the rates, which are usually on page 2. These say what
// is missing, so the page can ask for another page or point to the fields.

export type BillGapKey = "usage" | "days" | "network" | "total" | "rates";
export interface BillGap {
  key: BillGapKey;
  label: string;
  /** Needed to compare plans at all (the others make the result more exact). */
  needed: boolean;
}

export function billHasUsage(b: ExtractedBill): boolean {
  return b.usageMode === "simple" ? b.anytimeKwh !== null : b.peakKwh !== null || b.offpeakKwh !== null || b.anytimeKwh !== null;
}

export function billGaps(b: ExtractedBill): BillGap[] {
  // 7 Nov 2026: gas bills too. The front page of a gas bill has the amount
  // due; the MJ, the days and the rates sit on the "understand your bill" page.
  if (b.fuel === "gas") {
    const g: BillGap[] = [];
    if (b.gasMj === null) g.push({ key: "usage", label: "how much gas you used (MJ)", needed: true });
    if (b.gasBillingDays === null && b.billingDays === null) g.push({ key: "days", label: "the billing period", needed: true });
    if (!b.gasDistributor && !b.postcode) g.push({ key: "network", label: "your gas network or postcode", needed: false });
    if (b.gasBillTotal === null && b.currentBill === null) g.push({ key: "total", label: "the gas charges", needed: false });
    if (b.gasSupplyCentsPerDay === null && b.gasUsageCentsPerMj === null) g.push({ key: "rates", label: "the rates you pay", needed: false });
    return g;
  }
  const gaps: BillGap[] = [];
  if (!billHasUsage(b)) gaps.push({ key: "usage", label: "how much electricity you used", needed: true });
  if (b.billingDays === null) gaps.push({ key: "days", label: "the billing period", needed: true });
  if (!b.distributor && !b.postcode && !b.nmi) gaps.push({ key: "network", label: "your network or postcode", needed: false });
  if (b.currentBill === null) gaps.push({ key: "total", label: "the bill total", needed: false });
  if (!b.currentRates) gaps.push({ key: "rates", label: "the rates you pay", needed: false });
  return gaps;
}

/** Worth asking for another page: something needed is missing, or the read
 *  looks like a summary page and is missing the total or the rates. */
export function shouldAskForAnotherPage(b: ExtractedBill): boolean {
  const gaps = billGaps(b);
  return gaps.some((g) => g.needed) || (b.looksPartial && gaps.some((g) => g.key === "total" || g.key === "rates"));
}

/** "a, b and c" */
export function listWords(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

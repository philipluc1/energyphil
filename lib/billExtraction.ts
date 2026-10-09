import { DISTRIBUTORS, Distributor } from "./plans";

export interface ExtractedBill {
  isElectricityBill: boolean;
  fuel: "electricity" | "gas" | "dual" | null;
  gasDistributor: string | null;
  gasBillingDays: number | null;
  gasMj: number | null;
  gasBillTotal: number | null;
  gasPlanName: string | null;
  distributor: Distributor | null;
  retailerName: string | null;
  nmi: string | null;
  planName: string | null;
  tariffType: string | null;
  billingDays: number | null;
  currentBill: number | null;
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
  // True if the bill shows any solar feed-in credit line, even a small one.
  hasSolar: boolean;
  solarExportKwh: number | null;
  warnings: string[];
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

  return {
    isElectricityBill: r.is_electricity_bill === true,
    fuel: r.fuel === "electricity" || r.fuel === "gas" || r.fuel === "dual" ? r.fuel : null,
    gasDistributor: ["Australian Gas Networks", "Multinet", "AusNet Services"].includes(r.gas_distributor as string) ? (r.gas_distributor as string) : null,
    gasBillingDays: (() => { const d = toPositiveInt(r.gas_billing_days); return d !== null && d >= 1 && d <= 366 ? d : null; })(),
    gasMj: toFiniteNumber(r.gas_mj),
    gasBillTotal: toFiniteNumber(r.gas_bill_total),
    gasPlanName: typeof r.gas_plan_name === "string" ? r.gas_plan_name.slice(0, 120) : null,
    distributor,
    retailerName: typeof r.retailer_name === "string" ? r.retailer_name.slice(0, 80) : null,
    nmi: typeof r.nmi === "string" && /^[A-Za-z0-9]{10,11}$/.test(r.nmi.trim()) ? r.nmi.trim().toUpperCase() : null,
    planName: typeof r.plan_name === "string" ? r.plan_name.slice(0, 120) : null,
    tariffType: typeof r.tariff_type === "string" ? r.tariff_type.slice(0, 20) : null,
    billingDays,
    currentBill: toFiniteNumber(r.current_bill_total),
    usageMode,
    anytimeKwh: toFiniteNumber(r.anytime_kwh),
    peakKwh: toFiniteNumber(r.peak_kwh),
    shoulderKwh: toFiniteNumber(r.shoulder_kwh),
    offpeakKwh: toFiniteNumber(r.offpeak_kwh),
    controlledLoadKwh: toFiniteNumber(r.controlled_load_kwh),
    customerName: typeof r.customer_name === "string" ? r.customer_name.slice(0, 120) : null,
    address: typeof r.address === "string" ? r.address.slice(0, 200) : null,
    suburb: typeof r.suburb === "string" ? r.suburb.slice(0, 80) : null,
    postcode,
    hasSolar: r.has_solar === true,
    solarExportKwh: toFiniteNumber(r.solar_export_kwh),
    warnings,
  };
}

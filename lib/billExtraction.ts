import { DISTRIBUTORS, Distributor } from "./plans";

export interface ExtractedBill {
  isElectricityBill: boolean;
  distributor: Distributor | null;
  retailerName: string | null;
  billingDays: number | null;
  currentBill: number | null;
  usageMode: "simple" | "detailed" | null;
  anytimeKwh: number | null;
  peakKwh: number | null;
  shoulderKwh: number | null;
  offpeakKwh: number | null;
  controlledLoadKwh: number | null;
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

  return {
    isElectricityBill: r.is_electricity_bill === true,
    distributor,
    retailerName: typeof r.retailer_name === "string" ? r.retailer_name.slice(0, 80) : null,
    billingDays,
    currentBill: toFiniteNumber(r.current_bill_total),
    usageMode,
    anytimeKwh: toFiniteNumber(r.anytime_kwh),
    peakKwh: toFiniteNumber(r.peak_kwh),
    shoulderKwh: toFiniteNumber(r.shoulder_kwh),
    offpeakKwh: toFiniteNumber(r.offpeak_kwh),
    controlledLoadKwh: toFiniteNumber(r.controlled_load_kwh),
    warnings,
  };
}

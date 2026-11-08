import type { BillDetail } from "./billTracker";

// Turns a bill (a photo read, or the tracker's typed-in form) into rows for
// the `bills` table: one per fuel the bill has. Server-side only; everything
// is checked, nothing from the browser is trusted as-is.

const num = (v: unknown, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null;
};
const isoDate = (v: unknown): string | null => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  // Not in the future, not before 2015.
  return Number.isFinite(t) && t <= Date.now() + 86_400_000 && t >= Date.parse("2015-01-01T00:00:00Z") ? v : null;
};
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export interface BillRow {
  email: string;
  fuel: "electricity" | "gas";
  period_end: string;
  billing_days: number;
  kwh: number | null;
  mj: number | null;
  amount: number | null;
  retailer: string | null;
  source: "photo" | "typed";
  detail?: BillDetail | null;
}

const creditSum = (b: Record<string, unknown>, fuel: "electricity" | "gas", kind: string) =>
  Array.isArray(b.credits)
    ? Math.round((b.credits as { kind?: unknown; fuel?: unknown; amount?: unknown }[])
        .filter((c) => c && c.fuel === fuel && (kind === "other" ? c.kind !== "concession" && c.kind !== "rebate" : c.kind === kind))
        .reduce((a, c) => a + (num(c.amount, 2000) ?? 0), 0) * 100) / 100
    : 0;
const feeSum = (b: Record<string, unknown>) =>
  Array.isArray(b.fees) ? Math.round((b.fees as { amount?: unknown }[]).reduce((a, f) => a + (num(f?.amount, 500) ?? 0), 0) * 100) / 100 : 0;

/** 8 Nov 2026: what a read bill showed beyond the totals, per fuel. Fees and the read type sit with electricity on a dual bill. */
export function billDetailFrom(b: Record<string, unknown>, fuel: "electricity" | "gas"): BillDetail {
  const gasOnly = b.fuel === "gas";
  const mine = fuel === "electricity" || gasOnly;
  const rates = b.currentRates as { supply?: unknown } | null | undefined;
  const supply = fuel === "gas" ? (() => { const c = num(b.gasSupplyCentsPerDay, 500); return c !== null ? Math.round(c) / 100 : null; })() : num(rates?.supply, 5);
  return {
    supply: supply && supply > 0 ? supply : null,
    estimated: mine && (b.readingType === "estimated" || b.readingType === "mixed" || b.usageEstimated === true),
    tariff: fuel === "electricity" ? str(b.tariffType, 40) : null,
    concession: creditSum(b, fuel, "concession"),
    rebate: creditSum(b, fuel, "rebate"),
    otherCredits: creditSum(b, fuel, "other"),
    fees: mine ? feeSum(b) : 0,
  };
}

/**
 * Accepts either an ExtractedBill (photo: electricity, gas or both) or the
 * tracker form ({ fuel, periodEnd, billingDays, kwh | mj, amount, typed: true }).
 * `fallbackEnd` is used when a photo read has no period end (e.g. today).
 */
export function billRowFrom(b: Record<string, unknown> | null, email: string, fallbackEnd: string | null = null): BillRow[] {
  if (!b || typeof b !== "object") return [];
  const typed = b.typed === true;
  const source: BillRow["source"] = typed ? "typed" : "photo";
  const retailer = str(b.retailerName ?? b.retailer, 80);
  const end = isoDate(b.periodEnd) ?? (typed ? null : fallbackEnd);
  if (!end) return [];
  const out: BillRow[] = [];
  const fuel = b.fuel;

  if (typed) {
    const f = fuel === "gas" ? "gas" : "electricity";
    const days = num(b.billingDays, 366);
    const amount = num(b.amount, 20000);
    const use = num(f === "gas" ? b.mj : b.kwh, 1_000_000);
    if (!days || days < 1 || (amount === null && use === null)) return [];
    out.push({ email, fuel: f, period_end: end, billing_days: Math.round(days), kwh: f === "electricity" ? use : null, mj: f === "gas" ? use : null, amount, retailer, source });
    return out;
  }

  if (fuel !== "gas") {
    const days = num(b.billingDays, 366);
    const kwhParts = [b.anytimeKwh, b.peakKwh, b.shoulderKwh, b.offpeakKwh, b.controlledLoadKwh].map((v) => num(v, 1_000_000) ?? 0);
    const kwh = kwhParts.reduce((a, x) => a + x, 0);
    const amount = num(b.currentBill, 20000);
    if (days && days >= 1 && (kwh > 0 || amount !== null)) {
      out.push({ email, fuel: "electricity", period_end: end, billing_days: Math.round(days), kwh: kwh > 0 ? Math.round(kwh) : null, mj: null, amount, retailer, source, detail: billDetailFrom(b, "electricity") });
    }
  }
  if (fuel === "gas" || fuel === "dual") {
    const days = num(b.gasBillingDays, 366) ?? num(b.billingDays, 366);
    const mj = num(b.gasMj, 1_000_000);
    const amount = num(b.gasBillTotal, 20000);
    if (days && days >= 1 && (mj !== null || amount !== null)) {
      out.push({ email, fuel: "gas", period_end: end, billing_days: Math.round(days), kwh: null, mj, amount, retailer, source, detail: billDetailFrom(b, "gas") });
    }
  }
  return out;
}

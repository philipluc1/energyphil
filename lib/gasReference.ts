import { gasChargesForComparison } from "./billExtraction";

/**
 * The gas figure a member's plans are compared against (8 Nov 2026). The row
 * stores the bill's total as read; when the bill's rates are on the row too,
 * rates × usage is what the plan really costs for that usage, so a stored
 * total that disagrees with it (a credit, true-up or previous balance on the
 * bill) is set aside. Members read before this fix correct themselves on the
 * next load, with no re-upload.
 */
export interface GasRefRow {
  gas_reference_total?: number | null;
  gas_mj?: number | null;
  gas_billing_days?: number | null;
  gas_rates?: { supply: number | null; usage: number | null } | null;
}

export function gasReferenceTotal(row: GasRefRow): number | null {
  const stored = row.gas_reference_total ?? null;
  const r = row.gas_rates;
  if (!r || !row.gas_mj || !row.gas_billing_days) return stored;
  return gasChargesForComparison({
    gasBillTotal: stored,
    gasMj: row.gas_mj,
    gasBillingDays: row.gas_billing_days,
    billingDays: row.gas_billing_days,
    gasSupplyCentsPerDay: r.supply ?? null,
    gasUsageCentsPerMj: r.usage ?? null,
  }).total ?? stored;
}

/** The same row with its gas reference settled. */
export function withGasReference<T extends GasRefRow>(row: T): T {
  const t = gasReferenceTotal(row);
  return t === row.gas_reference_total ? row : { ...row, gas_reference_total: t };
}

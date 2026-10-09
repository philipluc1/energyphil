// Auto-generated from live CDR pull (gas). One row per plan:
// [retailer, zone, planName, offerType, supply $/day, blocks]
// blocks: stepped usage rates in $/MJ. Each block applies up to `upTo` MJ
// (per day when perDay is true, otherwise per billing period); the last
// block has upTo null and covers everything above the previous threshold.
export interface GasBlock { upTo: number | null; rate: number }
export type GasPlanRow = [string, string, string, string, number, GasBlock[], boolean];

export const GAS_PLAN_DATA_DATE = "";

export const GAS_PLANS: GasPlanRow[] = [];

// Victoria's three gas distribution networks, as we name them.
export const GAS_ZONES = ["Australian Gas Networks", "Multinet", "AusNet Services"] as const;
export type GasZone = typeof GAS_ZONES[number];

export const GAS_RETAILER_COUNT = new Set(GAS_PLANS.map((p) => p[0])).size;
export const gasDataReady = GAS_PLANS.length > 0;

export interface GasUsage {
  days: number;
  mj: number; // total MJ for the period
}

/** Bill = supply × days + stepped usage. Blocks per day are scaled by days. */
export function computeGasBill(plan: GasPlanRow, u: GasUsage): number | null {
  const [, , , , supply, blocks, perDay] = plan;
  if (!blocks.length || u.days <= 0) return null;
  let remaining = u.mj;
  let variable = 0;
  let prev = 0;
  for (const b of blocks) {
    const cap = b.upTo === null ? Infinity : (perDay ? b.upTo * u.days : b.upTo) - prev;
    const take = Math.max(0, Math.min(remaining, cap));
    variable += take * b.rate;
    remaining -= take;
    if (b.upTo !== null) prev = perDay ? b.upTo * u.days : b.upTo;
    if (remaining <= 0) break;
  }
  if (remaining > 0) variable += remaining * blocks[blocks.length - 1].rate;
  return supply * u.days + variable;
}

export interface RankedGas { plan: GasPlanRow; total: number }

export function rankGasPlans(zone: GasZone, u: GasUsage): RankedGas[] {
  const out: RankedGas[] = [];
  for (const p of GAS_PLANS) {
    if (p[1] !== zone) continue;
    const total = computeGasBill(p, u);
    if (total !== null) out.push({ plan: p, total });
  }
  return out.sort((a, b) => a.total - b.total);
}

/** Victoria has no regulated default offer for gas, so the benchmark is the
 *  customer's own bill when given, otherwise the median market price. */
export function gasBenchmark(zone: GasZone, u: GasUsage, currentBill: number | null): { value: number; label: string } | null {
  if (currentBill !== null && currentBill > 0) return { value: currentBill, label: "your bill" };
  const r = rankGasPlans(zone, u);
  if (!r.length) return null;
  return { value: r[Math.floor(r.length / 2)].total, label: "a typical plan" };
}

/** Typical Victorian household gas use: roughly 50 MJ a day, more in winter. */
export const TYPICAL_MJ_PER_DAY = 50;

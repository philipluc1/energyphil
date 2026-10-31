// Daily Victorian price index (started 31 Oct 2026). For each network, the
// cheapest plan an average home (4,000 kWh a year, single rate, no solar) can
// get, and the Victorian Default Offer for the same usage. Appended to
// data/price-index.json by the daily pull, one entry per network per day, so
// we can later chart where prices are heading.
//
// Gas (from 1 Nov 2026) sits beside it under "gasRows": for each gas
// network, the cheapest gas plan a gas-heated home (45 GJ a year) can get,
// and a typical (middle of the market) plan for the same use. Victoria has
// no default offer for gas.
//
// Run: npx tsx scripts/price-index.ts   (after scripts/pull-plans.mjs)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISTRIBUTORS, PLAN_DATA_DATE, rankPlans, topOpen } from "../lib/plans";
import { averageUsage, vdoBillForUsage } from "../lib/profileUsage";
import { GAS_PLAN_DATA_DATE, GAS_ZONES, rankGasPlans } from "../lib/gasPlans";
import { topOpen as topOpenGas } from "../lib/planExtras";

export interface PriceIndexRow {
  date: string;
  network: string;
  /** $ a year for the cheapest plan an average home can get. */
  cheapest: number;
  retailer: string;
  plan: string;
  /** $ a year on the default offer, same usage. */
  vdo: number;
  /** Plans compared. */
  plans: number;
}

export function indexRows(date: string): PriceIndexRow[] {
  const u = averageUsage(365);
  const out: PriceIndexRow[] = [];
  for (const network of DISTRIBUTORS) {
    const ranked = rankPlans(network, u, {});
    const top = topOpen(ranked);
    if (!top) continue;
    out.push({
      date,
      network,
      cheapest: Math.round(top.total),
      retailer: top.plan[0],
      plan: top.plan[2],
      vdo: Math.round(vdoBillForUsage(network, u)),
      plans: ranked.length,
    });
  }
  return out;
}

export interface GasIndexRow {
  date: string;
  zone: string;
  /** $ a year for the cheapest gas plan a gas-heated home (45 GJ) can get. */
  cheapest: number;
  retailer: string;
  plan: string;
  /** $ a year on the middle plan of the market, same use. */
  typical: number;
  plans: number;
}

export const GAS_INDEX_MJ = 45_000;

export function gasIndexRows(date: string): GasIndexRow[] {
  const out: GasIndexRow[] = [];
  for (const zone of GAS_ZONES) {
    const ranked = rankGasPlans(zone, { days: 365, mj: GAS_INDEX_MJ });
    const top = topOpenGas(ranked);
    if (!top) continue;
    out.push({ date, zone, cheapest: Math.round(top.total), retailer: top.plan[0], plan: top.plan[2], typical: Math.round(ranked[Math.floor(ranked.length / 2)].total), plans: ranked.length });
  }
  return out;
}

/** Add today's rows, replacing any already there for the same date. */
export function mergeIndex<T extends { date: string }>(existing: T[], rows: T[]): T[] {
  const dates = new Set(rows.map((r) => r.date));
  const where = (r: T) => String((r as { network?: string; zone?: string }).network ?? (r as { zone?: string }).zone ?? "");
  return [...existing.filter((r) => !dates.has(r.date)), ...rows].sort((a, b) => a.date.localeCompare(b.date) || where(a).localeCompare(where(b)));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "price-index.json");
  let existing: PriceIndexRow[] = [];
  let existingGas: GasIndexRow[] = [];
  try {
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    existing = d.rows ?? [];
    existingGas = d.gasRows ?? [];
  } catch { /* first run */ }
  const rows = indexRows(PLAN_DATA_DATE);
  const gasRows = gasIndexRows(GAS_PLAN_DATA_DATE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    about: "Cheapest plan for an average home (4,000 kWh a year, single rate) on each network, and the default offer for the same usage, $ a year incl. GST.",
    rows: mergeIndex(existing, rows),
    gasAbout: "Cheapest gas plan for a gas-heated home (45 GJ a year) on each gas network, and the middle plan of the market for the same use, $ a year incl. GST. Victoria has no default offer for gas.",
    gasRows: mergeIndex(existingGas, gasRows),
  }, null, 1) + "\n");
  for (const r of rows) console.log(`${r.network}: cheapest $${r.cheapest} (${r.retailer}), default offer $${r.vdo}`);
  for (const r of gasRows) console.log(`${r.zone} gas: cheapest $${r.cheapest} (${r.retailer}), typical $${r.typical}`);
}

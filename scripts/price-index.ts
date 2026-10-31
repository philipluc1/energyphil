// Daily Victorian price index (started 31 Oct 2026). For each network, the
// cheapest plan an average home (4,000 kWh a year, single rate, no solar) can
// get, and the Victorian Default Offer for the same usage. Appended to
// data/price-index.json by the daily pull, one entry per network per day, so
// we can later chart where prices are heading.
//
// Run: npx tsx scripts/price-index.ts   (after scripts/pull-plans.mjs)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISTRIBUTORS, PLAN_DATA_DATE, rankPlans, topOpen } from "../lib/plans";
import { averageUsage, vdoBillForUsage } from "../lib/profileUsage";

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

/** Add today's rows, replacing any already there for the same date. */
export function mergeIndex(existing: PriceIndexRow[], rows: PriceIndexRow[]): PriceIndexRow[] {
  const dates = new Set(rows.map((r) => r.date));
  return [...existing.filter((r) => !dates.has(r.date)), ...rows].sort((a, b) => a.date.localeCompare(b.date) || a.network.localeCompare(b.network));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "price-index.json");
  let existing: PriceIndexRow[] = [];
  try { existing = JSON.parse(fs.readFileSync(file, "utf8")).rows ?? []; } catch { /* first run */ }
  const rows = indexRows(PLAN_DATA_DATE);
  const merged = mergeIndex(existing, rows);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ about: "Cheapest plan for an average home (4,000 kWh a year, single rate) on each network, and the default offer for the same usage, $ a year incl. GST.", rows: merged }, null, 1) + "\n");
  for (const r of rows) console.log(`${r.network}: cheapest $${r.cheapest} (${r.retailer}), default offer $${r.vdo}`);
}

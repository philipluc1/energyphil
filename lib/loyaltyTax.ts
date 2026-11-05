// 5 Nov 2026: the monthly "loyalty tax" report (app/loyalty-tax). What staying put costs an
// average Victorian home, from the same daily plan data as everything else. No retailer is
// named: it's about the gap, not who's cheapest. Worked out fresh from today's plans.

import { DISTRIBUTORS, PLAN_DATA_DATE, rankPlans, topOpen } from "./plans";
import { averageUsage, vdoBillForUsage } from "./profileUsage";
import { GAS_PLAN_DATA_DATE, GAS_ZONES, rankGasPlans } from "./gasPlans";
import { topOpen as topOpenGas } from "./planExtras";
import { marketActivity } from "./marketActivity";

export const AVERAGE_KWH = 4000;
export const GAS_GJ = 45;

export interface NetworkGap { network: string; cheapest: number; typical: number; vdo: number; vdoGap: number; typicalGap: number; plans: number }
export interface GasGap { zone: string; cheapest: number; typical: number; gap: number; plans: number }

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((t, x) => t + x, 0) / xs.length) : 0);

export function loyaltyTax() {
  const u = averageUsage(365);
  const networks: NetworkGap[] = [];
  for (const network of DISTRIBUTORS) {
    const ranked = rankPlans(network, u, {});
    const top = topOpen(ranked);
    if (!top) continue;
    const market = ranked.filter((m) => m.plan[3] !== "STANDING").map((m) => m.total);
    const cheapest = Math.round(top.total);
    const typical = Math.round(median(market.length ? market : ranked.map((m) => m.total)));
    const vdo = Math.round(vdoBillForUsage(network, u));
    networks.push({ network, cheapest, typical, vdo, vdoGap: vdo - cheapest, typicalGap: typical - cheapest, plans: ranked.length });
  }
  const gas: GasGap[] = [];
  for (const zone of GAS_ZONES) {
    const ranked = rankGasPlans(zone, { days: 365, mj: GAS_GJ * 1000 });
    const top = topOpenGas(ranked);
    if (!top || !ranked.length) continue;
    const typical = Math.round(ranked[Math.floor(ranked.length / 2)].total);
    gas.push({ zone, cheapest: Math.round(top.total), typical, gap: typical - Math.round(top.total), plans: ranked.length });
  }
  const month = marketActivity({ days: 30 });
  const asOf = PLAN_DATA_DATE || GAS_PLAN_DATA_DATE || null;
  return {
    asOf,
    monthLabel: asOf ? new Date(`${asOf}T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }) : null,
    networks,
    gas,
    avgVdoGap: avg(networks.map((n) => n.vdoGap)),
    avgTypicalGap: avg(networks.map((n) => n.typicalGap)),
    biggest: networks.reduce<NetworkGap | null>((b, n) => (!b || n.vdoGap > b.vdoGap ? n : b), null),
    avgGasGap: avg(gas.map((g) => g.gap)),
    month,
    plansCompared: networks.reduce((t, n) => t + n.plans, 0),
  };
}

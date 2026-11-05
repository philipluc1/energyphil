// NSW residential electricity plans (5 Nov 2026), written each morning by
// scripts/pull-plans.mjs from the retailers' Consumer Data Right feeds.
// Kept apart from lib/plans.ts so the Victorian pages don't load NSW's plans.
// Not shown on the site yet: NSW_LIVE in lib/nsw.ts is off.
//
// Each row:
//  0 retailer, 1 network (Ausgrid | Endeavour Energy | Essential Energy), 2 plan name,
//  3 MARKET | STANDING, 4 daily supply $, 5 anytime $/kWh, 6 peak, 7 shoulder, 8 off-peak,
//  9 controlled load 1 $/kWh, 10 solar feed-in $/kWh (no GST), 11 demand $/kW/day,
//  12 controlled load 2 $/kWh, 13 CL1 daily charge $, 14 CL2 daily charge $,
//  15 1 when the plan has a free window (Solar Sharer, free 11am-2pm), else 0.
// Prices include GST (except feed-in). Seasonal rates are averaged over the year by days.

export type NswNetwork = "Ausgrid" | "Endeavour Energy" | "Essential Energy";
export type NswPlanRow = [string, NswNetwork, string, string, number, number | null, number | null, number | null, number | null, number | null, number | null, number | null, number | null, number | null, number | null, 0 | 1];

export const NSW_PLAN_DATA_DATE = "";

export const NSW_PLANS: NswPlanRow[] = [];

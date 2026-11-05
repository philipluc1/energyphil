// NSW settings (5 Nov 2026). Nothing NSW shows on the site while NSW_LIVE is false;
// the daily pull already fills lib/plansNsw.ts so the data is ready when it's switched on.

import type { NswNetwork } from "./plansNsw";

export const NSW_LIVE = false;

export const NSW_NETWORKS: NswNetwork[] = ["Ausgrid", "Endeavour Energy", "Essential Energy"];

/**
 * The AER's Default Market Offer, 1 July 2026 to 30 June 2027 (DMO 8), residential,
 * yearly price including GST at the AER's yearly usage for that network
 * (AER, Default Market Offer 2026-27 information kit). Update each late May.
 */
export const DMO_YEAR = "2026-27";
export const DMO: Record<NswNetwork, { kwh: number; flat: number; tou: number }> = {
  Ausgrid: { kwh: 3900, flat: 1899, tou: 1893 },
  "Endeavour Energy": { kwh: 4900, flat: 2328, tou: 2320 },
  "Essential Energy": { kwh: 4600, flat: 2604, tou: 2530 },
};

/**
 * Peak / shoulder / off-peak shares of a year's usage, for pricing a time-of-use plan
 * the way the default offer is priced. From the AER's half-hourly "assumed pattern of
 * supply" for each network, bucketed into that network's time-of-use hours
 * (scripts/dmo-splits.mjs). null until that file is in: the site then shows "–"
 * for time-of-use plans rather than guessing.
 */
export const DMO_TOU_SPLIT: Record<NswNetwork, { peak: number; shoulder: number; offpeak: number; free?: number } | null> = {
  Ausgrid: null,
  "Endeavour Energy": null,
  "Essential Energy": null,
};

/** A plan's yearly cost for the default offer's standard home on that network, or null. */
export function nswStandardYear(
  plan: { supply: number; anytime: number | null; peak: number | null; shoulder: number | null; offpeak: number | null },
  network: NswNetwork,
): number | null {
  const d = DMO[network];
  if (plan.anytime !== null && plan.peak === null) return plan.supply * 365 + plan.anytime * d.kwh;
  const s = DMO_TOU_SPLIT[network];
  if (!s || plan.peak === null) return null;
  const shoulder = plan.shoulder ?? plan.offpeak;
  const offpeak = plan.offpeak ?? plan.shoulder;
  if (shoulder === null || offpeak === null) return null;
  return plan.supply * 365 + d.kwh * (s.peak * plan.peak + s.shoulder * shoulder + s.offpeak * offpeak);
}

/** "% vs default offer" for NSW: below zero is cheaper. */
export function nswVsDmo(plan: Parameters<typeof nswStandardYear>[0], network: NswNetwork): number | null {
  const y = nswStandardYear(plan, network);
  if (y === null) return null;
  const ref = plan.anytime !== null && plan.peak === null ? DMO[network].flat : DMO[network].tou;
  return y / ref - 1;
}

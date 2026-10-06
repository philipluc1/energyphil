import { DISTRIBUTORS, EV_FRIENDLY_OFFPEAK_THRESHOLD, PLANS, VDO, type Distributor } from "./plans";

// Typical figures, not exact: real cars vary with model, speed and weather.
export interface CarType {
  id: string;
  label: string;
  example: string;
  kwhPer100: number; // electricity used per 100 km, at the wall
  batteryKwh: number; // typical usable battery
  petrolL100: number; // a comparable petrol car
}
export const CAR_TYPES: CarType[] = [
  { id: "hatch", label: "Small hatch", example: "e.g. a compact city car", kwhPer100: 15, batteryKwh: 40, petrolL100: 7 },
  { id: "sedan", label: "Sedan", example: "e.g. a mid-size family car", kwhPer100: 16, batteryKwh: 60, petrolL100: 8 },
  { id: "suv", label: "SUV", example: "e.g. a medium or large SUV", kwhPer100: 19, batteryKwh: 75, petrolL100: 10 },
  { id: "ute", label: "Ute / large", example: "e.g. an electric ute or van", kwhPer100: 24, batteryKwh: 90, petrolL100: 11 },
];

export interface NetworkRates {
  network: Distributor;
  /** $/kWh the default offer charges for any electricity, including charging. */
  vdoRate: number;
  /** Cheapest published off-peak $/kWh among market offers on this network. */
  bestRate: number;
  bestRetailer: string;
  bestPlan: string;
  /** Plans with a free or near-free window (under 6c/kWh): real, but usually only in set hours. */
  promo: { retailer: string; plan: string; rate: number } | null;
}

export function evNetworkRates(): NetworkRates[] {
  const out: NetworkRates[] = [];
  for (const d of DISTRIBUTORS) {
    let best: (typeof PLANS)[number] | null = null;
    let promo: (typeof PLANS)[number] | null = null;
    for (const p of PLANS) {
      if (p[1] !== d || p[3] !== "MARKET" || p[8] === null) continue;
      if (p[8] <= EV_FRIENDLY_OFFPEAK_THRESHOLD) {
        if (promo === null || p[8] < (promo[8] as number)) promo = p;
      } else if (best === null || p[8] < (best[8] as number)) best = p;
    }
    if (!best) continue;
    out.push({
      network: d,
      vdoRate: VDO[d].usage,
      bestRate: best[8] as number,
      bestRetailer: best[0],
      bestPlan: best[2],
      promo: promo ? { retailer: promo[0], plan: promo[2], rate: promo[8] as number } : null,
    });
  }
  return out;
}

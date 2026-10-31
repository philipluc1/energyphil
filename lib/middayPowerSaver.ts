// The Victorian Midday Power Saver (from 1 Oct 2026): power is free from
// 11am to 2pm every day, up to 24 kWh a day, with higher prices at other
// times. Opt-in through your retailer; needs a smart meter.
//
// Prices are the Essential Services Commission's RECOMMENDED MAXIMUM tariffs
// for 1 Oct 2026 to 30 Jun 2027 (domestic, no controlled load, GST included),
// from the Victorian Government's technical paper. The Governor in Council
// order sets the legal maximums, and retailers may charge less. The page says
// so. Update the table when the order or new prices are published.
//
// Source: energy.vic.gov.au, Victorian Midday Power Saver technical paper, Table 1.

import type { Distributor } from "./plans";

export const MIDDAY_SOURCE_URL = "https://www.energy.vic.gov.au/households/save-energy-and-money/victorian-midday-power-saver";
export const MIDDAY_START = "2026-10-01";
/** kWh a day that's free in the window; anything over is charged at the solar soak rate. */
export const MIDDAY_FREE_CAP_KWH = 24;

export interface MiddayRates {
  /** $ a day */
  supply: number;
  /** $ per kWh, 9pm to 11am */
  offpeak: number;
  /** $ per kWh, 2pm to 4pm */
  soak: number;
  /** $ per kWh, 4pm to 9pm */
  peak: number;
}

export const MIDDAY_RATES: Record<Distributor, MiddayRates> = {
  "AusNet Services": { supply: 1.2824, offpeak: 0.2478, soak: 0.1976, peak: 0.4982 },
  Citipower: { supply: 1.2114, offpeak: 0.2322, soak: 0.1864, peak: 0.4036 },
  Jemena: { supply: 1.2712, offpeak: 0.2394, soak: 0.1983, peak: 0.3975 },
  Powercor: { supply: 1.3805, offpeak: 0.2462, soak: 0.1939, peak: 0.4381 },
  "United Energy": { supply: 1.1912, offpeak: 0.2427, soak: 0.1939, peak: 0.4245 },
};

export type MiddayWindow = "free" | "soak" | "peak" | "offpeak";

/** Which price applies in each hour of the day (0 = midnight to 1am). */
export function windowAt(hour: number): MiddayWindow {
  if (hour >= 11 && hour < 14) return "free";
  if (hour >= 14 && hour < 16) return "soak";
  if (hour >= 16 && hour < 21) return "peak";
  return "offpeak";
}

export const WINDOW_LABEL: Record<MiddayWindow, string> = {
  free: "Free, 11am–2pm",
  soak: "Solar soak, 2pm–4pm",
  peak: "Peak, 4pm–9pm",
  offpeak: "Off-peak, 9pm–11am",
};

export interface MiddayDay {
  /** $ a day, supply included. */
  perDay: number;
  /** kWh a day in each window (before the cap). */
  kwh: Record<MiddayWindow, number>;
  /** $ a day in each window (free is what's over the cap, at the soak rate). */
  cost: Record<MiddayWindow, number>;
  /** kWh a day over the 24 kWh free cap. */
  overCap: number;
}

/** One day on the Midday Power Saver, from 24 hourly kWh figures. */
export function priceMiddayDay(network: Distributor, hourly: number[]): MiddayDay {
  const r = MIDDAY_RATES[network];
  const kwh: Record<MiddayWindow, number> = { free: 0, soak: 0, peak: 0, offpeak: 0 };
  hourly.forEach((v, h) => { kwh[windowAt(h)] += Math.max(0, v); });
  const overCap = Math.max(0, kwh.free - MIDDAY_FREE_CAP_KWH);
  const cost = {
    free: overCap * r.soak,
    soak: kwh.soak * r.soak,
    peak: kwh.peak * r.peak,
    offpeak: kwh.offpeak * r.offpeak,
  };
  return { perDay: r.supply + cost.free + cost.soak + cost.peak + cost.offpeak, kwh, cost, overCap };
}

/**
 * Move `kwh` a day into 11am–2pm, spread evenly over the three hours.
 * "evening" takes it from 4pm–9pm first (then the rest of the day), the way
 * laundry, the dishwasher or pre-cooling would move; "overnight" takes it from
 * 10pm–6am, the way EV charging would.
 */
export function shiftToMidday(hourly: number[], kwh: number, from: "evening" | "overnight"): number[] {
  const out = [...hourly];
  const order = from === "evening"
    ? [16, 17, 18, 19, 20, 7, 8, 9, 10, 14, 15, 21, 22]
    : [22, 23, 0, 1, 2, 3, 4, 5];
  let left = Math.max(0, kwh);
  // Take proportionally within the source hours, never below zero.
  const pool = order.reduce((a, h) => a + out[h], 0);
  if (pool <= 0 || left <= 0) return out;
  const take = Math.min(left, pool);
  for (const h of order) out[h] -= (out[h] / pool) * take;
  left = take;
  for (const h of [11, 12, 13]) out[h] += left / 3;
  return out;
}

/**
 * The Midday Power Saver for a home, a year: as they are now, and with the
 * two easiest chores (washing and the dishwasher, about 3.2 kWh a day) moved
 * to midday, against the cheapest plan for the same usage. Solar credit and
 * hot-water meter are left out on both sides. Used by the monthly email; the
 * dashboard page works it out the same way with more chores to tick.
 */
export function middayEstimate(o: {
  network: Distributor;
  /** General (non-controlled-load) kWh a day. */
  dailyKwh: number;
  hourly: number[];
  bestYear: number;
}): { asIsYear: number; choresYear: number; bestYear: number } {
  const asIs = priceMiddayDay(o.network, o.hourly).perDay * 365;
  const moved = shiftToMidday(shiftToMidday(o.hourly, 2, "evening"), 1.2, "evening");
  return { asIsYear: asIs, choresYear: priceMiddayDay(o.network, moved).perDay * 365, bestYear: o.bestYear };
}

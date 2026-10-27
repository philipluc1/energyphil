// When a home uses power across a day: three typical shapes, scaled to a
// home's own daily kWh, plus solar export and overnight EV charging where the
// home has them. A model from the household answers, not meter data, and the
// page says so. Used by the Learn page (pick a shape) and the dashboard (the
// member's own shape).

import type { HomeProfile } from "./profileUsage";

export type UsageShapeKey = "daytime" | "evening" | "allday";

export const USAGE_SHAPES: { key: UsageShapeKey; title: string; who: string; blurb: string }[] = [
  { key: "daytime", title: "Daytime home", who: "Working from home, retired, young kids at home", blurb: "Most power goes through the middle of the day, when solar (if you have it) is doing the work and most time-of-use plans are cheapest." },
  { key: "evening", title: "Out by day, in by night", who: "Working household, nobody home till after 5", blurb: "A sharp evening peak from about 5 to 9pm: cooking, heating or cooling, screens. That window is the dearest on a time-of-use plan." },
  { key: "allday", title: "Steady all day", who: "Pool pump, air-con, EV, or just a busy house", blurb: "A high, fairly flat load around the clock. Supply charge matters less, the usage rate matters most." },
];

/** A smooth bump centred on `at` (hours), `width` hours wide, height 1. */
const bump = (h: number, at: number, width: number) => {
  let d = Math.abs(h - at);
  if (d > 12) d = 24 - d;
  return Math.exp(-(d * d) / (2 * (width / 2.355) ** 2));
};

/** Relative load for each hour (0..23), before scaling. */
function baseShape(key: UsageShapeKey): number[] {
  const out: number[] = [];
  for (let h = 0; h < 24; h++) {
    let v = 0.3; // fridge, standby, the things that never turn off
    if (key === "daytime") v += 0.55 * bump(h, 8, 3) + 0.9 * bump(h, 12.5, 7) + 0.6 * bump(h, 18.5, 3.5);
    if (key === "evening") v += 0.35 * bump(h, 7.2, 2) + 0.12 * bump(h, 13, 6) + 1.7 * bump(h, 18.5, 3.6);
    if (key === "allday") v += 0.45 + 0.25 * bump(h, 8, 3) + 0.25 * bump(h, 14, 6) + 0.55 * bump(h, 18.5, 4);
    out.push(v);
  }
  return out;
}

export interface UsageCurve {
  /** Grid import, kW, one value per hour. */
  grid: number[];
  /** Solar sent to the grid, kW, one value per hour (all zeros without solar). */
  feedIn: number[];
  gridKwhPerDay: number;
  feedInKwhPerDay: number;
}

/**
 * The curve for a shape, scaled so the grid import adds up to `dailyKwh`.
 * `exportKwhPerDay` draws a midday feed-in curve; `evOvernight` adds a block
 * of charging from 11pm to 5am on top (counted in dailyKwh).
 */
export function usageCurve(key: UsageShapeKey, dailyKwh: number, opts: { exportKwhPerDay?: number; evOvernight?: boolean; evKwhPerDay?: number } = {}): UsageCurve {
  const shape = baseShape(key);
  const evKwh = opts.evOvernight ? Math.min(dailyKwh * 0.6, opts.evKwhPerDay ?? 7) : 0;
  const restKwh = Math.max(0, dailyKwh - evKwh);
  const sum = shape.reduce((a, b) => a + b, 0);
  const grid = shape.map((v) => (sum > 0 ? (v / sum) * restKwh : 0));
  if (evKwh > 0) {
    // 11pm to 5am, six hours, a flat block.
    for (const h of [23, 0, 1, 2, 3, 4]) grid[h] += evKwh / 6;
  }
  const exportKwh = Math.max(0, opts.exportKwhPerDay ?? 0);
  const sun = Array.from({ length: 24 }, (_, h) => (h >= 7 && h <= 18 ? bump(h, 12.5, 6) : 0));
  const sunSum = sun.reduce((a, b) => a + b, 0);
  const feedIn = sun.map((v) => (exportKwh > 0 && sunSum > 0 ? (v / sunSum) * exportKwh : 0));
  const r = (n: number) => Math.round(n * 100) / 100;
  return { grid: grid.map(r), feedIn: feedIn.map(r), gridKwhPerDay: r(dailyKwh), feedInKwhPerDay: r(exportKwh) };
}

/** Which shape a home's answers point to. */
export function shapeForProfile(p: Pick<HomeProfile, "daytimeHome" | "pool" | "ev"> | null | undefined): UsageShapeKey {
  if (!p) return "evening";
  if (p.pool) return "allday";
  if (p.daytimeHome === "home") return "daytime";
  if (p.daytimeHome === "away") return "evening";
  return "allday";
}

/** Typical Victorian time-of-use windows, for shading the chart. */
export const TOU_WINDOWS = { peak: [15, 21] as [number, number], offpeakNight: [22, 7] as [number, number] };

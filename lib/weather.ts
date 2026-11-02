// Today's weather for the usage chart (2 Nov 2026), from Open-Meteo (free, no
// key, called from the browser). Cloud cover each hour scales the modelled
// solar: a grey day sends less to the grid and draws a little more from it.

export interface TodayWeather {
  place: string;
  /** "Sunny", "Partly cloudy", "Cloudy", "Rain", "Storms", "Fog". */
  label: string;
  tempC: number | null;
  /** Cloud cover each hour, 0–100, midnight first (24 values). */
  cloud: number[];
}

/** How much of a clear day's solar gets through, per hour (Kasten–Czeplak). */
export function solarFactor(cloudPct: number): number {
  const c = Math.min(1, Math.max(0, cloudPct / 100));
  return Math.max(0.15, 1 - 0.75 * Math.pow(c, 3.4));
}

/** WMO weather code → a plain word. */
export function weatherLabel(code: number | null | undefined, cloudPct?: number | null): string {
  if (code === null || code === undefined) return cloudPct !== null && cloudPct !== undefined ? (cloudPct > 70 ? "Cloudy" : cloudPct > 30 ? "Partly cloudy" : "Sunny") : "—";
  if (code === 0) return "Sunny";
  if (code === 1 || code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 95) return "Storms";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Snow";
  return "Cloudy";
}

/**
 * The day's curve under today's clouds. Solar sent out falls with the cloud;
 * the home also uses less of its own solar, so it draws a little more from the
 * grid (we assume it uses about 3 kWh of its own solar for every 7 it sends out).
 */
export function applyClouds(curve: { grid: number[]; feedIn: number[] }, cloud: number[]): { grid: number[]; feedIn: number[]; share: number } {
  const SELF_PER_EXPORT = 3 / 7;
  const r = (n: number) => Math.round(n * 100) / 100;
  const feedIn = curve.feedIn.map((v, h) => r(v * solarFactor(cloud[h] ?? 0)));
  const grid = curve.grid.map((v, h) => r(v + (curve.feedIn[h] - feedIn[h]) * SELF_PER_EXPORT));
  const before = curve.feedIn.reduce((a, b) => a + b, 0);
  const after = feedIn.reduce((a, b) => a + b, 0);
  return { grid, feedIn, share: before > 0 ? after / before : 1 };
}

/** Hours since midnight in Melbourne, as a fraction (13.5 = 1:30pm). */
export function melbourneHour(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

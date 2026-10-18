import { VDO, type Distributor, type UsageInput } from "./plans";

// A household "profile" → an estimated usage pattern for one billing period.
//
// This is a rule-of-thumb model, NOT metered data: every constant below is a
// round-number assumption (rough Australian household averages), kept in one
// place so they're easy to tune. The UI always labels the result an estimate
// and lets the customer overwrite it with real bill figures. The point is to
// price plans against THIS household's shape (who's home when, what's
// electric, solar, EV) instead of one general-average household.

export type Heating = "gas_none" | "reverse_cycle" | "resistive";
export type HotWater = "gas_solar" | "electric_controlled" | "electric_general" | "heat_pump";
export type DaytimeHome = "away" | "some" | "home";
export type EvCharging = "overnight" | "anytime";
/** Roughly when the solar panels went in: older panels are smaller. */
export type SolarAge = "pre2016" | "2016to2020" | "2021on" | "unsure";

export interface HomeProfile {
  people: number; // 1..6 (6 = 6+)
  heating: Heating;
  cooling: boolean; // air-conditioning used for cooling
  hotWater: HotWater;
  pool: boolean;
  ev: boolean;
  evCharging: EvCharging;
  daytimeHome: DaytimeHome;
  hasSolar: boolean;
  solarKw: number; // system size used by the estimate, only when hasSolar
  // Most people don't know their system size but can count panels. solarKw is
  // worked out from the count and age unless they typed the kW themselves.
  solarInput: "panels" | "kw";
  solarPanels: number;
  solarAge: SolarAge;
}

export const DEFAULT_PROFILE: HomeProfile = {
  people: 3,
  heating: "gas_none",
  cooling: true,
  hotWater: "gas_solar",
  pool: false,
  ev: false,
  evCharging: "overnight",
  daytimeHome: "some",
  hasSolar: false,
  solarKw: 6.7,
  solarInput: "panels",
  solarPanels: 18,
  solarAge: "unsure",
};

/** Typical panel size (kW) by install period in Australia. */
export const PANEL_KW: Record<SolarAge, number> = { pre2016: 0.25, "2016to2020": 0.33, "2021on": 0.41, unsure: 0.37 };

/** Panels x typical panel size, to one decimal place. */
export function panelsToKw(panels: number, age: SolarAge): number {
  return Math.round(Math.max(0, panels) * PANEL_KW[age] * 10) / 10;
}

/** A saved profile from any version of the check, filled out to today's shape. */
export function normaliseProfile(saved: Partial<HomeProfile> & Record<string, unknown>): HomeProfile {
  const p = { ...DEFAULT_PROFILE, ...saved } as HomeProfile & { dwelling?: unknown };
  delete p.dwelling; // no longer asked: step 1 already says it's a home
  // Saves from before the panel count had only a kW figure: keep it as typed.
  if (saved.solarInput !== "panels" && saved.solarInput !== "kw") p.solarInput = typeof saved.solarKw === "number" ? "kw" : "panels";
  if (p.solarInput === "panels") p.solarKw = panelsToKw(p.solarPanels, p.solarAge);
  return p;
}

// Annual kWh for lighting, fridge, cooking, laundry, electronics, etc.
const BASE_BY_PEOPLE: Record<number, number> = { 1: 2600, 2: 3500, 3: 4300, 4: 5000, 5: 5600, 6: 6200 };
const HEATING_KWH: Record<Heating, number> = { gas_none: 0, reverse_cycle: 900, resistive: 1800 };
const COOLING_KWH = 350;
const HOT_WATER_KWH: Record<HotWater, number> = {
  gas_solar: 0,
  electric_controlled: 1700,
  electric_general: 1700,
  heat_pump: 600,
};
const POOL_KWH = 1200;
const EV_KWH = 2400; // ~12,000 km/yr
const SOLAR_KWH_PER_KW_YEAR = 1300; // typical Victorian yield

// Share of general (non-controlled-load) usage falling in each tariff band.
// Real Victorian TOU windows differ a little by retailer; these are typical.
const BAND_SPLIT: Record<DaytimeHome, { peak: number; shoulder: number; offpeak: number }> = {
  away: { peak: 0.42, shoulder: 0.34, offpeak: 0.24 },
  some: { peak: 0.38, shoulder: 0.4, offpeak: 0.22 },
  home: { peak: 0.34, shoulder: 0.48, offpeak: 0.18 },
};
// Share of solar output exported (rest is used in the house) — less when someone's home by day.
const EXPORT_SHARE: Record<DaytimeHome, number> = { away: 0.7, some: 0.55, home: 0.4 };

export interface EstimatedUsage {
  peak: number;
  shoulder: number;
  offpeak: number;
  cl: number;
  solarExportKwh: number;
  totalKwh: number; // grid usage incl. controlled load
  annualKwh: number; // same, scaled to a year
}

export function estimateUsage(p: HomeProfile, days: number): EstimatedUsage {
  const scale = days / 365;
  const base = BASE_BY_PEOPLE[Math.min(6, Math.max(1, Math.round(p.people)))] ?? 4300;
  const heatCool = HEATING_KWH[p.heating] + (p.cooling ? COOLING_KWH : 0);
  const wfh = p.daytimeHome === "home" ? 300 : 0;
  const hotWater = HOT_WATER_KWH[p.hotWater];
  const onCl = p.hotWater === "electric_controlled";

  let general = (base + heatCool + wfh + (onCl ? 0 : hotWater) + (p.pool ? POOL_KWH : 0)) * scale;
  const cl = onCl ? hotWater * scale : 0;
  const ev = p.ev ? EV_KWH * scale : 0;

  const split = BAND_SPLIT[p.daytimeHome];
  let peak = general * split.peak;
  let shoulder = general * split.shoulder;
  let offpeak = general * split.offpeak;
  if (p.ev) {
    if (p.evCharging === "overnight") offpeak += ev;
    else {
      peak += ev * split.peak;
      shoulder += ev * split.shoulder;
      offpeak += ev * split.offpeak;
    }
  }

  let solarExportKwh = 0;
  if (p.hasSolar && p.solarKw > 0) {
    const generated = p.solarKw * SOLAR_KWH_PER_KW_YEAR * scale;
    solarExportKwh = generated * EXPORT_SHARE[p.daytimeHome];
    const selfUsed = generated - solarExportKwh;
    // Self-consumed solar displaces daytime (shoulder) grid usage first, then peak.
    const fromShoulder = Math.min(shoulder, selfUsed);
    shoulder -= fromShoulder;
    peak = Math.max(0, peak - (selfUsed - fromShoulder));
  }

  general = peak + shoulder + offpeak;
  const totalKwh = general + cl;
  const r = (n: number) => Math.round(n);
  return {
    peak: r(peak),
    shoulder: r(shoulder),
    offpeak: r(offpeak),
    cl: r(cl),
    solarExportKwh: r(solarExportKwh),
    totalKwh: r(totalKwh),
    annualKwh: days > 0 ? r(totalKwh / scale) : 0,
  };
}

/** What the Victorian Default Offer would cost for THIS usage (supply +
 * single-rate usage at the VDO benchmark rate + controlled load), rather
 * than the generic typical-household annual figure. No solar credit is
 * modelled here, so for solar homes it's a conservative baseline. */
export function vdoBillForUsage(distributor: Distributor, u: UsageInput): number {
  const v = VDO[distributor];
  const kwh = u.peak + u.shoulder + u.offpeak + u.anytime;
  return v.supply * u.days + v.usage * kwh + v.cl * u.cl;
}

// The average Victorian home: 4,000 kWh a year, the figure the Essential
// Services Commission uses for the Victorian Default Offer. Shown next to the
// estimate, and used whenever we don't have enough usage to go on.
export const AVERAGE_ANNUAL_KWH = 4000;
export const TYPICAL_ANNUAL_KWH = AVERAGE_ANNUAL_KWH;

/** Usage this thin is treated as "not enough to go on": a bill covering
 *  under a week, or under 1 kWh a day from the grid (a new account, a
 *  partial or estimated read, an empty house). Homes with solar exports are
 *  only held to the days rule: low grid use is normal for them. */
export const MIN_USAGE_DAYS = 7;
export const MIN_KWH_PER_DAY = 1;

/** The average home's usage for a billing period, split into time bands the
 *  same way as an estimate for a household that's home some of the day, so
 *  time-of-use plans can be compared too. No controlled load, no solar. */
export function averageUsage(days: number): UsageInput {
  const d = days > 0 ? days : 91;
  const general = (AVERAGE_ANNUAL_KWH * d) / 365;
  const s = BAND_SPLIT.some;
  const peak = Math.round(general * s.peak);
  const shoulder = Math.round(general * s.shoulder);
  return { days: d, peak, shoulder, offpeak: Math.round(general) - peak - shoulder, anytime: 0, cl: 0, solarExportKwh: 0 };
}

/** True when there isn't enough usage to compare on. */
export function usageIsIncomplete(u: UsageInput): boolean {
  const kwh = u.peak + u.shoulder + u.offpeak + u.anytime + u.cl;
  if (!(u.days >= MIN_USAGE_DAYS) || !(kwh > 0)) return true;
  return (u.solarExportKwh ?? 0) > 0 ? false : kwh / u.days < MIN_KWH_PER_DAY;
}

/** The usage to compare on: theirs, or the average home's when theirs isn't enough. */
export function usageOrAverage(u: UsageInput): { usage: UsageInput; average: boolean } {
  return usageIsIncomplete(u) ? { usage: averageUsage(u.days), average: true } : { usage: u, average: false };
}

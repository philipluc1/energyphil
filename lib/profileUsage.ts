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

// Calibration (Oct 2026). Whole-home averages for Melbourne (climate zone 6):
//  - AER residential consumption benchmarks (Dec 2020), kWh a year:
//    1 person 2,953 · 2 people 4,840 · 3 people 5,077 · 4 people 5,805 · 5+ 7,351
//    (seasons summed; winter is about 31% of the year).
//  - ESC Victorian energy usage profiles: 1 person 7.2 kWh a day, 2–3 people
//    11.8, 4+ 15.5; homes with mains gas 4,432 a year, without 6,871;
//    controlled load homes 6,537, without 4,618.
// Those averages mix gas and all-electric homes. "Everyday" below is a home
// with gas (or no) heating and gas hot water; the extras are added on top.
// With typical shares of electric hot water, heating and cooling, a home of
// each size lands near the AER figure (e.g. 3 people: about 5,050).

// Annual kWh for lighting, fridge, cooking, laundry, electronics, etc.
const BASE_BY_PEOPLE: Record<number, number> = { 1: 1900, 2: 3000, 3: 3500, 4: 4100, 5: 4600, 6: 5100 };
// Share of general use that happens in daylight, when solar can cover it.
// Without a battery, evening and overnight use still come from the grid.
const DAYLIGHT_SHARE: Record<DaytimeHome, number> = { away: 0.25, some: 0.33, home: 0.42 };
const HEATING_KWH: Record<Heating, number> = { gas_none: 0, reverse_cycle: 900, resistive: 1800 };
const COOLING_KWH = 350;
const WORK_FROM_HOME_KWH = 300;
// Electric hot water grows with the people using it: tank losses (~350 kWh a
// year) plus ~550 kWh a person. A heat pump uses about a third of that.
const HOT_WATER_BASE = 350;
const HOT_WATER_PER_PERSON = 550;
const HEAT_PUMP_SHARE = 0.35;
const POOL_KWH = 1200;
const EV_KWH = 2400; // ~12,000 km/yr
const SOLAR_KWH_PER_KW_YEAR = 1300; // typical Victorian yield

// How each part of the year's use falls across the months (Jan..Dec).
// Everyday use rises a little in winter (lights, dryer, more time inside);
// heating is May–Sep; cooling Dec–Mar; hot water works harder in winter;
// the pool pump runs more in summer; solar makes ~3x more in Jan than Jun.
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const EVERYDAY_SHAPE = [0.95, 0.95, 0.95, 0.98, 1.03, 1.1, 1.12, 1.08, 1.0, 0.96, 0.94, 0.94];
const HEATING_SHARE = [0, 0, 0, 4, 12, 22, 26, 22, 11, 3, 0, 0]; // % of the year's heating
const COOLING_SHARE = [32, 27, 12, 2, 0, 0, 0, 0, 0, 2, 8, 17]; // % of the year's cooling
const HOT_WATER_SHAPE = [0.88, 0.88, 0.92, 0.98, 1.05, 1.12, 1.15, 1.12, 1.05, 0.98, 0.95, 0.92];
const POOL_SHAPE = [1.35, 1.3, 1.15, 0.95, 0.75, 0.65, 0.65, 0.7, 0.85, 1.0, 1.2, 1.45];
const SOLAR_SHARE = [13.0, 11.0, 9.8, 7.0, 5.0, 3.9, 4.4, 5.9, 7.7, 9.9, 10.9, 11.5]; // % of the year's generation, Melbourne

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Per-month weights (summing to 1) from a shape applied to each day. */
function dayWeighted(shape: number[]): number[] {
  const raw = shape.map((f, i) => f * MONTH_DAYS[i]);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((x) => x / sum);
}
const pct = (shares: number[]) => shares.map((x) => x / 100);

/** A year's estimated use by category (kWh), before solar. */
export interface UsageBreakdown {
  everyday: number;
  hotWater: number;
  heating: number;
  cooling: number;
  pool: number;
  ev: number;
  /** Solar used in the home instead of grid power (taken off the total). */
  solarSelfUse: number;
  /** Solar sent to the grid. */
  solarExport: number;
  /** From the grid, including controlled load: everything above less solar self-use. */
  total: number;
}

export interface MonthEstimate {
  /** 0 = January. */
  month: number;
  /** From the grid, including controlled load. */
  kwh: number;
  solarExportKwh: number;
}

function peopleKey(p: HomeProfile) {
  return Math.min(6, Math.max(1, Math.round(p.people)));
}

function hotWaterKwh(p: HomeProfile): number {
  if (p.hotWater === "gas_solar") return 0;
  const electric = HOT_WATER_BASE + HOT_WATER_PER_PERSON * peopleKey(p);
  return p.hotWater === "heat_pump" ? Math.round((electric * HEAT_PUMP_SHARE) / 10) * 10 : electric;
}

/**
 * The year month by month, plus the totals by category. This is the one
 * model: estimateUsage() prices plans from the same numbers.
 */
export function monthlyEstimate(p: HomeProfile): { months: MonthEstimate[]; breakdown: UsageBreakdown } {
  const everyday = (BASE_BY_PEOPLE[peopleKey(p)] ?? 3500) + (p.daytimeHome === "home" ? WORK_FROM_HOME_KWH : 0);
  const heating = HEATING_KWH[p.heating];
  const cooling = p.cooling ? COOLING_KWH : 0;
  const hotWater = hotWaterKwh(p);
  const pool = p.pool ? POOL_KWH : 0;
  const ev = p.ev ? EV_KWH : 0;
  const generated = p.hasSolar && p.solarKw > 0 ? p.solarKw * SOLAR_KWH_PER_KW_YEAR : 0;
  const onCl = p.hotWater === "electric_controlled";
  const daytime = DAYLIGHT_SHARE[p.daytimeHome];

  const wEveryday = dayWeighted(EVERYDAY_SHAPE);
  const wHot = dayWeighted(HOT_WATER_SHAPE);
  const wPool = dayWeighted(POOL_SHAPE);
  const wHeat = pct(HEATING_SHARE);
  const wCool = pct(COOLING_SHARE);
  const wSolar = pct(SOLAR_SHARE);
  const wDays = MONTH_DAYS.map((d) => d / 365);

  let selfUseYear = 0;
  let exportYear = 0;
  const months: MonthEstimate[] = MONTH_DAYS.map((_, m) => {
    const hot = hotWater * wHot[m];
    // "General" use: everything except controlled load and the car.
    const general = everyday * wEveryday[m] + heating * wHeat[m] + cooling * wCool[m] + pool * wPool[m] + (onCl ? 0 : hot);
    const cl = onCl ? hot : 0;
    const car = ev * wDays[m];
    const gen = generated * wSolar[m];
    // Solar covers daytime use first; what the home can't use goes to the grid.
    const selfUse = Math.min(gen * (1 - EXPORT_SHARE[p.daytimeHome]), general * daytime);
    selfUseYear += selfUse;
    exportYear += gen - selfUse;
    return { month: m, kwh: Math.round(general + cl + car - selfUse), solarExportKwh: Math.round(gen - selfUse) };
  });

  const breakdown: UsageBreakdown = {
    everyday: Math.round(everyday),
    hotWater,
    heating,
    cooling,
    pool,
    ev,
    solarSelfUse: Math.round(selfUseYear),
    solarExport: Math.round(exportYear),
    total: Math.round(everyday + hotWater + heating + cooling + pool + ev - selfUseYear),
  };
  return { months, breakdown };
}

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

/** Usage for a billing period: the year's estimate (an average across the
 *  seasons) scaled to `days`, split into tariff bands. Plans are compared on
 *  the average so the answer holds all year, not just this month. */
export function estimateUsage(p: HomeProfile, days: number): EstimatedUsage {
  const scale = days / 365;
  const { breakdown: b } = monthlyEstimate(p);
  const onCl = p.hotWater === "electric_controlled";

  let general = (b.everyday + b.heating + b.cooling + b.pool + (onCl ? 0 : b.hotWater)) * scale;
  const cl = onCl ? b.hotWater * scale : 0;
  const ev = b.ev * scale;

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

  const solarExportKwh = b.solarExport * scale;
  const selfUsed = b.solarSelfUse * scale;
  if (selfUsed > 0) {
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

/** A year forecast from one bill: the home's seasonal shape (from their
 *  answers), scaled so the months the bill covers add up to its kWh. */
export interface BillForecast {
  /** Forecast grid kWh for each calendar month (Jan..Dec). */
  months: MonthEstimate[];
  annual: number;
  /** Bill ÷ what the answers alone said for the same stretch (1 = spot on). */
  factor: number;
  /** Days of the bill falling in each month (Jan..Dec). */
  covered: number[];
  /** What the answers alone said for the bill's stretch. */
  modelKwh: number;
}

/**
 * Forecast the year from a bill's kWh. The bill is taken to end on the last
 * day of `endMonth` (0 = January) and run back `days` days. A winter bill
 * isn't simply multiplied up: it's compared with the same winter months in
 * the model, so the forecast year isn't inflated (or a summer one deflated).
 */
export function forecastFromBill(p: HomeProfile, bill: { kwh: number; days: number; endMonth: number }): BillForecast | null {
  if (!(bill.kwh > 0) || !(bill.days > 0)) return null;
  const { months } = monthlyEstimate(p);
  const covered = new Array(12).fill(0) as number[];
  let left = Math.min(365, Math.round(bill.days));
  let m = ((Math.round(bill.endMonth) % 12) + 12) % 12;
  while (left > 0) {
    const take = Math.min(left, MONTH_DAYS[m]);
    covered[m] += take;
    left -= take;
    m = (m + 11) % 12;
  }
  const modelKwh = months.reduce((a, x) => a + x.kwh * (covered[x.month] / MONTH_DAYS[x.month]), 0);
  if (!(modelKwh > 0)) return null;
  // A typo (an extra zero, or a daily figure) shouldn't produce a silly year.
  const factor = Math.min(5, Math.max(0.2, bill.kwh / modelKwh));
  const scaled = months.map((x) => ({ ...x, kwh: Math.round(x.kwh * factor) }));
  return { months: scaled, annual: scaled.reduce((a, x) => a + x.kwh, 0), factor, covered, modelKwh: Math.round(modelKwh) };
}

/** An estimate for a billing period, scaled (e.g. to match a bill). Solar exports stay as they are. */
export function scaleEstimate(e: EstimatedUsage, factor: number): EstimatedUsage {
  const r = (n: number) => Math.round(n * factor);
  return { ...e, peak: r(e.peak), shoulder: r(e.shoulder), offpeak: r(e.offpeak), cl: r(e.cl), totalKwh: r(e.totalKwh), annualKwh: r(e.annualKwh) };
}

/** The estimate for a billing period, matched to a bill's kWh when there is one. */
export function estimateWithBill(p: HomeProfile, days: number, bill?: { kwh: number; endMonth: number } | null): EstimatedUsage {
  const e = estimateUsage(p, days);
  const fc = bill && bill.kwh > 0 ? forecastFromBill(p, { kwh: bill.kwh, days, endMonth: bill.endMonth }) : null;
  return fc ? scaleEstimate(e, fc.factor) : e;
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

import { VDO, type Distributor, type UsageInput } from "./plans";

// A household "profile" → an estimated usage pattern for one billing period.
//
// This is a rule-of-thumb model, NOT metered data: every constant below is a
// round-number assumption (rough Australian household averages), kept in one
// place so they're easy to tune. The UI always labels the result an estimate
// and lets the customer overwrite it with real bill figures. The point is to
// price plans against THIS household's shape (who's home when, what's
// electric, solar, EV) instead of one general-average household.

export type Dwelling = "apartment" | "townhouse" | "house";
export type Heating = "gas_none" | "reverse_cycle" | "resistive";
export type HotWater = "gas_solar" | "electric_controlled" | "electric_general" | "heat_pump";
export type DaytimeHome = "away" | "some" | "home";
export type EvCharging = "overnight" | "anytime";

export interface HomeProfile {
  people: number; // 1..6 (6 = 6+)
  dwelling: Dwelling;
  heating: Heating;
  cooling: boolean; // air-conditioning used for cooling
  hotWater: HotWater;
  pool: boolean;
  ev: boolean;
  evCharging: EvCharging;
  daytimeHome: DaytimeHome;
  hasSolar: boolean;
  solarKw: number; // system size, only when hasSolar
}

export const DEFAULT_PROFILE: HomeProfile = {
  people: 3,
  dwelling: "house",
  heating: "gas_none",
  cooling: true,
  hotWater: "gas_solar",
  pool: false,
  ev: false,
  evCharging: "overnight",
  daytimeHome: "some",
  hasSolar: false,
  solarKw: 6.6,
};

// Annual kWh for lighting, fridge, cooking, laundry, electronics, etc.
const BASE_BY_PEOPLE: Record<number, number> = { 1: 2600, 2: 3500, 3: 4300, 4: 5000, 5: 5600, 6: 6200 };
const DWELLING_FACTOR: Record<Dwelling, number> = { apartment: 0.85, townhouse: 0.95, house: 1 };
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
  const base = (BASE_BY_PEOPLE[Math.min(6, Math.max(1, Math.round(p.people)))] ?? 4300) * DWELLING_FACTOR[p.dwelling];
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

// The "general average" household the government benchmark assumes — shown
// next to the estimate so the customer can see how they differ from it.
export const TYPICAL_ANNUAL_KWH = 4000;

// Auto-generated from live CDR pull, 22 Sep 2026. One row per plan:
// [retailer, distributor, planName, offerType, supply, anytime, peak, shoulder, offpeak, controlledLoad, solarFit]
// solarFit is the plan's solar feed-in credit in $/kWh exported — null where the
// retailer's CDR feed didn't publish one for this plan (not necessarily $0; treat
// as "unknown" rather than "no credit").
export type PlanRow = [string, string, string, string, number, number | null, number | null, number | null, number | null, number | null, number | null];

export const PLAN_DATA_DATE = "2026-09-22";

export const PLANS: PlanRow[] = [["AGL","AusNet Services","Residential Solar Savers","MARKET",1.2824,0.3198,null,null,null,null,0.005],["AGL","AusNet Services","Residential Standing Offer","STANDING",1.2824,0.3198,null,null,null,0.2211,0.0],["AGL","Citipower","Residential Solar Savers","MARKET",1.2114,0.2596,null,null,null,0.1659,0.005],["AGL","Citipower","Residential Standing Offer","STANDING",1.2114,0.2596,null,null,null,0.1659,0.0],["AGL","Powercor","Residential Solar Savers","MARKET",1.3805,0.2822,null,null,null,0.1726,0.005],["AGL","Powercor","Residential Standing Offer","STANDING",1.3805,0.2822,null,null,null,null,0.0],["AGL","United Energy","Residential Solar Savers","MARKET",1.1912,0.2735,null,null,null,0.1726,0.005],["AGL","United Energy","Residential Standing Offer","STANDING",1.1912,0.2735,null,null,null,0.1726,0.0],["AGL","Jemena","Residential Solar Savers","MARKET",1.2713,0.2747,null,null,null,0.2141,0.005],["AGL","Jemena","Residential Standing Offer","STANDING",1.2713,0.2747,null,null,null,0.2141,0.0],["Origin Energy","AusNet Services","Origin Affinity Variable - One Click Switch - Sept'26 (Time of Use with Dedicated Circuit)","MARKET",1.19262,null,0.44308,0.21021,0.16357,0.20559,0.01],["Origin Energy","AusNet Services","Origin Standing - July'26 (Time of Use)","STANDING",1.282391,null,0.476399,0.225995,0.17589,null,0.01],["Origin Energy","Citipower","Origin Affinity Variable - One Click Switch - Sept'26 (Time of Use)","MARKET",1.12662,null,0.35629,0.1969,0.15433,null,0.01],["Origin Energy","Citipower","Origin Standing - July'26 (Time of Use)","STANDING",1.211397,null,0.383097,0.211695,0.165891,null,0.01],["Origin Energy","Powercor","Origin Affinity Variable - One Click Switch - Sept'26 (Time of Use with Dedicated Circuit)","MARKET",1.28392,null,0.38753,0.20911,0.16049,0.16049,0.01],["Origin Energy","Powercor","Origin Standing - July'26 (Time of Use)","STANDING",1.3805,null,0.416691,0.224895,0.17259,null,0.01],["Origin Energy","United Energy","Origin Affinity Variable - One Click Switch - Sept'26 (Time of Use)","MARKET",1.10781,null,0.37499,0.20592,0.16049,null,0.01],["Origin Energy","United Energy","Origin Standing - July'26 (Time of Use)","STANDING",1.19119,null,0.403194,0.221397,0.17259,null,0.01],["Origin Energy","Jemena","Origin Affinity Variable - One Click Switch - Sept'26 (Time of Use)","MARKET",1.18217,null,0.34936,0.2024,0.16412,null,0.01],["Origin Energy","Jemena","Origin Standing - July'26 (Time of Use)","STANDING",1.271193,null,0.375694,0.217591,0.176495,null,0.01],["EnergyAustralia","AusNet Services","Rate Fix - Time of Use","MARKET",1.282391,null,0.476399,0.225999,0.1759,null,0.015],["EnergyAustralia","AusNet Services","Standing Offer (Home) - Time of Use with Controlled Load","STANDING",1.282391,null,0.476399,0.225999,0.1759,0.2211,0.015],["EnergyAustralia","Citipower","Power 365 - Peak with Controlled Load - Third Party Offer","MARKET",1.211397,0.2596,null,null,null,0.1659,0.015],["EnergyAustralia","Citipower","Standing Offer (Home)  - Peak Only","STANDING",1.211397,0.2596,null,null,null,null,0.015],["EnergyAustralia","Powercor","Power 365 - Peak Only - Third Party Offer","MARKET",1.3805,0.2822,null,null,null,null,0.015],["EnergyAustralia","Powercor","Standing Offer (Home)  - Peak Only","STANDING",1.3805,0.2822,null,null,null,null,0.015],["EnergyAustralia","United Energy","Power 365 - Peak Only - Third Party Offer","MARKET",1.19119,0.2735,null,null,null,null,0.015],["EnergyAustralia","United Energy","Standing Offer (Home)  - Peak with Controlled Load","STANDING",1.19119,0.2735,null,null,null,0.1726,0.015],["EnergyAustralia","Jemena","Home 365 - Time of Use with Controlled Load","MARKET",1.271193,null,0.3757,0.2176,0.176499,0.2141,0.015],["EnergyAustralia","Jemena","Standing Offer (Home) - Time of Use","STANDING",1.271193,null,0.3757,0.2176,0.176499,null,0.015],["Tango Energy","AusNet Services","Everyday Easy","MARKET",0.715,null,0.4675,null,0.099,0.1837,0.0004],["Tango Energy","Citipower","Everyday Easy","MARKET",0.682,null,0.374,null,0.1122,0.1386,0.0004],["Tango Energy","Powercor","Everyday Easy","MARKET",0.825,null,0.407,null,0.1122,0.1485,0.0004],["Tango Energy","United Energy","Everyday Easy","MARKET",0.6468,null,0.385,null,0.1122,null,0.0004],["Tango Energy","Jemena","Everyday Easy","MARKET",0.77,null,0.363,null,0.1122,0.1705,0.0004],["Powershop","AusNet Services","Switch Saver","MARKET",1.217993,null,0.452473,0.214649,0.167065,0.182774,0.01],["Powershop","AusNet Services","Victorian Default Offer","STANDING",1.2824,null,0.476399,0.225999,0.1759,0.2211,0.01],["Powershop","Citipower","Switch Saver","MARKET",1.172839,null,0.370905,0.204961,0.160619,0.137783,0.01],["Powershop","Citipower","Victorian Default Offer","STANDING",1.211399,null,0.383099,0.211699,0.1659,0.1659,0.01],["Powershop","Powercor","Switch Saver","MARKET",1.315734,null,0.397151,0.214348,0.164502,0.142739,0.01],["Powershop","Powercor","Victorian Default Offer","STANDING",1.3805,null,0.4167,0.224899,0.1726,0.1726,0.01],["Powershop","United Energy","Switch Saver","MARKET",1.125507,null,0.380964,0.209189,0.163081,null,0.01],["Powershop","United Energy","Victorian Default Offer","STANDING",1.1912,null,0.4032,0.221399,0.1726,0.1726,0.01],["Powershop","Jemena","Switch Saver","MARKET",1.21206,null,0.358222,0.207477,0.168288,0.175335,0.01],["Powershop","Jemena","Victorian Default Offer","STANDING",1.2712,null,0.3757,0.2176,0.176499,0.2141,0.01],["Alinta Energy","AusNet Services","HomeDeal Next - Single Rate + CL","MARKET",1.02597,0.25586,null,null,null,0.17688,0.0004],["Alinta Energy","AusNet Services","Standing Offer - Single Rate","STANDING",1.28238,0.31977,null,null,null,null,0.0004],["Alinta Energy","Citipower","HomeDeal Next - Single Rate + CL","MARKET",0.9691,0.20768,null,null,null,0.13277,0.0004],["Alinta Energy","Citipower","Standing Offer - Demand Single Rate","STANDING",0.99484,0.2673,null,null,null,null,0.0004],["Alinta Energy","Powercor","HomeDeal Next - Single Rate + CL","MARKET",1.1044,0.22572,null,null,null,0.13805,0.0004],["Alinta Energy","Powercor","Standing Offer - Demand Single Rate","STANDING",1.33166,0.27137,null,null,null,null,0.0004],["Alinta Energy","United Energy","HomeDeal Next - Single Rate + CL","MARKET",0.95293,0.21879,null,null,null,0.13805,0.0004],["Alinta Energy","United Energy","Standing Offer - Single Rate + CL","STANDING",1.19119,0.27346,null,null,null,0.17259,0.0004],["Alinta Energy","Jemena","HomeDeal Next - Single Rate + CL","MARKET",1.01706,0.21978,null,null,null,0.17127,0.0004],["Alinta Energy","Jemena","Standing Offer - Single Rate + CL","STANDING",1.27127,0.27467,null,null,null,0.21406,0.0004],["Momentum Energy","AusNet Services","Warm Welcome","MARKET",1.2045,null,0.4224,0.2002,0.1562,null,0.009],["Momentum Energy","AusNet Services","Standing Offer","STANDING",1.2824,0.3198,null,null,null,0.2211,0.0],["Momentum Energy","Citipower","Warm Welcome","MARKET",1.1385,null,0.3388,0.187,0.1474,null,0.009],["Momentum Energy","Citipower","Standing Offer","STANDING",1.211399,null,0.383099,0.211699,0.1659,0.1659,0.0],["Momentum Energy","Powercor","Warm Welcome","MARKET",1.2969,null,0.3663,0.198,0.1518,null,0.009],["Momentum Energy","Powercor","Standing Offer","STANDING",1.3805,null,0.4167,0.224899,0.1726,null,0.0],["Momentum Energy","United Energy","Warm Welcome","MARKET",1.1187,null,0.3564,0.1958,0.1529,0.1529,0.009],["Momentum Energy","United Energy","Standing Offer","STANDING",1.1912,null,0.4032,0.221399,0.1726,null,0.0],["Momentum Energy","Jemena","Warm Welcome","MARKET",1.1946,null,0.3311,0.1914,0.1551,null,0.009],["Momentum Energy","Jemena","Standing Offer","STANDING",1.2712,null,0.3757,0.2176,0.176499,null,0.0],["Red Energy","AusNet Services","Red Power5","MARKET",1.19262,null,0.44308,null,0.0,null,0.0],["Red Energy","AusNet Services","Victorian Default Offer","STANDING",1.28238,0.319792,null,null,null,null,0.01],["Red Energy","Citipower","Red Power5","MARKET",1.12651,null,0.35629,null,0.0,null,0.0],["Red Energy","Citipower","Victorian Default Offer","STANDING",1.21132,0.2596,null,null,null,null,0.01],["Red Energy","Powercor","Red Power5","MARKET",1.28392,null,0.38753,null,0.0,null,0.0],["Red Energy","Powercor","Victorian Default Offer","STANDING",1.3805,0.282194,null,null,null,null,0.01],["Red Energy","United Energy","Red Power5","MARKET",1.10781,null,0.37499,null,0.0,0.18942,0.0],["Red Energy","United Energy","Victorian Default Offer","STANDING",1.19119,0.273493,null,null,null,null,0.01],["Red Energy","Jemena","Red Power5","MARKET",1.18217,null,0.34936,null,0.0,0.20812,0.0],["Red Energy","Jemena","Victorian Default Offer","STANDING",1.27127,0.274692,null,null,null,null,0.01],["Dodo","AusNet Services","Real Deal - Time of Use","MARKET",0.816943,null,0.477027,null,0.236765,null,0.0004],["Dodo","AusNet Services","Residential Standing - Time of Use","STANDING",1.2824,null,0.4764,null,0.1759,null,0.0004],["Dodo","Citipower","Real Deal - Time of Use","MARKET",0.71784,null,0.390801,null,0.226262,null,0.0004],["Dodo","Citipower","Residential Standing - Time of Use","STANDING",1.2114,null,0.3831,null,0.1659,null,0.0004],["Dodo","Powercor","Real Deal - Single Rate","MARKET",0.909633,0.293589,null,null,null,null,0.0004],["Dodo","Powercor","Residential Standing - Single Rate","STANDING",1.3805,0.2822,null,null,null,null,0.0004],["Dodo","United Energy","Real Deal - Time of Use with Controlled Load","MARKET",0.727414,null,0.406021,null,0.231594,0.18471,0.0004],["Dodo","United Energy","Residential Standing - Time of Use with Controlled Load","STANDING",1.1912,null,0.4032,null,0.1726,0.1726,0.0004],["Dodo","Jemena","Real Deal - Time of Use","MARKET",0.785459,null,0.37687,null,0.22514,null,0.0004],["Dodo","Jemena","Residential Standing - Single Rate","STANDING",1.2713,0.2747,null,null,null,null,0.0004],["Lumo Energy","AusNet Services","Lumo Plus","MARKET",1.19845,0.29425,null,null,null,0.20394,0.01],["Lumo Energy","AusNet Services","Victorian Default Offer","STANDING",1.28238,0.319792,null,null,null,null,0.01],["Lumo Energy","Citipower","Lumo Plus","MARKET",1.05435,0.23078,null,null,null,0.17105,0.01],["Lumo Energy","Citipower","Victorian Default Offer","STANDING",1.21132,0.2596,null,null,null,null,0.01],["Lumo Energy","Powercor","Lumo Plus","MARKET",1.15478,0.25498,null,null,null,0.1804,0.01],["Lumo Energy","Powercor","Victorian Default Offer","STANDING",1.3805,0.282194,null,null,null,0.17259,0.01],["Lumo Energy","United Energy","Lumo Plus","MARKET",0.97845,0.24398,null,null,null,0.17908,0.01],["Lumo Energy","United Energy","Victorian Default Offer","STANDING",1.19119,0.273493,null,null,null,null,0.01],["Lumo Energy","Jemena","Lumo Plus","MARKET",1.04445,0.25245,null,null,null,0.19668,0.01],["Lumo Energy","Jemena","Victorian Default Offer","STANDING",1.27127,0.274692,null,null,null,null,0.01],["Sumo","AusNet Services","Sumo Sunrise Plus","MARKET",1.03873,null,0.39061,null,0.14421,0.17292,0.01],["Sumo","AusNet Services","Sumo Standing Offer","STANDING",1.28238,null,0.4763,null,0.17589,null,0.0],["Sumo","Citipower","Sumo Sunrise Plus","MARKET",0.94479,null,0.29491,null,0.12771,null,0.01],["Sumo","Citipower","Sumo Standing Offer","STANDING",1.21132,null,0.38302,null,0.16588,0.16588,0.0],["Sumo","Powercor","Sumo Sunrise Plus","MARKET",1.07679,null,0.32923,null,0.1364,0.1364,0.01],["Sumo","Powercor","Sumo Standing Offer","STANDING",1.3805,null,0.41668,null,0.17259,null,0.0],["Sumo","United Energy","Sumo Sunrise Plus","MARKET",0.89342,null,0.30635,null,0.13112,0.13112,0.01],["Sumo","United Energy","Sumo Standing Offer","STANDING",1.19119,null,0.40315,null,0.17259,null,0.0],["Sumo","Jemena","Sumo Sunrise Plus","MARKET",0.99154,null,0.29304,null,0.13761,0.16247,0.01],["Sumo","Jemena","Sumo Standing Offer","STANDING",1.27116,null,0.37565,null,0.17644,null,0.0],["GloBird Energy","AusNet Services","GloBird  FULLHOUSE Residential (Flexible Rate) AusNet Services (electricity)","MARKET",1.045,null,0.3685,0.176,0.1474,null,null],["GloBird Energy","AusNet Services","GloBird  STANDING OFFER Residential (Flat Rate With Controlled Load)-AusNet Services (electricity)","STANDING",1.2824,0.3198,null,null,null,0.2211,null],["GloBird Energy","Citipower","GloBird  FULLHOUSE Residential (Flexible Rate) Citipower","MARKET",1.001,null,0.2937,0.1485,0.132,null,null],["GloBird Energy","Citipower","GloBird  STANDING OFFER Residential (Flat Rate  With Controlled Load)-Citipower","STANDING",1.2114,0.2596,null,null,null,0.1659,null],["GloBird Energy","Powercor","GloBird  FULLHOUSE Residential (Flexible RateWith CL) Powercor","MARKET",1.078,null,0.3135,0.1705,0.1397,0.1287,null],["GloBird Energy","Powercor","GloBird  STANDING OFFER Residential (Flat Rate Without Controlled Load)-Powercor","STANDING",1.3805,0.2822,null,null,null,null,null],["GloBird Energy","United Energy","GloBird  FULLHOUSE Residential (Flexible Rate With CL) United Energy","MARKET",0.968,null,0.3047,0.1562,0.1364,0.1276,null],["GloBird Energy","United Energy","GloBird  STANDING OFFER Residential (Flat Rate With Controlled Load)-United Energy","STANDING",1.1912,0.2735,null,null,null,0.1726,null],["GloBird Energy","Jemena","GloBird  FULLHOUSE Residential (Flexible Rate) Jemena","MARKET",0.968,null,0.297,0.1617,0.1408,null,null],["GloBird Energy","Jemena","GloBird  STANDING OFFER Residential (Flat Rate Without Controlled Load)-Jemena","STANDING",1.2713,0.2747,null,null,null,null,null],["Kogan Energy","AusNet Services","Kogan Energy for current FIRST members","MARKET",1.060107,0.264365,null,null,null,null,0.01],["Kogan Energy","Citipower","Kogan Energy for current FIRST members","MARKET",1.006091,0.215602,null,null,null,0.137783,0.01],["Kogan Energy","Powercor","Kogan Energy for current FIRST members","MARKET",1.141674,0.233379,null,null,null,0.142739,0.01],["Kogan Energy","United Energy","Kogan Energy for current FIRST members","MARKET",0.966063,0.221808,null,null,null,0.139978,0.01],["Kogan Energy","Jemena","Kogan Energy for current FIRST members","MARKET",1.041115,0.224962,null,null,null,0.175335,0.01],["CovaU","AusNet Services","EVMax VIC Ausnet Residential TOU","MARKET",1.3849,null,0.62898,null,0.055,null,null],["CovaU","AusNet Services","CovaU Basics Residential Two Rate","STANDING",1.39997,null,0.47641,null,0.22605,null,0.049],["CovaU","Citipower","EVMax VIC Citipower Residential TOU","MARKET",1.2419,null,0.54098,null,0.055,null,null],["CovaU","Citipower","CovaU Basics Residential TOU","STANDING",1.21143,null,0.38313,null,0.16588,null,0.049],["CovaU","Powercor","SolarMax VIC Powercor Residential TOU","MARKET",1.47301,null,0.39798,null,0.0,null,null],["CovaU","Powercor","CovaU Basics Residential TOU","STANDING",1.3805,null,0.41668,null,0.17259,null,0.049],["CovaU","United Energy","SolarMax VIC United Energy Residential TOU","MARKET",1.30801,null,0.37598,null,0.0,null,null],["CovaU","United Energy","CovaU Basics Residential TOU","STANDING",1.19119,null,0.40315,null,0.17259,null,0.049],["CovaU","Jemena","EVMax VIC Jemena Residential TOU","MARKET",1.2859,null,0.54098,null,0.055,null,null],["CovaU","Jemena","CovaU Basics Residential TOU","STANDING",1.27116,null,0.37565,null,0.17655,null,0.049],["Blue NRG","AusNet Services","Blue VDO Single Rate with controlled load","STANDING",1.28238,0.3198,null,null,null,0.2211,0.01],["Blue NRG","Citipower","Blue VDO Single Rate with controlled load","STANDING",1.21143,0.2596,null,null,null,0.16588,0.01],["Blue NRG","Powercor","Blue VDO Single Rate with controlled load","STANDING",1.3805,0.2822,null,null,null,0.17259,0.01],["Blue NRG","United Energy","Blue VDO Single Rate (General Usage)","STANDING",1.19119,0.2735,null,null,null,null,0.01],["Blue NRG","Jemena","Blue VDO Single Rate (General Usage)","STANDING",1.27127,0.2747,null,null,null,null,0.01]];

/** How many retailers our plan data covers (not the whole market). */
export const RETAILER_COUNT = new Set(PLANS.map((p) => p[0])).size;

export const DISTRIBUTORS = ["Citipower", "Powercor", "United Energy", "Jemena", "AusNet Services"] as const;
export type Distributor = typeof DISTRIBUTORS[number];

export const VDO: Record<Distributor, { supply: number; usage: number; cl: number; annual: number }> = {
  "Citipower":       { supply: 1.211, usage: 0.260, cl: 0.166, annual: 1481 },
  "Powercor":        { supply: 1.381, usage: 0.282, cl: 0.173, annual: 1633 },
  "United Energy":   { supply: 1.191, usage: 0.274, cl: 0.173, annual: 1529 },
  "Jemena":          { supply: 1.271, usage: 0.275, cl: 0.214, annual: 1563 },
  "AusNet Services": { supply: 1.282, usage: 0.320, cl: 0.221, annual: 1748 },
};

export interface UsageInput {
  days: number;
  peak: number;
  shoulder: number;
  offpeak: number;
  anytime: number;
  cl: number;
  // kWh exported to the grid over the same billing period, for a customer
  // with solar. 0 (the default) means "no solar / not supplied" — plans with
  // no published solarFit simply contribute no credit either way.
  solarExportKwh?: number;
}

/** Validated 1:1 against the Excel pricing engine (VIC_Bill_Comparator_Live.xlsx):
 * single-rate plans price off total usage across all bands; TOU plans are only
 * comparable, and only priced, when a real Peak/Shoulder/Off-Peak split is supplied.
 * Solar feed-in is a straight credit (export kWh x the plan's solarFit rate) —
 * real per-plan data from the same CDR pull as every other rate here, not an
 * estimate — subtracted after the usage/supply charges are totalled. */
export function computeBill(plan: PlanRow, u: UsageInput): number | null {
  const [, , , , supply, pAnytime, pPeak, pShoulder, pOffpeak, pCl, pSolarFit] = plan;
  const hasBand = (u.peak + u.shoulder + u.offpeak) > 0;
  const comparable = pAnytime !== null || (pPeak !== null && hasBand);
  if (!comparable) return null;
  // Time-of-use plans can't price a lump "total" on top of time bands.
  if (pAnytime === null && u.anytime > 0) return null;
  // Controlled-load (off-peak hot water) usage needs a controlled-load rate.
  // Plans without one are the "no controlled load" version of a product and
  // would otherwise price that usage at $0.
  if (u.cl > 0 && pCl === null) return null;
  const totalUsage = u.peak + u.shoulder + u.offpeak + u.anytime;
  const fixed = supply * u.days;
  let variable: number;
  if (pAnytime !== null) {
    variable = pAnytime * totalUsage;
  } else if (pPeak !== null) {
    // Two-rate plans publish no shoulder rate: everything outside the peak
    // window is off-peak, so shoulder kWh is charged at the off-peak rate.
    // A free or near-free "off-peak" is a short window (EV / solar sponge),
    // not the whole shoulder period, so then shoulder is charged at peak.
    const offpeakIsWindow = pOffpeak !== null && pOffpeak <= EV_FRIENDLY_OFFPEAK_THRESHOLD;
    const shoulderRate = pShoulder ?? (pOffpeak !== null && !offpeakIsWindow ? pOffpeak : pPeak);
    variable = pPeak * u.peak + shoulderRate * u.shoulder + (pOffpeak ?? 0) * u.offpeak;
  } else {
    variable = 0;
  }
  const varCl = pCl !== null ? pCl * u.cl : 0;
  const solarCredit = pSolarFit !== null ? pSolarFit * (u.solarExportKwh ?? 0) : 0;
  // Not clamped at 0: a generous feed-in credit can genuinely outweigh usage
  // charges for a billing period, and clamping would make two plans with
  // different (large) credits look identical when ranking — the negative
  // total is real and worth showing as "you're in credit".
  return fixed + variable + varCl - solarCredit;
}

/** The solar credit component alone, for display (RateBreakdown etc.) — null
 * when this plan simply doesn't publish a feed-in rate, so the UI can say
 * "not published" rather than implying $0. */
export function solarCreditFor(plan: PlanRow, solarExportKwh: number): number | null {
  const solarFit = plan[10];
  if (solarFit === null) return null;
  return solarFit * solarExportKwh;
}

export function benchmarkBill(distributor: Distributor, days: number, currentBill: number | null): number {
  if (currentBill !== null && !Number.isNaN(currentBill) && currentBill > 0) return currentBill;
  const vdo = VDO[distributor];
  return (vdo.annual / 365) * days;
}

export interface RankedMatch {
  plan: PlanRow;
  total: number;
}

export interface RankOptions {
  /** The household charges an electric car at home. Plans built around a
   *  very cheap or free overnight window (isEvFriendly) are only shown then:
   *  for everyone else that window doesn't reflect what they'd really pay. */
  ev?: boolean;
}

export function rankPlans(distributor: Distributor, u: UsageInput, opts: RankOptions = {}): RankedMatch[] {
  const matches: RankedMatch[] = [];
  for (const plan of PLANS) {
    if (plan[1] !== distributor) continue;
    if (!opts.ev && isEvFriendly(plan)) continue;
    const total = computeBill(plan, u);
    if (total === null) continue;
    matches.push({ plan, total });
  }
  matches.sort((a, b) => a.total - b.total);
  return matches;
}

export function countComparable(distributor: Distributor, peak: number, shoulder: number, offpeak: number): number {
  const hasBand = peak + shoulder + offpeak > 0;
  let n = 0;
  for (const plan of PLANS) {
    if (plan[1] !== distributor) continue;
    const comparable = plan[5] !== null || (plan[6] !== null && hasBand);
    if (comparable) n++;
  }
  return n;
}

// A handful of plans carry a genuinely tiny — sometimes $0 — off-peak rate
// (e.g. CovaU's "EVMax"/"SolarMax" plans, Red Energy's "Power5" plans).
// That's exactly what matters for someone charging an EV overnight, so we
// surface it rather than inventing a separate "EV plan" category this data
// doesn't actually have. 6c/kWh is a real break in the data (the next
// cheapest off-peak rate after this group is 9c), not an arbitrary round
// number — see the distribution check this threshold was chosen from.
export const EV_FRIENDLY_OFFPEAK_THRESHOLD = 0.06;

export function isEvFriendly(plan: PlanRow): boolean {
  const offpeak = plan[8];
  return offpeak !== null && offpeak <= EV_FRIENDLY_OFFPEAK_THRESHOLD;
}

export function countEvFriendly(distributor: Distributor): number {
  let n = 0;
  for (const plan of PLANS) {
    if (plan[1] === distributor && isEvFriendly(plan)) n++;
  }
  return n;
}

export function totalEvFriendly(): number {
  let n = 0;
  for (const plan of PLANS) {
    if (isEvFriendly(plan)) n++;
  }
  return n;
}

/** How many plans publish a solar feed-in rate at all (not how generous it
 * is) — used to set expectations on the solar step ("most plans include a
 * feed-in credit; a few don't publish one"). */
export function totalWithSolarFit(): number {
  let n = 0;
  for (const plan of PLANS) {
    if (plan[10] !== null) n++;
  }
  return n;
}

/** Looks up the exact plan row a subscriber was matched to, so the account
 * portal can show their real tariff (supply charge, usage rates, solar
 * feed-in) rather than just the retailer/plan name text stored on their
 * subscriber row. Matches on retailer + plan name + distributor, the same
 * triple stored in `subscribers.baseline_retailer` / `baseline_plan_name` /
 * `distributor` — returns null if the plan has since been retired from a
 * later data pull (rates change; the stored name is historical). */
export function findPlanRow(retailer: string, planName: string, distributor: string): PlanRow | null {
  for (const plan of PLANS) {
    if (plan[0] === retailer && plan[2] === planName && plan[1] === distributor) return plan;
  }
  return null;
}

export interface PlanRateRow {
  label: string;
  value: string;
}

export function fmtRateCents(v: number): string {
  return (v * 100).toLocaleString("en-AU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "c/kWh";
}
export function fmtRatePerDay(v: number): string {
  return "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "/day";
}

/** The actual c/kWh and $/day rates behind a plan's total, as a flat list of
 * label/value rows ready to render — shared between the /check results
 * (Comparator.tsx) and the account portal's "your tariff" card so a
 * subscriber sees the exact same breakdown style in both places. */
export function planRateRows(plan: PlanRow, solarExportKwh: number): PlanRateRow[] {
  const [, , , , supply, anytimeRate, peakRate, shoulderRate, offpeakRate, clRate, solarFit] = plan;
  const rows: PlanRateRow[] = [{ label: "Supply charge", value: fmtRatePerDay(supply) }];
  if (anytimeRate !== null) {
    rows.push({ label: "Usage rate", value: fmtRateCents(anytimeRate) });
  } else {
    if (peakRate !== null) rows.push({ label: "Peak", value: fmtRateCents(peakRate) });
    if (shoulderRate !== null) rows.push({ label: "Shoulder", value: fmtRateCents(shoulderRate) });
    if (offpeakRate !== null) rows.push({ label: "Off-peak", value: fmtRateCents(offpeakRate) });
  }
  if (clRate !== null) rows.push({ label: "Controlled load", value: fmtRateCents(clRate) });
  if (solarExportKwh > 0) {
    const credit = solarCreditFor(plan, solarExportKwh);
    rows.push({
      label: "Solar feed-in",
      value: credit !== null ? `${fmtRateCents(solarFit!)} credit` : "not published",
    });
  }
  return rows;
}

// Auto-generated from live CDR pull, 22 Sep 2026. One row per plan:
// [retailer, distributor, planName, offerType, supply, anytime, peak, shoulder, offpeak, controlledLoad, solarFit]
// solarFit is the plan's solar feed-in credit in $/kWh exported — null where the
// retailer's CDR feed didn't publish one for this plan (not necessarily $0; treat
// as "unknown" rather than "no credit").
export type PlanRow = [string, string, string, string, number, number | null, number | null, number | null, number | null, number | null, number | null];

export const PLAN_DATA_DATE = "2026-09-22";

export const PLANS: PlanRow[] = [["AGL","AusNet Services","Residential Solar Savers","MARKET",1.16581818,0.29072727,null,null,null,null,0.005],["AGL","AusNet Services","Residential Standing Offer","STANDING",1.16581818,0.29072727,null,null,null,0.201,0.0],["AGL","Citipower","Residential Solar Savers","MARKET",1.10127273,0.236,null,null,null,0.15081818,0.005],["AGL","Citipower","Residential Standing Offer","STANDING",1.10127273,0.236,null,null,null,0.15081818,0.0],["AGL","Powercor","Residential Solar Savers","MARKET",1.255,0.25654545,null,null,null,0.15690909,0.005],["AGL","Powercor","Residential Standing Offer","STANDING",1.255,0.25654545,null,null,null,null,0.0],["AGL","United Energy","Residential Solar Savers","MARKET",1.08290909,0.24863636,null,null,null,0.15690909,0.005],["AGL","United Energy","Residential Standing Offer","STANDING",1.08290909,0.24863636,null,null,null,0.15690909,0.0],["AGL","Jemena","Residential Solar Savers","MARKET",1.15572727,0.24972727,null,null,null,0.19463636,0.005],["AGL","Jemena","Residential Standing Offer","STANDING",1.15572727,0.24972727,null,null,null,0.19463636,0.0],["Origin Energy","AusNet Services","Origin Affinity Variable - One Click Switch - Sept'26 (Time of Use with Dedicated Circuit)","MARKET",1.0842,null,0.4028,0.1911,0.1487,0.1869,0.01],["Origin Energy","AusNet Services","Origin Standing - July'26 (Time of Use)","STANDING",1.16581,null,0.43309,0.20545,0.1599,null,0.01],["Origin Energy","Citipower","Origin Affinity Variable - One Click Switch - Sept'26 (Time of Use)","MARKET",1.0242,null,0.3239,0.179,0.1403,null,0.01],["Origin Energy","Citipower","Origin Standing - July'26 (Time of Use)","STANDING",1.10127,null,0.34827,0.19245,0.15081,null,0.01],["Origin Energy","Powercor","Origin Affinity Variable - One Click Switch - Sept'26 (Time of Use with Dedicated Circuit)","MARKET",1.1672,null,0.3523,0.1901,0.1459,0.1459,0.01],["Origin Energy","Powercor","Origin Standing - July'26 (Time of Use)","STANDING",1.255,null,0.37881,0.20445,0.1569,null,0.01],["Origin Energy","United Energy","Origin Affinity Variable - One Click Switch - Sept'26 (Time of Use)","MARKET",1.0071,null,0.3409,0.1872,0.1459,null,0.01],["Origin Energy","United Energy","Origin Standing - July'26 (Time of Use)","STANDING",1.0829,null,0.36654,0.20127,0.1569,null,0.01],["Origin Energy","Jemena","Origin Affinity Variable - One Click Switch - Sept'26 (Time of Use)","MARKET",1.0747,null,0.3176,0.184,0.1492,null,0.01],["Origin Energy","Jemena","Origin Standing - July'26 (Time of Use)","STANDING",1.15563,null,0.34154,0.19781,0.16045,null,0.01],["EnergyAustralia","AusNet Services","Rate Fix - Time of Use","MARKET",1.16581,null,0.43309,0.205454,0.159909,null,0.015],["EnergyAustralia","AusNet Services","Standing Offer (Home) - Time of Use with Controlled Load","STANDING",1.16581,null,0.43309,0.205454,0.159909,0.201,0.015],["EnergyAustralia","Citipower","Power 365 - Peak with Controlled Load - Third Party Offer","MARKET",1.10127,0.236,null,null,null,0.150818,0.015],["EnergyAustralia","Citipower","Standing Offer (Home)  - Peak Only","STANDING",1.10127,0.236,null,null,null,null,0.015],["EnergyAustralia","Powercor","Power 365 - Peak Only - Third Party Offer","MARKET",1.255,0.256545,null,null,null,null,0.015],["EnergyAustralia","Powercor","Standing Offer (Home)  - Peak Only","STANDING",1.255,0.256545,null,null,null,null,0.015],["EnergyAustralia","United Energy","Power 365 - Peak Only - Third Party Offer","MARKET",1.0829,0.248636,null,null,null,null,0.015],["EnergyAustralia","United Energy","Standing Offer (Home)  - Peak with Controlled Load","STANDING",1.0829,0.248636,null,null,null,0.156909,0.015],["EnergyAustralia","Jemena","Home 365 - Time of Use with Controlled Load","MARKET",1.15563,null,0.341545,0.197818,0.160454,0.194636,0.015],["EnergyAustralia","Jemena","Standing Offer (Home) - Time of Use","STANDING",1.15563,null,0.341545,0.197818,0.160454,null,0.015],["Tango Energy","AusNet Services","Everyday Easy","MARKET",0.65,null,0.425,null,0.09,0.167,0.0004],["Tango Energy","Citipower","Everyday Easy","MARKET",0.62,null,0.34,null,0.102,0.126,0.0004],["Tango Energy","Powercor","Everyday Easy","MARKET",0.75,null,0.37,null,0.102,0.135,0.0004],["Tango Energy","United Energy","Everyday Easy","MARKET",0.588,null,0.35,null,0.102,null,0.0004],["Tango Energy","Jemena","Everyday Easy","MARKET",0.7,null,0.33,null,0.102,0.155,0.0004],["Powershop","AusNet Services","Switch Saver","MARKET",1.107266,null,0.411339,0.195135,0.151877,0.166158,0.01],["Powershop","AusNet Services","Victorian Default Offer","STANDING",1.165818,null,0.43309,0.205454,0.159909,0.201,0.01],["Powershop","Citipower","Switch Saver","MARKET",1.066217,null,0.337186,0.186328,0.146017,0.125257,0.01],["Powershop","Citipower","Victorian Default Offer","STANDING",1.101272,null,0.348272,0.192454,0.150818,0.150818,0.01],["Powershop","Powercor","Switch Saver","MARKET",1.196122,null,0.361046,0.194862,0.149547,0.129763,0.01],["Powershop","Powercor","Victorian Default Offer","STANDING",1.255,null,0.378818,0.204454,0.156909,0.156909,0.01],["Powershop","United Energy","Switch Saver","MARKET",1.023188,null,0.346331,0.190172,0.148255,null,0.01],["Powershop","United Energy","Victorian Default Offer","STANDING",1.082909,null,0.366545,0.201272,0.156909,0.156909,0.01],["Powershop","Jemena","Switch Saver","MARKET",1.101873,null,0.325656,0.188615,0.152989,0.159395,0.01],["Powershop","Jemena","Victorian Default Offer","STANDING",1.155636,null,0.341545,0.197818,0.160454,0.194636,0.01],["Alinta Energy","AusNet Services","HomeDeal Next - Single Rate + CL","MARKET",0.9327,0.2326,null,null,null,0.1608,0.0004],["Alinta Energy","AusNet Services","Standing Offer - Single Rate","STANDING",1.1658,0.2907,null,null,null,null,0.0004],["Alinta Energy","Citipower","HomeDeal Next - Single Rate + CL","MARKET",0.881,0.1888,null,null,null,0.1207,0.0004],["Alinta Energy","Citipower","Standing Offer - Demand Single Rate","STANDING",0.9044,0.243,null,null,null,null,0.0004],["Alinta Energy","Powercor","HomeDeal Next - Single Rate + CL","MARKET",1.004,0.2052,null,null,null,0.1255,0.0004],["Alinta Energy","Powercor","Standing Offer - Demand Single Rate","STANDING",1.2106,0.2467,null,null,null,null,0.0004],["Alinta Energy","United Energy","HomeDeal Next - Single Rate + CL","MARKET",0.8663,0.1989,null,null,null,0.1255,0.0004],["Alinta Energy","United Energy","Standing Offer - Single Rate + CL","STANDING",1.0829,0.2486,null,null,null,0.1569,0.0004],["Alinta Energy","Jemena","HomeDeal Next - Single Rate + CL","MARKET",0.9246,0.1998,null,null,null,0.1557,0.0004],["Alinta Energy","Jemena","Standing Offer - Single Rate + CL","STANDING",1.1557,0.2497,null,null,null,0.1946,0.0004],["Momentum Energy","AusNet Services","Warm Welcome","MARKET",1.095,null,0.384,0.182,0.142,null,0.009],["Momentum Energy","AusNet Services","Standing Offer","STANDING",1.165818,0.290727,null,null,null,0.201,0.0],["Momentum Energy","Citipower","Warm Welcome","MARKET",1.035,null,0.308,0.17,0.134,null,0.009],["Momentum Energy","Citipower","Standing Offer","STANDING",1.101272,null,0.348272,0.192454,0.150818,0.150818,0.0],["Momentum Energy","Powercor","Warm Welcome","MARKET",1.179,null,0.333,0.18,0.138,null,0.009],["Momentum Energy","Powercor","Standing Offer","STANDING",1.255,null,0.378818,0.204454,0.156909,null,0.0],["Momentum Energy","United Energy","Warm Welcome","MARKET",1.017,null,0.324,0.178,0.139,0.139,0.009],["Momentum Energy","United Energy","Standing Offer","STANDING",1.082909,null,0.366545,0.201272,0.156909,null,0.0],["Momentum Energy","Jemena","Warm Welcome","MARKET",1.086,null,0.301,0.174,0.141,null,0.009],["Momentum Energy","Jemena","Standing Offer","STANDING",1.155636,null,0.341545,0.197818,0.160454,null,0.0],["Red Energy","AusNet Services","Red Power5","MARKET",1.0842,null,0.4028,null,0.0,null,0.0],["Red Energy","AusNet Services","Victorian Default Offer","STANDING",1.1658,0.29072,null,null,null,null,0.01],["Red Energy","Citipower","Red Power5","MARKET",1.0241,null,0.3239,null,0.0,null,0.0],["Red Energy","Citipower","Victorian Default Offer","STANDING",1.1012,0.236,null,null,null,null,0.01],["Red Energy","Powercor","Red Power5","MARKET",1.1672,null,0.3523,null,0.0,null,0.0],["Red Energy","Powercor","Victorian Default Offer","STANDING",1.255,0.25654,null,null,null,null,0.01],["Red Energy","United Energy","Red Power5","MARKET",1.0071,null,0.3409,null,0.0,0.1722,0.0],["Red Energy","United Energy","Victorian Default Offer","STANDING",1.0829,0.24863,null,null,null,null,0.01],["Red Energy","Jemena","Red Power5","MARKET",1.0747,null,0.3176,null,0.0,0.1892,0.0],["Red Energy","Jemena","Victorian Default Offer","STANDING",1.1557,0.24972,null,null,null,null,0.01],["Dodo","AusNet Services","Real Deal - Time of Use","MARKET",0.742675,null,0.433661,null,0.215241,null,0.0004],["Dodo","AusNet Services","Residential Standing - Time of Use","STANDING",1.165818,null,0.433091,null,0.159909,null,0.0004],["Dodo","Citipower","Real Deal - Time of Use","MARKET",0.652582,null,0.355274,null,0.205693,null,0.0004],["Dodo","Citipower","Residential Standing - Time of Use","STANDING",1.101273,null,0.348273,null,0.150818,null,0.0004],["Dodo","Powercor","Real Deal - Single Rate","MARKET",0.826939,0.266899,null,null,null,null,0.0004],["Dodo","Powercor","Residential Standing - Single Rate","STANDING",1.255,0.256545,null,null,null,null,0.0004],["Dodo","United Energy","Real Deal - Time of Use with Controlled Load","MARKET",0.661285,null,0.36911,null,0.21054,0.167918,0.0004],["Dodo","United Energy","Residential Standing - Time of Use with Controlled Load","STANDING",1.082909,null,0.366545,null,0.156909,0.156909,0.0004],["Dodo","Jemena","Real Deal - Time of Use","MARKET",0.714054,null,0.342609,null,0.204673,null,0.0004],["Dodo","Jemena","Residential Standing - Single Rate","STANDING",1.155727,0.249727,null,null,null,null,0.0004],["Lumo Energy","AusNet Services","Lumo Plus","MARKET",1.0895,0.2675,null,null,null,0.1854,0.01],["Lumo Energy","AusNet Services","Victorian Default Offer","STANDING",1.1658,0.29072,null,null,null,null,0.01],["Lumo Energy","Citipower","Lumo Plus","MARKET",0.9585,0.2098,null,null,null,0.1555,0.01],["Lumo Energy","Citipower","Victorian Default Offer","STANDING",1.1012,0.236,null,null,null,null,0.01],["Lumo Energy","Powercor","Lumo Plus","MARKET",1.0498,0.2318,null,null,null,0.164,0.01],["Lumo Energy","Powercor","Victorian Default Offer","STANDING",1.255,0.25654,null,null,null,0.1569,0.01],["Lumo Energy","United Energy","Lumo Plus","MARKET",0.8895,0.2218,null,null,null,0.1628,0.01],["Lumo Energy","United Energy","Victorian Default Offer","STANDING",1.0829,0.24863,null,null,null,null,0.01],["Lumo Energy","Jemena","Lumo Plus","MARKET",0.9495,0.2295,null,null,null,0.1788,0.01],["Lumo Energy","Jemena","Victorian Default Offer","STANDING",1.1557,0.24972,null,null,null,null,0.01],["Sumo","AusNet Services","Sumo Sunrise Plus","MARKET",0.9443,null,0.3551,null,0.1311,0.1572,0.01],["Sumo","AusNet Services","Sumo Standing Offer","STANDING",1.1658,null,0.433,null,0.1599,null,0.0],["Sumo","Citipower","Sumo Sunrise Plus","MARKET",0.8589,null,0.2681,null,0.1161,null,0.01],["Sumo","Citipower","Sumo Standing Offer","STANDING",1.1012,null,0.3482,null,0.1508,0.1508,0.0],["Sumo","Powercor","Sumo Sunrise Plus","MARKET",0.9789,null,0.2993,null,0.124,0.124,0.01],["Sumo","Powercor","Sumo Standing Offer","STANDING",1.255,null,0.3788,null,0.1569,null,0.0],["Sumo","United Energy","Sumo Sunrise Plus","MARKET",0.8122,null,0.2785,null,0.1192,0.1192,0.01],["Sumo","United Energy","Sumo Standing Offer","STANDING",1.0829,null,0.3665,null,0.1569,null,0.0],["Sumo","Jemena","Sumo Sunrise Plus","MARKET",0.9014,null,0.2664,null,0.1251,0.1477,0.01],["Sumo","Jemena","Sumo Standing Offer","STANDING",1.1556,null,0.3415,null,0.1604,null,0.0],["GloBird Energy","AusNet Services","GloBird  FULLHOUSE Residential (Flexible Rate) AusNet Services (electricity)","MARKET",0.95,null,0.335,0.16,0.134,null,null],["GloBird Energy","AusNet Services","GloBird  STANDING OFFER Residential (Flat Rate With Controlled Load)-AusNet Services (electricity)","STANDING",1.165818,0.290727,null,null,null,0.201,null],["GloBird Energy","Citipower","GloBird  FULLHOUSE Residential (Flexible Rate) Citipower","MARKET",0.91,null,0.267,0.135,0.12,null,null],["GloBird Energy","Citipower","GloBird  STANDING OFFER Residential (Flat Rate  With Controlled Load)-Citipower","STANDING",1.101273,0.236,null,null,null,0.150818,null],["GloBird Energy","Powercor","GloBird  FULLHOUSE Residential (Flexible RateWith CL) Powercor","MARKET",0.98,null,0.285,0.155,0.127,0.117,null],["GloBird Energy","Powercor","GloBird  STANDING OFFER Residential (Flat Rate Without Controlled Load)-Powercor","STANDING",1.255,0.256545,null,null,null,null,null],["GloBird Energy","United Energy","GloBird  FULLHOUSE Residential (Flexible Rate With CL) United Energy","MARKET",0.88,null,0.277,0.142,0.124,0.116,null],["GloBird Energy","United Energy","GloBird  STANDING OFFER Residential (Flat Rate With Controlled Load)-United Energy","STANDING",1.082909,0.248636,null,null,null,0.156909,null],["GloBird Energy","Jemena","GloBird  FULLHOUSE Residential (Flexible Rate) Jemena","MARKET",0.88,null,0.27,0.147,0.128,null,null],["GloBird Energy","Jemena","GloBird  STANDING OFFER Residential (Flat Rate Without Controlled Load)-Jemena","STANDING",1.155727,0.249727,null,null,null,null,null],["Kogan Energy","AusNet Services","Kogan Energy for current FIRST members","MARKET",0.963734,0.240332,null,null,null,null,0.01],["Kogan Energy","Citipower","Kogan Energy for current FIRST members","MARKET",0.914628,0.196002,null,null,null,0.125257,0.01],["Kogan Energy","Powercor","Kogan Energy for current FIRST members","MARKET",1.037885,0.212163,null,null,null,0.129763,0.01],["Kogan Energy","United Energy","Kogan Energy for current FIRST members","MARKET",0.878239,0.201644,null,null,null,0.127253,0.01],["Kogan Energy","Jemena","Kogan Energy for current FIRST members","MARKET",0.946468,0.204511,null,null,null,0.159395,0.01],["CovaU","AusNet Services","EVMax VIC Ausnet Residential TOU","MARKET",1.259,null,0.5718,null,0.05,null,null],["CovaU","AusNet Services","CovaU Basics Residential Two Rate","STANDING",1.2727,null,0.4331,null,0.2055,null,0.049],["CovaU","Citipower","EVMax VIC Citipower Residential TOU","MARKET",1.129,null,0.4918,null,0.05,null,null],["CovaU","Citipower","CovaU Basics Residential TOU","STANDING",1.1013,null,0.3483,null,0.1508,null,0.049],["CovaU","Powercor","SolarMax VIC Powercor Residential TOU","MARKET",1.3391,null,0.3618,null,0.0,null,null],["CovaU","Powercor","CovaU Basics Residential TOU","STANDING",1.255,null,0.3788,null,0.1569,null,0.049],["CovaU","United Energy","SolarMax VIC United Energy Residential TOU","MARKET",1.1891,null,0.3418,null,0.0,null,null],["CovaU","United Energy","CovaU Basics Residential TOU","STANDING",1.0829,null,0.3665,null,0.1569,null,0.049],["CovaU","Jemena","EVMax VIC Jemena Residential TOU","MARKET",1.169,null,0.4918,null,0.05,null,null],["CovaU","Jemena","CovaU Basics Residential TOU","STANDING",1.1556,null,0.3415,null,0.1605,null,0.049],["Blue NRG","AusNet Services","Blue VDO Single Rate with controlled load","STANDING",1.1658,0.29072727,null,null,null,0.201,0.01],["Blue NRG","Citipower","Blue VDO Single Rate with controlled load","STANDING",1.1013,0.236,null,null,null,0.1508,0.01],["Blue NRG","Powercor","Blue VDO Single Rate with controlled load","STANDING",1.255,0.25654545,null,null,null,0.1569,0.01],["Blue NRG","United Energy","Blue VDO Single Rate (General Usage)","STANDING",1.0829,0.24863636,null,null,null,null,0.01],["Blue NRG","Jemena","Blue VDO Single Rate (General Usage)","STANDING",1.1557,0.24972727,null,null,null,null,0.01]];

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
  const totalUsage = u.peak + u.shoulder + u.offpeak + u.anytime;
  const fixed = supply * u.days;
  let variable: number;
  if (pAnytime !== null) {
    variable = pAnytime * totalUsage;
  } else if (pPeak !== null) {
    // Two-rate plans publish no shoulder rate: everything outside the peak
    // window is off-peak, so shoulder kWh is charged at the off-peak rate
    // (never free). Falls back to peak if no off-peak rate is published.
    const shoulderRate = pShoulder ?? pOffpeak ?? pPeak;
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

export function rankPlans(distributor: Distributor, u: UsageInput): RankedMatch[] {
  const matches: RankedMatch[] = [];
  for (const plan of PLANS) {
    if (plan[1] !== distributor) continue;
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

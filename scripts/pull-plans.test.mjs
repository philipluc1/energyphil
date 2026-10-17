import assert from "node:assert/strict";
import { parsePlan } from "./pull-plans.mjs";
const tou = { electricityContract: { tariffPeriod: [{ rateBlockUType: "timeOfUseRates", dailySupplyCharges: "1.0842",
  timeOfUseRates: [{ type: "PEAK", rates: [{ unitPrice: "0.4028" }] }, { type: "OFF_PEAK", rates: [{ unitPrice: "0.1487" }] }, { type: "SHOULDER", rates: [{ unitPrice: "0.1911" }] }] }],
  controlledLoad: [{ singleRate: { rates: [{ unitPrice: "0.1869" }] } }], solarFeedInTariff: [{ singleTariff: { rates: [{ unitPrice: "0.01" }] } }] } };
assert.deepEqual(parsePlan(tou), { supply: 1.19262, anytime: null, peak: 0.44308, shoulder: 0.21021, offpeak: 0.16357, cl: 0.20559, solarFit: 0.01 });
const single = { electricityContract: { tariffPeriod: [{ rateBlockUType: "singleRate", dailySupplyCharges: "1.1658", singleRate: { rates: [{ unitPrice: "0.2907" }] } }] } };
assert.deepEqual(parsePlan(single), { supply: 1.28238, anytime: 0.31977, peak: null, shoulder: null, offpeak: null, cl: null, solarFit: null });
assert.equal(parsePlan({ electricityContract: { tariffPeriod: [{ rateBlockUType: "demandCharges", dailySupplyCharges: "1" }] } }), null);
console.log("parser ok");
import { parseGasPlan } from "./pull-plans.mjs";
const gas = { gasContract: { tariffPeriod: [{ dailySupplyCharges: "0.85", singleRate: { rates: [{ unitPrice: "0.0412", volume: 50, period: "P1D", measureUnit: "MJ" }, { unitPrice: "0.0318", period: "P1D", measureUnit: "MJ" }] } }] } };
assert.deepEqual(parseGasPlan(gas), { supply: 0.935, blocks: [{ upTo: 50, rate: 0.04532 }, { upTo: null, rate: 0.03498 }], perDay: true });
console.log("gas parser ok");

// Duplicate bands (e.g. a free 11am-2pm window listed as a second OFF_PEAK) keep the higher rate.
const dup = { electricityContract: { tariffPeriod: [{ rateBlockUType: "timeOfUseRates", dailySupplyCharges: "1",
  timeOfUseRates: [{ type: "PEAK", rates: [{ unitPrice: "0.40" }] }, { type: "OFF_PEAK", rates: [{ unitPrice: "0" }] }, { type: "OFF_PEAK", rates: [{ unitPrice: "0.20" }] }] }] } };
assert.equal(parsePlan(dup).offpeak, 0.22);
console.log("duplicate band ok");

// Offer dates: a new offer gets "seen" today; a price change gets "priceChanged" today.
import { buildPlanDates } from "./pull-plans.mjs";
const terms = 'export const PLAN_DATES: Record<string, PlanDates> = {"AGL|Saver":{"from":"2026-07-01","updated":null,"seen":null,"priceChanged":null}};';
const prevPlans = 'export const PLANS: PlanRow[] = [["AGL","Citipower","Saver","MARKET",1,0.3,null,null,null,null,null]];';
const newRows = [["AGL", "Citipower", "Saver", "MARKET", 1, 0.28, null, null, null, null, null], ["GloBird Energy", "Citipower", "GloSave", "MARKET", 1, 0.25, null, null, null, null, null]];
const outSrc = buildPlanDates(terms, prevPlans, newRows, "2026-10-17");
const dates = JSON.parse(outSrc.match(/= (\{.*\});/)[1]);
assert.equal(dates["AGL|Saver"].from, "2026-07-01");
assert.equal(dates["AGL|Saver"].priceChanged, "2026-10-17");
assert.equal(dates["AGL|Saver"].seen, null);
assert.equal(dates["GloBird Energy|GloSave"].seen, "2026-10-17");
console.log("offer dates ok");

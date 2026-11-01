// Run: npx tsx lib/planVersion.test.ts
import assert from "node:assert/strict";
import { planVsBill, samePlanName } from "./planVersion";

const plan = ["OVO Energy", "Powercor", "The One Plan - OCT2026", "MARKET", 1.1, 0.25, null, null, null, null, 0.033];
const rates = { supply: 1.1, anytime: 0.25, peak: null, shoulder: null, offpeak: null, cl: null };
assert.equal(samePlanName("The One Plan", "The One Plan - OCT2026", "OVO Energy"), true);
// Same name, same rates: it's their plan.
assert.equal(planVsBill(plan, { retailer: "OVO Energy", planName: "The One Plan", rates }), "yourPlan");
// Same name, rates moved: a new price under the same name.
assert.equal(planVsBill(plan, { retailer: "OVO Energy", planName: "The One Plan", rates: { ...rates, anytime: 0.2822 } }), "newRates");
// Bill is time of use, plan is single rate: a different tariff.
assert.equal(planVsBill(plan, { retailer: "OVO Energy", planName: "The One Plan", rates: { ...rates, anytime: null, peak: 0.35, offpeak: 0.2 } }), "newRates");
// No rates to compare.
assert.equal(planVsBill(plan, { retailer: "OVO Energy", planName: "The One Plan", rates: null }), "sameName");
// Other plan from the same retailer; other retailer.
assert.equal(planVsBill(plan, { retailer: "OVO Energy", planName: "Solar Max", rates }), "yourRetailer");
assert.equal(planVsBill(plan, { retailer: "AGL", planName: "The One Plan", rates }), null);
console.log("planVersion: ok");

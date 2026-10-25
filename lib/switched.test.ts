// Run: npx tsx lib/switched.test.ts
import assert from "node:assert/strict";
import { parseSwitchedTo, switchedPlanNow } from "./switched";
import { PLANS, computeBill } from "./plans";

assert.deepEqual(parseSwitchedTo("OVO Energy — The One Plan - OCT2026"), { retailer: "OVO Energy", plan: "The One Plan - OCT2026" });
assert.equal(parseSwitchedTo(""), null);
assert.equal(parseSwitchedTo("No separator"), null);
// The plan they moved to, priced today for their usage.
const row = PLANS.find((p) => p[3] === "MARKET" && p[5] !== null && p[1] === "Powercor")!;
const u = { days: 91, peak: 0, shoulder: 0, offpeak: 0, anytime: 1000, cl: 0, solarExportKwh: 0 };
const now = switchedPlanNow(`${row[0]} — ${row[2]}`, "Powercor", u)!;
assert.equal(now.total, computeBill(row, u));
assert.equal(now.rates.anytime, row[5]);
assert.equal(switchedPlanNow(`${row[0]} — A plan that no longer exists`, "Powercor", u), null);
console.log("switched ok");

// Run: npx tsx lib/plans.test.ts
import assert from "node:assert/strict";
import { billDetail, fmtRateCents, namedForControlledLoad, type PlanRow } from "./plans";

// Plans named for a controlled-load tariff need that meter; "without" ones don't.
assert.equal(namedForControlledLoad("1st Home, Residential - Anytime with Controlled Load"), true);
assert.equal(namedForControlledLoad("HomeDeal Next - Single Rate + CL"), true);
assert.equal(namedForControlledLoad("Anytime Switched On! Controlled Load"), true);
assert.equal(namedForControlledLoad("GloBird GLOHOME Residential (Flat Rate Without Controlled Load)-Powercor"), false);
assert.equal(namedForControlledLoad("Sumo Sunrise Plus"), false);
const cl: PlanRow = ["X", "Powercor", "Saver with Controlled Load", "MARKET", 1, 0.25, null, null, null, 0.15, 0.01];
const u = (c: number) => ({ days: 91, peak: 0, shoulder: 0, offpeak: 0, anytime: 1000, cl: c, solarExportKwh: 0 });
assert.equal(billDetail(cl, u(0)), null); // a home without the meter can't get it
assert.notEqual(billDetail(cl, u(200)), null);

// Tiny rates show as printed, not rounded to nothing.
assert.equal(fmtRateCents(0.0004), "0.04c/kWh");
assert.equal(fmtRateCents(0.3102), "31.0c/kWh");
console.log("plans ok");

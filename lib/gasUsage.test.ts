// Run: npx tsx lib/gasUsage.test.ts
import assert from "node:assert/strict";
import { annualFromGasBill, estimateGasAnnual, gasByMonth, heatingShareFor, periodMonths, periodShareOfYear } from "./gasUsage";

// A family with ducted heating lands in the typical Victorian range (40-55 GJ); no heating sits low.
const heated = estimateGasAnnual({ heating: "ducted", hotWater: true, cooking: true, people: 4 });
assert.ok(heated.total > 40000 && heated.total < 55000, String(heated.total));
const unheated = estimateGasAnnual({ heating: "none", hotWater: true, cooking: true, people: 2 });
assert.ok(unheated.total > 10000 && unheated.total < 20000, String(unheated.total));
assert.equal(estimateGasAnnual({ heating: "none", hotWater: false, cooking: false, people: 2 }).total, 0);

// Months add back up to the year, and winter beats summer for a heated home.
const m = gasByMonth(heated);
const total = m.heating.reduce((a, b) => a + b, 0) + m.other.reduce((a, b) => a + b, 0);
assert.ok(Math.abs(total - heated.total) < 1, String(total));
assert.ok(m.heating[6] + m.other[6] > 3 * (m.heating[0] + m.other[0]));

// A quarter's share of the year: a winter quarter is well over a quarter of a heated home's gas; a summer one well under.
const winter = periodShareOfYear(92, "2026-08-31", 0.65);
const summer = periodShareOfYear(90, "2026-02-28", 0.65);
assert.ok(winter > 0.4 && winter < 0.6, String(winter));
assert.ok(summer > 0.05 && summer < 0.15, String(summer));
// No date: a flat share.
assert.ok(Math.abs(periodShareOfYear(91, null, 0.65) - 91 / 365) < 1e-9);

// So a 20,000 MJ winter bill is a ~40 GJ year, not 80.
const annual = annualFromGasBill(20000, 92, "2026-08-31", 0.65);
assert.ok(annual > 33000 && annual < 50000, String(annual));
assert.equal(Math.round(annualFromGasBill(5000, 91, null, 0.5)), Math.round((5000 / 91) * 365));

// Heating share from usage alone.
assert.equal(heatingShareFor(null, 120), 0.65);
assert.equal(heatingShareFor(null, 20), 0.1);
assert.ok(heatingShareFor({ heating: "ducted", hotWater: true, cooking: true, people: 3 }, null) > 0.6);

// The months a bill touches.
assert.deepEqual(periodMonths(31, "2026-07-31").sort(), [6]);
assert.deepEqual(periodMonths(92, "2026-08-31").sort((a, b) => a - b), [5, 6, 7]);
assert.deepEqual(periodMonths(30, null), []);
console.log("gas usage ok");

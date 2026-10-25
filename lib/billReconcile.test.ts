// Run: npx tsx lib/billReconcile.test.ts
// A bill total must match the usage it's compared on.
import assert from "node:assert/strict";
import { billAtUsage, kwhFromBill, reconcileBill } from "./billReconcile";

const tango = { supply: 1.2815, anytime: 0.33, peak: null, shoulder: null, offpeak: null, cl: null, solarFit: 0.0004 };
const u = (anytime: number, days = 34, solar = 0) => ({ days, peak: 0, shoulder: 0, offpeak: 0, anytime, cl: 0, solarExportKwh: solar });

// Phil's dashboard: 1,149 kWh on file, but a $95.63 bill at Tango's rates is only ~158 kWh.
const bad = reconcileBill({ billTotal: 95.63, rates: tango, usage: u(1149), distributor: "Powercor" });
assert.ok(bad.mismatch, "flags the mismatch");
assert.equal(bad.basis, "rates"); // compares like for like: Tango's rates on the same usage
assert.ok(Math.abs((bad.you as number) - (1.2815 * 34 + 0.33 * 1149)) < 0.5);
assert.ok(Math.abs((bad.mismatch!.impliedKwh as number) - 158) <= 2, `implied ${bad.mismatch!.impliedKwh}`);

// The same bill with the right usage agrees: the bill total is used as is.
const ok = reconcileBill({ billTotal: 95.63, rates: tango, usage: u(158), distributor: "Powercor" });
assert.deepEqual([ok.basis, ok.mismatch, ok.you], ["bill", null, 95.63]);
// A concession (17.5% off) is normal, not a mismatch.
assert.equal(reconcileBill({ billTotal: 95.63 * 0.825, rates: tango, usage: u(158), distributor: "Powercor" }).mismatch, null);

// No rates: checked against the default offer; far out means don't trust the bill for this usage.
const noRates = reconcileBill({ billTotal: 95.63, rates: null, usage: u(1149), distributor: "Powercor" });
assert.ok(noRates.mismatch && noRates.you === null && noRates.mismatch.basis === "default");
assert.equal(reconcileBill({ billTotal: 95.63, rates: null, usage: u(170), distributor: "Powercor" }).basis, "bill");

// Rates only: priced from them. Nothing at all: no figure.
assert.equal(reconcileBill({ billTotal: null, rates: tango, usage: u(158), distributor: "Powercor" }).basis, "rates");
assert.deepEqual(reconcileBill({ billTotal: null, rates: null, usage: u(158), distributor: "Powercor" }), { you: null, basis: null, mismatch: null });

// kWh from a bill: own rates (solar credit added back), else the default offer's.
assert.equal(kwhFromBill({ billTotal: 95.63, days: 34, distributor: "Powercor", rates: tango, usage: u(0, 34, 163) }), Math.round((95.63 - 1.2815 * 34 + 0.0004 * 163) / 0.33));
assert.equal(kwhFromBill({ billTotal: 96, days: 34, distributor: "Powercor" }), Math.round((96 - 1.381 * 34) / 0.282));
assert.equal(kwhFromBill({ billTotal: 20, days: 34, distributor: "Powercor" }), null);
// A $400 winter quarter (1,100 kWh) moved onto the year's average for 91 days (800 kWh) at the same price per kWh.
const moved = billAtUsage({ billTotal: 400, billKwh: 1100, usageKwh: 800, days: 91, supplyPerDay: 1.2 });
assert.equal(moved, Math.round((1.2 * 91 + (400 - 1.2 * 91) * (800 / 1100)) * 100) / 100);
assert.equal(billAtUsage({ billTotal: 400, billKwh: 0, usageKwh: 800, days: 91, supplyPerDay: 1.2 }), 400);
// Calibrated from the dollars at the default offer's rates, the moved bill is the default offer for that usage.
const kwh = (300 - 1.381 * 91) / 0.282;
assert.ok(Math.abs(billAtUsage({ billTotal: 300, billKwh: kwh, usageKwh: 500, days: 91, supplyPerDay: 1.381 }) - (1.381 * 91 + 0.282 * 500)) < 0.01);
console.log("bill reconcile ok");

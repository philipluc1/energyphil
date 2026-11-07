// Run: npx tsx lib/billExtraction.test.ts
// What a bill read is missing, and when to ask for the next page.
import assert from "node:assert/strict";
import { billGaps, listWords, sanitizeExtractedBill, shouldAskForAnotherPage } from "./billExtraction";

// Page 1 of a paper bill: amount due, address, network, but no usage or period.
const page1 = sanitizeExtractedBill({
  is_electricity_bill: true, fuel: "electricity", retailer_name: "Origin Energy", distributor: "Powercor",
  current_bill_total: 152.4, postcode: "3025", looks_partial: true, warnings: [],
});
assert.equal(page1.looksPartial, true);
assert.deepEqual(billGaps(page1).map((g) => g.key), ["usage", "days", "rates"]);
assert.equal(shouldAskForAnotherPage(page1), true);

// Both pages: usage, period and rates found.
const both = sanitizeExtractedBill({
  is_electricity_bill: true, fuel: "electricity", distributor: "Powercor", billing_days: 30, usage_mode: "simple",
  anytime_kwh: 420, current_bill_total: 152.4, supply_charge_cents_per_day: 138, anytime_rate_cents: 35.1, looks_partial: false, warnings: [],
});
assert.deepEqual(billGaps(both), []);
assert.equal(shouldAskForAnotherPage(both), false);

// Usage and period found, no rates, not a partial page: don't nag.
const noRates = sanitizeExtractedBill({ is_electricity_bill: true, distributor: "Jemena", billing_days: 91, usage_mode: "simple", anytime_kwh: 1100, current_bill_total: 380, warnings: [] });
assert.equal(shouldAskForAnotherPage(noRates), false);
// …but if it looks like a summary page, ask (the rates are probably overleaf).
assert.equal(shouldAskForAnotherPage({ ...noRates, looksPartial: true }), true);

// Time-of-use usage counts as usage.
const tou = sanitizeExtractedBill({ is_electricity_bill: true, distributor: "Citipower", billing_days: 30, usage_mode: "detailed", peak_kwh: 150, offpeak_kwh: 200, warnings: [] });
assert.equal(billGaps(tou).some((g) => g.key === "usage"), false);

// Gas-only bills are handled elsewhere.
// 7 Nov 2026: a gas front page (amount due, no MJ) asks for page 2; a full gas read doesn't.
assert.deepEqual(billGaps(sanitizeExtractedBill({ is_electricity_bill: false, fuel: "gas", warnings: [] })).filter((g) => g.needed).map((g) => g.key), ["usage", "days"]);
assert.ok(shouldAskForAnotherPage(sanitizeExtractedBill({ is_electricity_bill: false, fuel: "gas", gas_bill_total: 41.52, warnings: [] })));
assert.ok(!shouldAskForAnotherPage(sanitizeExtractedBill({ is_electricity_bill: false, fuel: "gas", gas_bill_total: 41.52, gas_mj: 857, gas_billing_days: 28, gas_distributor: "AusNet Services", gas_supply_cents_per_day: 117.7, gas_usage_cents_per_mj: 3.98, warnings: [] })));

assert.equal(listWords(["a"]), "a");
assert.equal(listWords(["a", "b", "c"]), "a, b and c");
console.log("bill gaps ok");

import { test } from "node:test";
import { periodCharges, sanitizeExtractedBill as readBill } from "./billExtraction";
test("an overdue balance carried forward isn't this bill's cost (Tango bill, 2 Nov 2026)", () => {
  // Amount due $310.34 = $214.71 overdue + $95.63 new charges.
  assert.deepEqual(periodCharges(310.34, 95.63, 214.71), { currentBill: 95.63, amountDue: 310.34 });
  // No new-charges line: take the overdue amount off.
  assert.deepEqual(periodCharges(310.34, null, 214.71), { currentBill: 95.63, amountDue: 310.34 });
  // An ordinary bill: nothing to explain.
  assert.deepEqual(periodCharges(95.63, 95.63, null), { currentBill: 95.63, amountDue: null });
  assert.deepEqual(periodCharges(412.1, null, null), { currentBill: 412.1, amountDue: null });
});

test("a feed-in printed as a credit still counts", () => {
  const b = readBill({ is_electricity_bill: true, current_bill_total: 310.34, new_charges_total: 95.63, solar_fit_cents: -0.04, supply_charge_cents_per_day: 128, anytime_rate_cents: 31.702 });
  assert.equal(b.currentBill, 95.63);
  assert.equal(b.amountDue, 310.34);
  assert.equal(b.currentRates?.solarFit, 0.0004);
});

import { checkFit, normaliseRates } from "./billExtraction";
test("a lone 'peak' price is a single rate", () => {
  const r = normaliseRates({ supply: 1.2815, anytime: null, peak: 0.31702, shoulder: null, offpeak: null, cl: null, solarFit: 0.0004 });
  assert.equal(r.anytime, 0.31702);
  assert.equal(r.peak, null);
  const tou = { supply: 1.2, anytime: null, peak: 0.4, shoulder: null, offpeak: 0.2, cl: null, solarFit: null };
  assert.deepEqual(normaliseRates(tou), tou);
});

test("the feed-in rate follows the credit actually paid", () => {
  const r = { supply: 1.28, anytime: 0.317, peak: null, shoulder: null, offpeak: null, cl: null, solarFit: 0.04 }; // read as 4c
  assert.equal(checkFit(r, 163.46, 0.07)!.solarFit, 0.000428); // 7c / 163 kWh ≈ 0.04c
  const ok = { ...r, solarFit: 0.0004 };
  assert.equal(checkFit(ok, 163.46, 0.07)!.solarFit, 0.0004); // close enough: keep the printed rate
  assert.equal(checkFit(r, null, 0.07)!.solarFit, 0.04); // nothing to check against
});

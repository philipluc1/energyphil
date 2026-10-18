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
assert.deepEqual(billGaps(sanitizeExtractedBill({ is_electricity_bill: false, fuel: "gas", warnings: [] })), []);

assert.equal(listWords(["a"]), "a");
assert.equal(listWords(["a", "b", "c"]), "a, b and c");
console.log("bill gaps ok");

// Run: npx tsx --conditions=react-server lib/membership.test.ts
// A database missing a newer column must not cost the member their free check.
import assert from "node:assert/strict";
import { missingColumn } from "./membership";

assert.equal(missingColumn("Could not find the 'source' column of 'subscribers' in the schema cache"), "source");
assert.equal(missingColumn('column "alert_min_saving" of relation "subscribers" does not exist'), "alert_min_saving");
assert.equal(missingColumn("duplicate key value violates unique constraint"), null);
console.log("membership ok");

// A saved check updates the member's record: plausible values only, blanks never wipe.
import { memberFieldsFromCheck } from "./membership";
const f = memberFieldsFromCheck({
  distributor: "Powercor", billingDays: 34, usageMode: "simple", peak: 0, shoulder: 0, offpeak: 0, anytime: 164.42, cl: 0,
  referenceTotal: 95.63, currentRetailer: "Tango Energy", currentPlanName: "", currentRates: { supply: 1.2815, anytime: 0.31702, solarFit: 0.0004 },
  hasSolar: true, solarExportKwh: 163.46, address: "", postcode: "3027", priceType: "variable", discountEndsAt: "not a date",
});
assert.equal(f.distributor, "Powercor");
assert.equal(f.anytime_kwh, 164.42);
assert.equal(f.billing_days, 34);
assert.equal(f.current_retailer, "Tango Energy");
assert.equal("current_plan_name" in f, false); // blank: keep what's on file
assert.equal("address" in f, false);
assert.equal(f.postcode, "3027");
assert.equal((f.current_rates as Record<string, number | null>).supply, 1.2815);
assert.equal("discount_ends_at" in f, false);
assert.equal(memberFieldsFromCheck({ distributor: "Nowhere", billingDays: 9999, anytime: -5 }).distributor, undefined);
assert.deepEqual(memberFieldsFromCheck(null), {});
console.log("member details from a check ok");

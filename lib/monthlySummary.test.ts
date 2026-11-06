import { test } from "node:test";
import assert from "node:assert/strict";
import { summaryFacts } from "./monthlySummary";
import { computeBest } from "./priceWatch";
import { monthlyCheck } from "./emailTemplates";
import { DEFAULT_PROFILE } from "./profileUsage";

const usage = { days: 91, peak: 0, shoulder: 0, offpeak: 0, anytime: 1010, cl: 0, solarExportKwh: 0 };
const best = computeBest({ distributor: "Powercor", billingDays: 91, peak: 0, shoulder: 0, offpeak: 0, anytime: 1010, cl: 0 })!;
const base = {
  network: "Powercor" as const,
  usage,
  reference: 412,
  vsBill: true,
  rates: null,
  profile: { ...DEFAULT_PROFILE, people: 3, heating: "reverse_cycle" as const },
  ev: false,
  best: { retailer: best.bestRetailer, planName: best.bestPlanName, total: best.bestTotal },
  discountEndsAt: "2026-12-10",
  fixedUntil: null,
  now: new Date("2026-11-01T21:00:00Z"),
};

test("facts: next bill, ending within 90 days, midday, credit, homes like yours, a tip", () => {
  const f = summaryFacts(base);
  assert.ok(f.nextBill && f.nextBill.now > 0 && f.nextBill.days === 91);
  assert.ok(f.nextBill!.best <= f.nextBill!.now);
  assert.deepEqual(f.ending && { what: f.ending.what, days: f.ending.days }, { what: "discount", days: 39 });
  assert.ok(f.midday && f.midday.choresYear < f.midday.asIsYear);
  assert.ok(f.like && Math.abs(f.like.you - 1010 / 91) < 1e-9);
  assert.ok(f.tip.title.length > 0);
});

test("no bill: no year ahead or homes like yours; far-off dates are left out", () => {
  const f = summaryFacts({ ...base, vsBill: false, discountEndsAt: "2027-06-01" });
  assert.equal(f.nextBill, null);
  assert.equal(f.like, null);
  assert.equal(f.ending, null);
});

test("the monthly email: one short message, both fuels, at most three glance rows (6 Nov 2026)", () => {
  const f = summaryFacts(base);
  const common = { origin: "https://example.test", monthName: "November", isJuly: false, retailer: best.bestRetailer, planName: best.bestPlanName, yearly: 300, unsubscribeUrl: "https://example.test/u" };
  const rich = monthlyCheck({ ...common, activity: "8 new offers and 12 price changes", activityCount: 20, facts: f, gas: { retailer: "Alinta Energy", planName: "Gas Saver", yearly: -40 } });
  assert.match(rich.html, /At a glance/);
  assert.match(rich.html, /ends 10 December/);
  assert.match(rich.html, /Electricity/);
  assert.match(rich.html, /Gas/);
  assert.match(rich.html, /We recommend staying on your gas plan/);
  assert.doesNotMatch(rich.html, /Tip:/);
  const both = monthlyCheck({ ...common, gas: { retailer: "Alinta Energy", planName: "Gas Saver", yearly: 120 } });
  assert.match(both.html, /Together: about <strong[^>]*>\$420 a year/);
  const plain = monthlyCheck(common);
  assert.doesNotMatch(plain.html, /At a glance/);
  assert.doesNotMatch(plain.html, /Gas/);
});

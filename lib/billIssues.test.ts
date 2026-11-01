import { test } from "node:test";
import assert from "node:assert/strict";
import { billIssues, chargesFromRates, dearestOnSale, issueSummary, type IssueInput } from "./billIssues";
import type { PlanRow } from "./plans";

const rates = { supply: 1.1, anytime: 0.3, peak: null, shoulder: null, offpeak: null, cl: null, solarFit: 0.05 };
const money = { rates, days: 91, anytime: 1000, peak: 0, shoulder: 0, offpeak: 0, cl: 0, solarExportKwh: 200, distributor: "Powercor", total: null as number | null };
const base: IssueInput = {
  retailer: "Tango Energy", readingType: "actual", concession: false, behind: false, paymentPlan: false, bestOffer: null,
  fees: [], discountLost: false, billPlanName: "eSelect", olderVersion: null, planIsCurrent: true, retailerBest: null,
  retailerCount: 26, worthPerYear: 50, money: null,
};
const plans: PlanRow[] = [
  ["A", "Powercor", "One", "MARKET", 1.0, 0.28, null, null, null, null, 0.04],
  ["B", "Powercor", "VDO", "STANDING", 1.3, 0.34, null, null, null, null, 0.04],
  ["C", "Jemena", "Far", "MARKET", 2.0, 0.6, null, null, null, null, 0.04],
];

test("charges from the bill's own rates", () => {
  // 1000 kWh × 30c + 91 days × $1.10 − 200 kWh × 5c = 300 + 100.10 − 10
  assert.equal(Math.round(chargesFromRates(money)! * 100) / 100, 390.1);
  assert.equal(chargesFromRates({ ...money, cl: 50 }), null); // controlled load with no rate: no guess
});

test("a clean bill: nothing flagged, the fine items fold", () => {
  const list = billIssues(base);
  assert.deepEqual(issueSummary(list), { flagged: 0, text: "Nothing looks off" });
  assert.deepEqual(list.map((i) => i.id), ["concession", "current", "read"]);
});

test("same retailer, cheaper tariff type", () => {
  const list = billIssues({ ...base, planIsCurrent: false, retailerBest: { planName: "Time of Use Saver", savingPerYear: 120, tariff: "tou" }, money: { ...money } });
  const t = list.find((i) => i.id === "tariff")!;
  assert.equal(t.level, "act");
  assert.match(t.title, /time-of-use plan suits/);
  assert.equal(list[0].id, "tariff");
});

test("rates dearer than anything on sale on the network", () => {
  const list = billIssues({ ...base, money: { ...money, rates: { ...rates, anytime: 0.4 } }, plans });
  const d = list.find((i) => i.id === "dearer")!;
  assert.equal(d.level, "act");
  assert.match(d.body, /40c a kWh \(the dearest on sale is 34c\)/);
  assert.equal(billIssues({ ...base, money, plans }).some((i) => i.id === "dearer"), false);
  assert.deepEqual(dearestOnSale(plans, "Powercor"), { supply: 1.3, anytime: 0.34, peak: null });
});

test("fees and unexplained charges", () => {
  const withFees = billIssues({ ...base, fees: [{ kind: "late_payment", amount: 12 }, { kind: "paper_bill", amount: 2.5 }], money: { ...money, total: 404.6 } });
  const f = withFees.find((i) => i.id === "fees")!;
  assert.match(f.title, /\$14\.50/);
  assert.match(f.body, /direct debit/);
  // 390.10 + 14.50 fees = 404.60: nothing unexplained.
  assert.equal(withFees.some((i) => i.id === "unexplained"), false);
  const odd = billIssues({ ...base, money: { ...money, total: 460 } });
  assert.match(odd.find((i) => i.id === "unexplained")!.title, /About \$70/);
  // Without this period's new charges, no guess.
  assert.equal(billIssues({ ...base, money }).some((i) => i.id === "unexplained"), false);
});

test("money worries lead, and the retailer's message is checked", () => {
  const list = billIssues({ ...base, behind: true, bestOffer: { planName: null, savingPerYear: null, saysOnBest: true }, retailerBest: { planName: "Saver", savingPerYear: 80 }, planIsCurrent: false });
  assert.equal(list[0].id, "behind");
  assert.equal(list.find((i) => i.id === "bestoffer")!.level, "look");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { billLesson, lessonFromBill } from "./billLesson";

const base = { fuel: "electricity" as const, days: 91, usage: 1000, supplyPerDay: 1.19, total: 400, estimated: false, fees: [], discountLost: false };

test("an estimated read comes first", () => {
  const l = billLesson({ ...base, estimated: true, fees: [{ kind: "late_payment", amount: 12 }] })!;
  assert.equal(l.key, "estimated");
  assert.match(l.text, /estimated meter read/);
});

test("the biggest fee, in dollars", () => {
  const l = billLesson({ ...base, fees: [{ kind: "paper_bill", amount: 2.2 }, { kind: "late_payment", amount: 12.5 }] })!;
  assert.equal(l.key, "fee");
  assert.match(l.text, /^The \$12\.50 late fee/);
});

test("supply charge when it's a big slice of the bill", () => {
  const l = billLesson({ ...base, total: 300 })!; // 1.19 x 91 = 108, 36%
  assert.equal(l.key, "supply");
  assert.match(l.text, /\$1\.19 a day: about \$434 a year/);
});

test("high usage against the standard home", () => {
  const l = billLesson({ ...base, usage: 1500, total: 600 })!; // 16.5 kWh a day, supply 18%
  assert.equal(l.key, "usage-high");
  assert.match(l.text, /16\.5 kWh a day/);
  assert.match(l.text, /about 11/);
});

test("gas supply in cents", () => {
  const l = billLesson({ fuel: "gas", days: 61, usage: 6000, supplyPerDay: 0.85, total: 150, estimated: false, fees: [], discountLost: false })!;
  assert.equal(l.key, "supply");
  assert.match(l.text, /85c a day: about \$310 a year/);
});

test("nothing to say", () => {
  assert.equal(billLesson({ ...base, supplyPerDay: null, usage: 1000 }), null);
});

test("from a bill read: dual bill keeps the electricity read type off gas", () => {
  const b = { fuel: "dual", billingDays: 91, anytimeKwh: 1000, currentBill: 300, currentRates: { supply: 1.19 }, readingType: "estimated", fees: [], gasBillingDays: 61, gasMj: 6000, gasSupplyCentsPerDay: 85, gasBillTotal: 150 };
  assert.equal(lessonFromBill(b, "electricity")!.key, "estimated");
  assert.equal(lessonFromBill(b, "gas")!.key, "supply");
});

test("skip what the email already says", () => {
  const b = { fuel: "electricity", billingDays: 91, anytimeKwh: 1000, currentBill: 300, currentRates: { supply: 1.19 }, readingType: "estimated", fees: [{ kind: "late_payment", amount: 12 }] };
  assert.equal(lessonFromBill(b, "electricity", ["estimated", "fee", "discount"])!.key, "supply");
});

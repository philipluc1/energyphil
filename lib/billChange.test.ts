import { test } from "node:test";
import assert from "node:assert/strict";
import { billChange, latestPair } from "./billChange";

test("more days and more use: both named, biggest first", () => {
  const c = billChange({ periodEnd: "2026-06-30", days: 82, amount: 300, usage: 900 }, { periodEnd: "2026-09-30", days: 92, amount: 400, usage: 1200 })!;
  assert.equal(c.headline, "$100 more than your last bill");
  assert.equal(c.main, "usage");
  assert.deepEqual(c.reasons.slice(0, 2), ["19% more power a day", "10 more days"]);
});

test("same usage, dearer prices", () => {
  const c = billChange({ periodEnd: "2026-06-30", days: 91, amount: 300, usage: 1000 }, { periodEnd: "2026-09-30", days: 91, amount: 336, usage: 1000 }, "power")!;
  assert.equal(c.main, "price");
  assert.deepEqual(c.reasons, ["each kWh cost 12% more, counting supply"]);
});

test("gas, smaller bill", () => {
  const c = billChange({ periodEnd: "2026-08-31", days: 90, amount: 500, usage: 9000 }, { periodEnd: "2026-11-30", days: 91, amount: 250, usage: 4000 }, "gas")!;
  assert.match(c.headline, /\$250 less/);
  assert.equal(c.main, "usage");
  assert.match(c.reasons[0], /less gas a day/);
});

test("tiny change, and missing figures", () => {
  assert.equal(billChange({ periodEnd: "a", days: 91, amount: 300, usage: 1000 }, { periodEnd: "b", days: 91, amount: 302, usage: 1000 })!.headline, "About the same as your last bill");
  assert.equal(billChange({ periodEnd: "a", days: 91, amount: 300, usage: 0 }, { periodEnd: "b", days: 91, amount: 302, usage: 1000 }), null);
});

test("latest pair skips bills without figures", () => {
  const bills = [
    { period_end: "2026-03-31", billing_days: 90, amount: 280, kwh: 900 },
    { period_end: "2026-09-30", billing_days: 92, amount: null, kwh: 1100 },
    { period_end: "2026-06-30", billing_days: 91, amount: 320, kwh: 1000 },
  ];
  const p = latestPair(bills, (b) => b.kwh)!;
  assert.deepEqual(p.map((x) => x.periodEnd), ["2026-03-31", "2026-06-30"]);
});

import { explainBill } from "./billChange";
const det = (o: Partial<{ supply: number | null; estimated: boolean; tariff: string | null; concession: number; rebate: number; otherCredits: number; fees: number }> = {}) => ({ supply: null, estimated: false, tariff: null, concession: 0, rebate: 0, otherCredits: 0, fees: 0, ...o });

test("explain: the steps add up to the change", () => {
  const e = explainBill(
    { periodEnd: "2026-06-30", days: 91, amount: 300, usage: 1000, detail: det({ supply: 1.1 }) },
    { periodEnd: "2026-09-30", days: 92, amount: 345, usage: 1150, detail: det({ supply: 1.19 }) },
  )!;
  assert.equal(e.headline, "$45 more than your last bill");
  const all = e.steps.reduce((a, x) => a + x.dollars, 0);
  // Small steps (under $3) are left out, so allow a few dollars.
  assert.ok(Math.abs(all - 45) < 3, `steps sum ${all}`);
  assert.equal(e.steps[0].key, "usage");
  assert.match(e.sentence, /^\$\d+ from using more power/);
  assert.ok(e.notes.some((n) => /\$1\.10 to \$1\.19 a day/.test(n)));
});

test("explain: concession dropped off and a fee", () => {
  const e = explainBill(
    { periodEnd: "2026-06-30", days: 91, amount: 280, usage: 1000, detail: det({ concession: 60 }) },
    { periodEnd: "2026-09-30", days: 91, amount: 352, usage: 1000, detail: det({ fees: 12 }) },
  )!;
  const k = Object.fromEntries(e.steps.map((x) => [x.key, Math.round(x.dollars)]));
  assert.equal(k.concession, 60);
  assert.equal(k.fees, 12);
  assert.equal(k.price, undefined);
  assert.match(e.sentence, /the concession isn't on it/);
});

test("explain: estimated read and a rebate that's gone", () => {
  const e = explainBill(
    { periodEnd: "2026-06-30", days: 91, amount: 300, usage: 1000, detail: det({ rebate: 75 }) },
    { periodEnd: "2026-09-30", days: 91, amount: 310, usage: 1030, detail: det({ estimated: true }) },
  )!;
  assert.match(e.notes[0], /estimated meter read/);
  assert.match(e.notes[1], /\$75 in government rebates/);
});

test("explain: works without detail (typed bills), gas", () => {
  const e = explainBill({ periodEnd: "2026-06-30", days: 61, amount: 400, usage: 9000 }, { periodEnd: "2026-08-31", days: 62, amount: 300, usage: 6000 }, "gas")!;
  assert.match(e.headline, /\$100 less/);
  assert.equal(e.steps[0].key, "usage");
  assert.match(e.sentence, /using less gas/);
});

test("explain: about the same, offsetting", () => {
  const e = explainBill({ periodEnd: "a", days: 91, amount: 300, usage: 1000 }, { periodEnd: "b", days: 91, amount: 302, usage: 900 })!;
  assert.equal(e.headline, "About the same as your last bill");
  assert.match(e.sentence, /roughly cancel out/);
});

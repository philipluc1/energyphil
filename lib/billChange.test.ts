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

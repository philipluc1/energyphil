import { test } from "node:test";
import assert from "node:assert/strict";
import { standardVsVdo, VDO_FLAT, VDO_TOU } from "./vdoCompare";
import { VDO, type PlanRow } from "./plans";

test("flat rates match the ones the site already uses", () => {
  for (const n of Object.keys(VDO) as (keyof typeof VDO)[]) {
    assert.ok(Math.abs(VDO[n].supply - VDO_FLAT[n].supply) < 0.001, n);
    assert.ok(Math.abs(VDO[n].usage - VDO_FLAT[n].usage) < 0.001, n);
  }
});

test("single-rate plan vs flat default offer at 4,000 kWh", () => {
  // A plan priced exactly at the Powercor default offer is 0%.
  const plan = ["Test", "Powercor", "Same as VDO", "MARKET", 1.3805, 0.2822, null, null, null, null, null] as unknown as PlanRow;
  const r = standardVsVdo(plan)!;
  assert.ok(Math.abs(r.pct) < 0.0001);
  assert.equal(r.tou, false);
});

test("time-of-use plan vs time-of-use default offer at 70/30", () => {
  const t = VDO_TOU["Powercor"];
  const plan = ["Test", "Powercor", "TOU at VDO", "MARKET", t.supply, null, t.peak, null, t.offpeak, null, null] as unknown as PlanRow;
  const r = standardVsVdo(plan)!;
  assert.ok(Math.abs(r.pct) < 0.0001);
  assert.equal(r.tou, true);
  // 10% cheaper rates all round → 10% below.
  const cheaper = ["Test", "Powercor", "TOU -10%", "MARKET", t.supply * 0.9, null, t.peak * 0.9, null, t.offpeak * 0.9, null, null] as unknown as PlanRow;
  assert.ok(Math.abs(standardVsVdo(cheaper)!.pct + 0.1) < 0.0001);
});

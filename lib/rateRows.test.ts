import { test } from "node:test";
import assert from "node:assert/strict";
import { rateRows } from "./rateRows";
import type { PlanRow } from "./plans";

const tangoEasy: PlanRow = ["Tango Energy", "Powercor", "Everyday Easy", "MARKET", 0.7876, 0.2453, null, null, null, 0.1485, 0.0004];
const touPlan: PlanRow = ["X", "Powercor", "TOU", "MARKET", 1.0, null, 0.42, null, 0.2, null, 0.03];
const billPeakOnly = { supply: 1.2815, anytime: null, peak: 0.31702, shoulder: null, offpeak: null, cl: null, solarFit: 0.0004 };

test("one price all day: supply, one usage row, feed-in; no empty peak/off-peak or controlled load", () => {
  const rows = rateRows(billPeakOnly, tangoEasy, { solar: true });
  assert.deepEqual(rows.map((r) => r.key), ["supply", "anytime", "solarFit"]);
  assert.equal(rows[1].you, 0.31702);
  assert.equal(rows[1].plan, 0.2453);
});

test("time of use: peak and off-peak rows", () => {
  const tou = { supply: 1.1, anytime: null, peak: 0.45, shoulder: null, offpeak: 0.22, cl: null, solarFit: null };
  assert.deepEqual(rateRows(tou, touPlan).map((r) => r.key), ["supply", "peak", "offpeak"]);
  // Single-rate bill against a time-of-use plan: both shown, each side where it applies.
  const mixed = rateRows(billPeakOnly, touPlan);
  assert.deepEqual(mixed.map((r) => [r.key, r.you, r.plan]), [["supply", 1.2815, 1.0], ["anytime", 0.31702, null], ["peak", null, 0.42], ["offpeak", null, 0.2], ["solarFit", 0.0004, 0.03]]);
});

test("controlled load only when the home has it", () => {
  assert.ok(rateRows(billPeakOnly, tangoEasy, { cl: true }).some((r) => r.key === "cl"));
  assert.ok(!rateRows(billPeakOnly, tangoEasy).some((r) => r.key === "cl"));
});

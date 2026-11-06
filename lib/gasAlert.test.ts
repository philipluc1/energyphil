import { test } from "node:test";
import assert from "node:assert/strict";
import { gasAlertDecision } from "./priceWatch";

// Meiling, 7 Nov 2026: bill $42 for 28 days (~$547/yr), stale pick $65 (~$848/yr), today's cheapest $45 (~$587/yr).
test("a member whose own bill beats today's cheapest is not emailed", () => {
  assert.equal(gasAlertDecision({ top: 45, pickToday: null, lastPickTotal: 65, billTotal: 42, days: 28 }), "repick");
});
test("a stale pick over a third dearer is re-set quietly, never emailed", () => {
  assert.equal(gasAlertDecision({ top: 40, pickToday: null, lastPickTotal: 70, billTotal: null, days: 28 }), "repick");
});
test("emails when it beats both the last pick and the bill by $50 a year", () => {
  assert.equal(gasAlertDecision({ top: 40, pickToday: 46, lastPickTotal: 46, billTotal: 50, days: 28 }), "email");
});
test("no email when it beats the bill but not our last pick (nothing new)", () => {
  assert.equal(gasAlertDecision({ top: 40, pickToday: 41, lastPickTotal: 41, billTotal: 60, days: 28 }), "skip");
});
test("no bill on file: the last pick is the yardstick", () => {
  assert.equal(gasAlertDecision({ top: 40, pickToday: 46, lastPickTotal: 46, billTotal: null, days: 28 }), "email");
});

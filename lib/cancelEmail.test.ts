import { test } from "node:test";
import assert from "node:assert/strict";
import { decideCancelEmail, endsOnLabel } from "./cancelEmail";

test("cancel at period end: one email per end date", () => {
  const d = decideCancelEmail({ status: "active", cancelAt: "2026-11-16T03:00:00Z", sentFor: null, otherActive: false });
  assert.deepEqual(d, { send: "scheduled", key: "s:2026-11-16", reset: false });
  assert.equal(decideCancelEmail({ status: "active", cancelAt: "2026-11-16T03:00:00Z", sentFor: "s:2026-11-16", otherActive: false }).send, null);
});

test("took it back, then the period runs out after a scheduled email", () => {
  assert.equal(decideCancelEmail({ status: "active", cancelAt: null, sentFor: "s:2026-11-16", otherActive: false }).reset, true);
  assert.equal(decideCancelEmail({ status: "canceled", cancelAt: null, sentFor: "s:2026-11-16", otherActive: false }).send, null);
});

test("cancelled straight away, and refunded duplicates", () => {
  assert.equal(decideCancelEmail({ status: "canceled", cancelAt: null, sentFor: null, otherActive: false }).send, "ended");
  assert.equal(decideCancelEmail({ status: "canceled", cancelAt: null, sentFor: null, otherActive: true }).send, null);
  assert.equal(decideCancelEmail({ status: "past_due", cancelAt: null, sentFor: null, otherActive: false }).send, null);
});

test("date label in Melbourne", () => {
  assert.equal(endsOnLabel("2026-11-15T14:00:00Z"), "16 November 2026");
});

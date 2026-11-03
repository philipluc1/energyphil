import { test } from "node:test";
import assert from "node:assert/strict";
import { retentionDue } from "./memberRetention";

const now = new Date("2027-12-01T00:00:00Z");

test("deleted a year after the membership ends", () => {
  assert.equal(retentionDue({ status: "canceled", canceled_at: "2026-11-01T00:00:00Z", current_period_end: "2026-11-20T00:00:00Z" }, { days: 365, otherLive: false, now }), true);
  // Ended less than a year ago (paid period ran on).
  assert.equal(retentionDue({ status: "canceled", canceled_at: "2026-11-01T00:00:00Z", current_period_end: "2027-02-01T00:00:00Z" }, { days: 365, otherLive: false, now }), false);
});

test("never for live members, another live membership, or no end date", () => {
  assert.equal(retentionDue({ status: "active", current_period_end: "2025-01-01T00:00:00Z" }, { days: 365, otherLive: false, now }), false);
  assert.equal(retentionDue({ status: "canceled", canceled_at: "2025-01-01T00:00:00Z" }, { days: 365, otherLive: true, now }), false);
  assert.equal(retentionDue({ status: "canceled" }, { days: 365, otherLive: false, now }), false);
});

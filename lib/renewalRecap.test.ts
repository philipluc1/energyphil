import { test } from "node:test";
import assert from "node:assert/strict";
import { daysWatched, recapDue, savedSince } from "./renewalRecap";

const now = new Date("2027-10-18T19:00:00Z");

test("saved since switching: only days after the switch count", () => {
  const eps = [
    { started_at: "2026-11-01T00:00:00Z", ended_at: "2027-03-01T00:00:00Z", daily_rate: 1 },
    { started_at: "2027-03-01T00:00:00Z", ended_at: null, daily_rate: 0.5 },
  ];
  assert.equal(savedSince(eps, null, now), 0);
  const s = savedSince(eps, "2027-01-01T00:00:00Z", now);
  // Jan 1 to Mar 1 = 59 days at $1, Mar 1 to Oct 18 19:00 ≈ 231.8 days at $0.50
  assert.ok(Math.abs(s - (59 + 231.79 * 0.5)) < 1, String(s));
});

test("recap is due 12 to 14 days before a yearly renewal, once", () => {
  const periodEnd = "2027-11-01T00:00:00Z";
  assert.equal(recapDue({ plan: "annual", status: "active", periodEnd, sentFor: null, now }), true);
  assert.equal(recapDue({ plan: "annual", status: "active", periodEnd, sentFor: "2027-11-01", now }), false);
  assert.equal(recapDue({ plan: "monthly", status: "active", periodEnd, sentFor: null, now }), false);
  assert.equal(recapDue({ plan: "annual", status: "active", periodEnd: "2027-12-01T00:00:00Z", sentFor: null, now }), false);
  assert.equal(recapDue({ plan: "annual", status: "canceled", periodEnd, sentFor: null, now }), false);
});

test("days watched: from joining, at most a year", () => {
  assert.equal(daysWatched("2026-11-01T00:00:00Z", "2027-11-01T00:00:00Z", now), 352);
  assert.equal(daysWatched("2027-10-01T00:00:00Z", "2027-11-01T00:00:00Z", now), 18);
});

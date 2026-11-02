import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewAskDue } from "./reviews";

const now = Date.parse("2026-12-01T00:00:00Z");
const base = { status: "active", cancelAt: null, unsubscribed: false, createdAt: "2026-11-25T00:00:00Z", switchedAt: null, asks: 0, askedAt: null, clickedAt: null, now };

test("three weeks after switching", () => {
  assert.equal(reviewAskDue({ ...base, switchedAt: "2026-11-09T00:00:00Z" }), "switched");
  assert.equal(reviewAskDue({ ...base, switchedAt: "2026-11-20T00:00:00Z" }), null);
});

test("45 days after joining, if they haven't switched", () => {
  assert.equal(reviewAskDue({ ...base, createdAt: "2026-10-01T00:00:00Z" }), "member");
  assert.equal(reviewAskDue({ ...base, createdAt: "2026-11-01T00:00:00Z" }), null);
  // Switched recently: wait for the switch ask instead.
  assert.equal(reviewAskDue({ ...base, createdAt: "2026-10-01T00:00:00Z", switchedAt: "2026-11-25T00:00:00Z" }), null);
});

test("one reminder a week later, then never again", () => {
  assert.equal(reviewAskDue({ ...base, asks: 1, askedAt: "2026-11-23T00:00:00Z" }), "reminder");
  assert.equal(reviewAskDue({ ...base, asks: 1, askedAt: "2026-11-28T00:00:00Z" }), null);
  assert.equal(reviewAskDue({ ...base, asks: 2, askedAt: "2026-11-01T00:00:00Z" }), null);
});

test("never after a click, or to anyone cancelling, behind or unsubscribed", () => {
  const due = { ...base, createdAt: "2026-10-01T00:00:00Z" };
  assert.equal(reviewAskDue({ ...due, clickedAt: "2026-11-30T00:00:00Z" }), null);
  assert.equal(reviewAskDue({ ...due, cancelAt: "2026-12-20T00:00:00Z" }), null);
  assert.equal(reviewAskDue({ ...due, status: "past_due" }), null);
  assert.equal(reviewAskDue({ ...due, unsubscribed: true }), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { describeFilters, fromSource, inPeriod, monthsFor, onPlan, parseFilters, sourceKind } from "./adminFilters";

const now = new Date("2026-11-02T00:00:00Z");

test("parse: unknown values fall back to all", () => {
  assert.deepEqual(parseFilters({ period: "90", plan: "annual", source: "referral" }), { period: "90", plan: "annual", source: "referral" });
  assert.deepEqual(parseFilters({ period: "x", plan: ["monthly"], source: undefined }), { period: "all", plan: "monthly", source: "all" });
});

test("source kinds", () => {
  assert.equal(sourceKind(null), "direct");
  assert.equal(sourceKind("p:wyndham"), "partner");
  assert.equal(sourceKind("r:AMELIA7"), "referral");
  assert.equal(sourceKind("u:facebook/cpc/spring"), "ads");
});

test("filters rows by period, plan and source", () => {
  const rows = [
    { created_at: "2026-10-30T00:00:00Z", plan: "annual", source: "r:A" },
    { created_at: "2026-06-01T00:00:00Z", plan: "monthly", source: null },
  ];
  const f = parseFilters({ period: "30", plan: "annual", source: "referral" });
  assert.equal(inPeriod(rows, f, now).length, 1);
  assert.equal(onPlan(rows, f).length, 1);
  assert.equal(fromSource(rows, f).length, 1);
  assert.equal(inPeriod(rows, parseFilters({}), now).length, 2);
});

test("months shown and the summary line", () => {
  assert.equal(monthsFor(parseFilters({})), 12);
  assert.equal(monthsFor(parseFilters({ period: "90" })), 3);
  assert.equal(monthsFor(parseFilters({ period: "7" })), 2);
  assert.equal(describeFilters(parseFilters({ period: "90", plan: "annual", source: "ads" })), "The last 90 days · Yearly · Ads");
});

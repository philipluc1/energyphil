import { test } from "node:test";
import assert from "node:assert/strict";
import { namesList, stickyPick } from "./stickyPick";

const r = (retailer: string, plan: string, total: number, restricted: string | null = null) => ({ plan: [retailer, "Powercor", plan] as const, total, restricted });
// Totals for a 91-day bill: $1 a quarter ≈ $4 a year.
const ranked = [r("1st Energy", "Emerald", 300), r("OVO Energy", "One", 302), r("Sumo", "Sunrise", 304), r("Members Co", "Club", 290, "Members only"), r("Tango", "Easy", 330)];

test("first time: the cheapest anyone can get", () => {
  const p = stickyPick(ranked, null, 91)!;
  assert.equal(p.pick.plan[0], "1st Energy");
  assert.equal(p.reason, "first");
  assert.deepEqual(p.nearTies.map((m) => m.plan[0]), ["OVO Energy", "Sumo"]);
});

test("a near-tie never replaces the pick", () => {
  const p = stickyPick(ranked, { retailer: "OVO Energy", plan: "One" }, 91)!;
  assert.equal(p.pick.plan[0], "OVO Energy");
  assert.equal(p.reason, "kept");
  assert.equal(p.cheapest.plan[0], "1st Energy");
  assert.deepEqual(p.nearTies.map((m) => m.plan[0]), ["1st Energy", "Sumo"]);
});

test("beaten by $50 a year or more: the pick moves", () => {
  const p = stickyPick(ranked, { retailer: "Tango", plan: "Easy" }, 91)!; // $30 a quarter ≈ $120 a year
  assert.equal(p.pick.plan[0], "1st Energy");
  assert.equal(p.reason, "cheaper");
});

test("withdrawn: the pick moves", () => {
  const p = stickyPick(ranked, { retailer: "Gone Energy", plan: "Old" }, 91)!;
  assert.equal(p.reason, "gone");
  assert.equal(p.pick.plan[0], "1st Energy");
});

test("names", () => {
  assert.equal(namesList(["A"]), "A");
  assert.equal(namesList(["A", "B", "C"]), "A, B and C");
});

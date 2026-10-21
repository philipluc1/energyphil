// Run: npx tsx lib/marketActivity.test.ts
import assert from "node:assert/strict";
import { activityWords, dailyChanges, marketActivity, marketEvents } from "./marketActivity";
import { PLANS } from "./plans";

// Starter data: no offer dates yet, so nothing is claimed.
assert.equal(marketActivity().ready, false);

const now = Date.parse("2026-11-20T00:00:00Z");
const [a, b, c] = Array.from(new Set(PLANS.filter((p) => p[1] === "Powercor").map((p) => `${p[0]}|${p[2]}`))).slice(0, 3);
const other = PLANS.find((p) => p[1] === "Citipower" && !PLANS.some((q) => q[1] === "Powercor" && q[0] === p[0] && q[2] === p[2]));
const dates = {
  [a]: { from: null, updated: null, seen: "2026-11-10", priceChanged: null },           // new this month
  [b]: { from: null, updated: null, seen: null, priceChanged: "2026-11-01" },           // price change this month
  [c]: { from: null, updated: null, seen: "2026-09-01", priceChanged: "2026-09-02" },   // too long ago
  ...(other ? { [`${other[0]}|${other[2]}`]: { from: null, updated: null, seen: "2026-11-15", priceChanged: null } } : {}),
};
const pc = marketActivity({ dates, network: "Powercor", now });
assert.deepEqual([pc.newOffers, pc.priceChanges, pc.ready], [1, 1, true]);
assert.equal(activityWords(pc), "1 new offer and 1 price change");
// Since a join date.
assert.equal(marketActivity({ dates, network: "Powercor", since: "2026-11-05", now }).priceChanges, 0);
assert.equal(activityWords({ newOffers: 0, priceChanges: 3, retailers: 2, ready: true }), "3 price changes");

// Offers already there when tracking began count as new from the date they took effect
// (the same rule as the "New offer" badge); offers dated ahead don't count yet.
const [d1, d2] = Array.from(new Set(PLANS.filter((p) => p[1] === "Powercor").map((p) => `${p[0]}|${p[2]}`))).slice(3, 5);
const dates2 = {
  ...dates,
  [d1]: { from: "2026-11-12", updated: null, seen: null, priceChanged: null },
  [d2]: { from: "2026-12-01", updated: null, seen: null, priceChanged: null },
};
const ev = marketEvents({ dates: dates2, network: "Powercor", now });
assert.deepEqual(ev.map((e) => e.date), ["2026-11-12", "2026-11-10", "2026-11-01"]); // newest first
assert.deepEqual(ev.map((e) => e.kind), ["new", "new", "price"]);
assert.equal(ev[0].retailer + "|" + ev[0].plan, d1);
// By day: 30 bars ending today, with each change on its day.
const days = dailyChanges(ev, 30, now);
assert.equal(days.length, 30);
assert.equal(days[29].date, "2026-11-20");
assert.equal(days.reduce((s, d) => s + d.newOffers + d.priceChanges, 0), 3);
assert.equal(days.find((d) => d.date === "2026-11-01")!.priceChanges, 1);
// Nothing to show on the starter data.
assert.deepEqual(marketEvents(), []);
console.log("market activity ok");

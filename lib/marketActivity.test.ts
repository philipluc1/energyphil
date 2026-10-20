// Run: npx tsx lib/marketActivity.test.ts
import assert from "node:assert/strict";
import { activityWords, marketActivity } from "./marketActivity";
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
console.log("market activity ok");

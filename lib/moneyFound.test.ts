import { test } from "node:test";
import assert from "node:assert/strict";
import { addFound, foundSentence, foundTotals } from "./moneyFound";

test("same bill from the dashboard and a forwarded email counts once", () => {
  let l = addFound([], { key: "2026-11-05", at: "2026-11-05T01:00:00Z", perYear: 0, oneOff: 12, ids: ["fees", "read"] });
  l = addFound(l, { key: "2026-11-05", at: "2026-11-05T02:00:00Z", perYear: 631, oneOff: 12, ids: ["tariff", "fees", "read", "concession"] });
  assert.equal(l.length, 1);
  assert.deepEqual(foundTotals(l), { bills: 1, caught: 4, back: 12, onOfferYear: 631 });
});

test("things caught and money back add up across bills; yearly is the latest bill only", () => {
  let l = addFound([], { key: "2026-08-05", at: "2026-08-05T00:00:00Z", perYear: 259, oneOff: 12, ids: ["concession", "fees"] });
  l = addFound(l, { key: "2026-11-05", at: "2026-11-05T00:00:00Z", perYear: 259, oneOff: 0, ids: ["concession"] });
  assert.deepEqual(foundTotals(l), { bills: 2, caught: 3, back: 12, onOfferYear: 259 });
  assert.equal(foundSentence(foundTotals(l)), "We've caught 3 things on your bills: $12 in fees and charges to ask back, and about $259 a year on offer on your latest bill.");
});

test("junk is dropped; nothing caught means no sentence", () => {
  assert.deepEqual(addFound("x", { key: "", at: "", perYear: 1, oneOff: 1, ids: [] }), []);
  assert.equal(foundSentence(foundTotals([])), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { indexRows, mergeIndex } from "./price-index.ts";

test("one row per network, cheapest at or under the default offer's ballpark", () => {
  const rows = indexRows("2026-10-31");
  assert.equal(rows.length, 5);
  for (const r of rows) {
    assert.ok(r.cheapest > 0 && r.vdo > 0, r.network);
    assert.ok(r.cheapest < r.vdo * 1.5, r.network);
  }
});

test("re-running a day replaces that day's rows", () => {
  const a = indexRows("2026-10-31");
  const twice = mergeIndex(mergeIndex([], a), a);
  assert.equal(twice.length, a.length);
});

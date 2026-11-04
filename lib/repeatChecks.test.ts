import { test } from "node:test";
import assert from "node:assert/strict";
import { recordCheck, showRepeatNudge, SAME_CHECK_MS } from "./repeatChecks";

const D = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 4, 10);

test("first check is recorded, no nudge", () => {
  const t = recordCheck(null, now);
  assert.deepEqual(t, [now]);
  assert.equal(showRepeatNudge(t), false);
});

test("re-running within the hour counts once", () => {
  const t = recordCheck([now - SAME_CHECK_MS + 1000], now);
  assert.equal(t.length, 1);
});

test("third check in 30 days shows the nudge", () => {
  const t = recordCheck([now - 20 * D, now - 3 * D], now);
  assert.equal(t.length, 3);
  assert.equal(showRepeatNudge(t), true);
});

test("checks older than 30 days and junk are dropped", () => {
  const t = recordCheck([now - 31 * D, now - 40 * D, "x", NaN, now + D], now);
  assert.deepEqual(t, [now]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { MIDDAY_RATES, priceMiddayDay, shiftToMidday, windowAt } from "./middayPowerSaver";

const flat = (perHour: number) => Array.from({ length: 24 }, () => perHour);

test("the day splits into the four windows", () => {
  assert.equal(windowAt(10), "offpeak");
  assert.equal(windowAt(11), "free");
  assert.equal(windowAt(13), "free");
  assert.equal(windowAt(14), "soak");
  assert.equal(windowAt(16), "peak");
  assert.equal(windowAt(20), "peak");
  assert.equal(windowAt(21), "offpeak");
});

test("a flat 1 kWh an hour home on Citipower", () => {
  const d = priceMiddayDay("Citipower", flat(1));
  const r = MIDDAY_RATES.Citipower;
  assert.deepEqual(d.kwh, { free: 3, soak: 2, peak: 5, offpeak: 14 });
  const want = r.supply + 2 * r.soak + 5 * r.peak + 14 * r.offpeak;
  assert.ok(Math.abs(d.perDay - want) < 1e-9);
  assert.equal(d.overCap, 0);
});

test("free use over 24 kWh a day is charged at the soak rate", () => {
  const h = flat(0);
  h[11] = 10; h[12] = 10; h[13] = 10;
  const d = priceMiddayDay("Powercor", h);
  assert.equal(d.overCap, 6);
  assert.ok(Math.abs(d.cost.free - 6 * MIDDAY_RATES.Powercor.soak) < 1e-9);
});

test("shifting moves kWh into the free hours and keeps the day's total", () => {
  const before = flat(1);
  const after = shiftToMidday(before, 3, "evening");
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(sum(after) - sum(before)) < 1e-9);
  assert.ok(Math.abs(after[11] - 2) < 1e-9);
  assert.ok(after[18] < 1);
  // Can't move more than there is.
  const ev = shiftToMidday(flat(0), 5, "overnight");
  assert.equal(sum(ev), 0);
  assert.ok(priceMiddayDay("Jemena", after).perDay < priceMiddayDay("Jemena", before).perDay);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyClouds, melbourneHour, solarFactor, weatherLabel } from "./weather";

test("clouds cut solar, never to nothing", () => {
  assert.equal(solarFactor(0), 1);
  assert.ok(solarFactor(50) > 0.9);
  assert.ok(Math.abs(solarFactor(100) - 0.25) < 1e-9);
});

test("a grey day: less sent out, a little more drawn in", () => {
  const curve = { grid: Array(24).fill(0.2), feedIn: Array.from({ length: 24 }, (_, h) => (h === 12 ? 1 : 0)) };
  const out = applyClouds(curve, Array(24).fill(100));
  assert.equal(out.feedIn[12], 0.25);
  assert.equal(out.grid[12], Math.round((0.2 + 0.75 * 3 / 7) * 100) / 100);
  assert.equal(out.grid[3], 0.2);
  assert.equal(out.share, 0.25);
});

test("labels and the Melbourne clock", () => {
  assert.equal(weatherLabel(0), "Sunny");
  assert.equal(weatherLabel(3), "Cloudy");
  assert.equal(weatherLabel(61), "Rain");
  assert.equal(weatherLabel(null, 80), "Cloudy");
  assert.equal(melbourneHour(new Date("2026-11-02T02:30:00Z")), 13.5);
});

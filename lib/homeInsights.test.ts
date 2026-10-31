import { test } from "node:test";
import assert from "node:assert/strict";
import { currentPricer, forecastYear, likeYours, scaleUsage } from "./homeInsights";
import { DEFAULT_PROFILE } from "./profileUsage";
import type { UsageInput } from "./plans";

const base: UsageInput = { days: 90, peak: 0, shoulder: 0, offpeak: 0, anytime: 900, cl: 0, solarExportKwh: 0 };

test("scaling keeps the mix of bands", () => {
  const u = scaleUsage({ ...base, anytime: 0, peak: 300, offpeak: 600 }, 450, 30, 0);
  assert.equal(u.peak, 150);
  assert.equal(u.offpeak, 300);
  assert.equal(u.days, 30);
});

test("the implied pricer gives back the bill for the bill's own usage", () => {
  const p = currentPricer({ network: "Citipower", you: 400, base });
  assert.ok(Math.abs(p(base) - 400) < 1e-6);
});

test("a flat forecast prices twelve months and a next bill as long as the last", () => {
  const now = currentPricer({ network: "Citipower", you: 400, base });
  const best = (u: UsageInput) => now(u) * 0.8;
  const f = forecastYear({ base, profile: null, now, best, today: new Date(2026, 9, 31) });
  assert.ok(f);
  assert.equal(f!.months.length, 12);
  assert.equal(f!.months[0].month, 9);
  assert.equal(f!.next.days, 90);
  assert.ok(Math.abs(f!.yearBest - f!.yearNow * 0.8) < 1e-6);
  // A flat home: about 10 kWh a day for 90 days.
  assert.ok(Math.abs(f!.next.kwh - 900) <= 2);
});

test("a seasonal forecast puts more power in winter for a home heated by electricity", () => {
  const profile = { ...DEFAULT_PROFILE, heating: "reverse_cycle" as const };
  const now = currentPricer({ network: "Powercor", you: 400, base });
  const f = forecastYear({ base, profile, now, best: now, today: new Date(2026, 0, 15), billEndMonth: 11 });
  assert.ok(f && f.seasonal);
  const jul = f!.months.find((m) => m.month === 6)!;
  const feb = f!.months.find((m) => m.month === 1)!;
  assert.ok(jul.kwh / jul.days > feb.kwh / feb.days);
});

test("homes like yours compares with the model for their answers", () => {
  const l = likeYours(DEFAULT_PROFILE, base);
  assert.ok(l);
  assert.ok(Math.abs(l!.you - 10) < 1e-9);
  assert.ok(l!.typical > 0);
});

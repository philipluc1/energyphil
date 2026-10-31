// Run: npx tsx lib/gasInsights.test.ts
import assert from "node:assert/strict";
import { forecastGasYear, gasOfferKeys, gasPricer, gasSavingsByZone, gasSeasonFactors, medianGasSupply, planGasPricer } from "./gasInsights";
import { GAS_PLANS, rankGasPlans } from "./gasPlans";
import { marketEvents } from "./marketActivity";

// Their own plan: the bill comes back unchanged at the same usage; more gas costs more, never below zero.
const now = gasPricer({ bill: 480, mj: 6000, days: 91, supplyPerDay: 1 });
assert.ok(Math.abs(now({ days: 91, mj: 6000 }) - 480) < 0.01);
assert.ok(now({ days: 91, mj: 9000 }) > 480);
assert.ok(now({ days: 91, mj: 0 }) >= 0);
// A tiny bill never goes negative on the usage part.
assert.ok(gasPricer({ bill: 20, mj: 100, days: 91, supplyPerDay: 1.2 })({ days: 91, mj: 200 }) > 20);

// Seasons: winter above a bill's average and summer below, more so for a home that heats with gas.
const heated = gasSeasonFactors(0.65);
const unheated = gasSeasonFactors(0.1);
assert.ok(heated.winter > 1.5 && heated.summer < 0.6, JSON.stringify(heated));
assert.ok(unheated.winter < heated.winter && unheated.summer > heated.summer);

if (GAS_PLANS.length) {
  // Twelve calendar months from today, 365 days in all, the next bill the right length, winter dearest.
  const r = rankGasPlans("Multinet", { days: 91, mj: 6000 });
  const f = forecastGasYear({ mj: 6000, days: 91, endIso: null, heatingShare: 0.65, now, best: planGasPricer(r[0].plan), today: new Date(2026, 10, 1) });
  assert.ok(f);
  assert.equal(f.months.length, 12);
  assert.equal(f.months.reduce((a, m) => a + m.days, 0), 365);
  assert.deepEqual(f.months.map((m) => m.days), [30, 31, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31]);
  assert.equal(f.next.end.getDate(), 30); // 91 days from 1 Nov 2026 ends 30 Jan 2027
  const july = f.months.find((m) => m.month === 6)!;
  const jan = f.months.find((m) => m.month === 0)!;
  assert.ok(july.mj > jan.mj * 2);
  assert.ok(f.yearBest <= f.yearNow + 1);
  assert.equal(forecastGasYear({ mj: 0, days: 91, endIso: null, heatingShare: 0.5, now, best: now }), null);

  // The /gas savings line: each network once, biggest first, never negative.
  const z = gasSavingsByZone(45_000);
  assert.ok(z.length >= 1 && z.length <= 3);
  for (let i = 1; i < z.length; i++) assert.ok(z[i - 1].save >= z[i].save);
  assert.ok(z.every((x) => x.save >= 0 && x.cheapest <= x.typical));
  assert.ok(medianGasSupply("Multinet") > 0);

  // Gas offers can be counted on the market board via keys.
  const keys = [...gasOfferKeys("Multinet")];
  assert.ok(keys.length > 0);
  const dates = { [keys[0]]: { from: null, updated: null, seen: "2026-11-10", priceChanged: null } };
  const ev = marketEvents({ dates, keys, now: Date.parse("2026-11-20T00:00:00Z") });
  assert.equal(ev.length, 1);
  assert.equal(`${ev[0].retailer}|${ev[0].plan}`, keys[0]);
}

console.log("gasInsights: ok");

// Run: npx tsx lib/profileUsage.test.ts
// Not enough usage -> the average Victorian home (4,000 kWh a year).
import assert from "node:assert/strict";
import {
  AVERAGE_ANNUAL_KWH,
  DEFAULT_PROFILE,
  averageUsage,
  estimateUsage,
  forecastFromBill,
  monthlyEstimate,
  scaleEstimate,
  usageIsIncomplete,
  usageOrAverage,
  type HomeProfile,
  type MonthEstimate,
} from "./profileUsage";

const u = (o: Partial<{ days: number; peak: number; shoulder: number; offpeak: number; anytime: number; cl: number; solarExportKwh: number }>) =>
  ({ days: 91, peak: 0, shoulder: 0, offpeak: 0, anytime: 0, cl: 0, solarExportKwh: 0, ...o });

// The average splits a year's 4,000 kWh across the bands and adds up exactly.
const a = averageUsage(365);
assert.equal(a.peak + a.shoulder + a.offpeak, AVERAGE_ANNUAL_KWH);
assert.deepEqual([a.anytime, a.cl, a.solarExportKwh], [0, 0, 0]);
assert.equal(averageUsage(0).days, 91); // no period: a quarter

// When it kicks in.
assert.equal(usageIsIncomplete(u({})), true); // nothing entered
assert.equal(usageIsIncomplete(u({ days: 5, anytime: 60 })), true); // under a week
assert.equal(usageIsIncomplete(u({ anytime: 50 })), true); // 0.5 kWh a day
assert.equal(usageIsIncomplete(u({ anytime: 50, solarExportKwh: 400 })), false); // solar homes use little from the grid
assert.equal(usageIsIncomplete(u({ anytime: 1000 })), false);
assert.equal(usageIsIncomplete(u({ peak: 300, shoulder: 300, offpeak: 200 })), false);

const r = usageOrAverage(u({ days: 30 }));
assert.equal(r.average, true);
assert.equal(r.usage.days, 30);
assert.equal(r.usage.peak + r.usage.shoulder + r.usage.offpeak, Math.round((AVERAGE_ANNUAL_KWH * 30) / 365));
const keep = u({ anytime: 900 });
assert.equal(usageOrAverage(keep).usage, keep);
console.log("average home ok");

// The household estimate (recalibrated Oct 2026).
const home = (o: Partial<HomeProfile>): HomeProfile => ({ ...DEFAULT_PROFILE, cooling: false, ...o });
// Two people, gas heating, electric hot water: 3,000 everyday + 1,450 hot water.
const two = monthlyEstimate(home({ people: 2, heating: "gas_none", hotWater: "electric_general", daytimeHome: "some" }));
assert.equal(two.breakdown.total, 4450);
assert.equal(estimateUsage(home({ people: 2, heating: "gas_none", hotWater: "electric_general", daytimeHome: "some" }), 365).annualKwh, 4450);
// The months add up to the year, and winter is the heavy end.
const sum = (xs: MonthEstimate[]) => xs.reduce((a, m) => a + m.kwh, 0);
assert.ok(Math.abs(sum(two.months) - two.breakdown.total) <= 6);
assert.ok(two.months[6].kwh > two.months[0].kwh);
// Heating only lands in the cold months.
const heated = monthlyEstimate(home({ people: 2, heating: "reverse_cycle" }));
assert.ok(heated.months[6].kwh - heated.months[0].kwh > 150);
// Hot water grows with the household; a heat pump uses about a third.
assert.ok(monthlyEstimate(home({ people: 5, hotWater: "electric_general" })).breakdown.hotWater > monthlyEstimate(home({ people: 1, hotWater: "electric_general" })).breakdown.hotWater * 2.5);
assert.equal(monthlyEstimate(home({ people: 2, hotWater: "heat_pump" })).breakdown.hotWater, 510);
// Solar: more exported in January than June, and never negative use.
const sunny = monthlyEstimate(home({ people: 2, hasSolar: true, solarInput: "kw", solarKw: 6.6, daytimeHome: "away" }));
assert.ok(sunny.months[0].solarExportKwh > sunny.months[5].solarExportKwh * 2);
assert.ok(sunny.months.every((m) => m.kwh >= 0));
const sunnyPeriod = estimateUsage(home({ people: 2, hasSolar: true, solarInput: "kw", solarKw: 6.6, daytimeHome: "away" }), 365);
assert.ok(Math.abs(sunnyPeriod.totalKwh - sunny.breakdown.total) <= 3);
// Solar covers daytime use only: a gas home still buys most of its evening power.
assert.ok(sunny.breakdown.total > 1500, `solar home grid use ${sunny.breakdown.total}`);
// A mix of homes of each size lands near the published Melbourne averages (within 15%).
// AER benchmarks (Dec 2020), except 2 people: midway between the AER (4,840) and the ESC's 2–3 people figure (4,307).
const AER = { 1: 2953, 2: 4574, 3: 5077, 4: 5805, 5: 7351 } as Record<number, number>;
for (const n of [1, 2, 3, 4, 5]) {
  const all = (o: Partial<HomeProfile>) => monthlyEstimate(home({ people: n, ...o })).breakdown.total;
  const gasHome = all({});
  const mixed = gasHome + 0.45 * (all({ hotWater: "electric_general" }) - gasHome) + 0.5 * (all({ heating: "reverse_cycle" }) - gasHome) + 0.6 * (all({ cooling: true }) - gasHome);
  assert.ok(Math.abs(mixed / AER[n] - 1) < 0.15, `${n} people: ${Math.round(mixed)} vs AER ${AER[n]}`);
}
console.log("household estimate ok");

// Forecasting the year from one bill.
const twoP = home({ people: 2, heating: "gas_none", hotWater: "electric_general", daytimeHome: "some" });
// A bill that matches the answers exactly gives back the same year.
const winterModel = two.months[5].kwh + two.months[6].kwh + two.months[7].kwh; // Jun–Aug, 92 days
const same = forecastFromBill(twoP, { kwh: winterModel, days: 92, endMonth: 7 })!;
assert.ok(Math.abs(same.factor - 1) < 0.01 && Math.abs(same.annual - two.breakdown.total) <= 12);
assert.deepEqual(same.covered.map((d, i) => (d ? i : -1)).filter((i) => i >= 0), [5, 6, 7]);
// A 1,200 kWh winter quarter: a straight ×4 would say ~4,760 a year; the seasonal forecast is lower.
const winter = forecastFromBill(twoP, { kwh: 1200, days: 92, endMonth: 7 })!;
assert.ok(winter.annual < Math.round((1200 * 365) / 92) - 250, `winter forecast ${winter.annual}`);
// The same kWh over a summer quarter means a heavier home, so a bigger year.
const summer = forecastFromBill(twoP, { kwh: 1200, days: 90, endMonth: 1 })!;
assert.ok(summer.annual > winter.annual);
// A month that runs back into the previous year (December–January).
const dec = forecastFromBill(twoP, { kwh: 400, days: 45, endMonth: 0 })!;
assert.equal(dec.covered[0] + dec.covered[11], 45);
// Silly figures are held to a sensible range; nothing entered, nothing back.
assert.equal(forecastFromBill(twoP, { kwh: 1_000_000, days: 91, endMonth: 8 })!.factor, 5);
assert.equal(forecastFromBill(twoP, { kwh: 0, days: 91, endMonth: 8 }), null);
// Pricing follows the forecast.
const scaled = scaleEstimate(estimateUsage(twoP, 91), 1.2);
assert.equal(scaled.annualKwh, Math.round(estimateUsage(twoP, 91).annualKwh * 1.2));
console.log("bill forecast ok");

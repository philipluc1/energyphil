// Run: npx tsx lib/profileUsage.test.ts
// Not enough usage -> the average Victorian home (4,000 kWh a year).
import assert from "node:assert/strict";
import { AVERAGE_ANNUAL_KWH, averageUsage, usageIsIncomplete, usageOrAverage } from "./profileUsage";

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

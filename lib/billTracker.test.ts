// Run: npx tsx lib/billTracker.test.ts
import assert from "node:assert/strict";
import { monthBill, trackMonths, trackerTotals, type TrackedBill } from "./billTracker";

const today = new Date(Date.UTC(2026, 10, 1)); // 1 Nov 2026
const b = (id: string, end: string, days: number, amount: number | null, kwh: number | null, fuel: "electricity" | "gas" = "electricity"): TrackedBill =>
  ({ id, fuel, period_end: end, billing_days: days, kwh, mj: fuel === "gas" ? kwh : null, amount, retailer: "Tango Energy", source: "photo" });

// A quarterly bill (Jul–Sep) fills three months; August is missing nothing; October has no bill.
const q = b("q", "2026-09-30", 92, 460, 1840);
const m = trackMonths([q], "electricity", { today });
assert.deepEqual(m.map((x) => x.key), ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
assert.deepEqual(m.map((x) => x.status), ["missing", "full", "full", "full", "missing", "now"]);
assert.ok(Math.abs(m[1].amount + m[2].amount + m[3].amount - 460) < 0.05);
assert.equal(m[1].amount, 155); // 31 of 92 days
assert.equal(m[1].usage, 620);

// A bill that starts mid-month makes that month partial.
const p = trackMonths([b("p", "2026-10-20", 30, 120, 300)], "electricity", { today });
assert.equal(p.find((x) => x.key === "2026-09")!.status, "part");
assert.equal(p.find((x) => x.key === "2026-10")!.status, "part");

// Overlapping bills don't double count a day.
const o = trackMonths([b("a", "2026-10-31", 31, 310, 310), b("b", "2026-10-31", 31, 310, 310)], "electricity", { today });
assert.equal(o.find((x) => x.key === "2026-10")!.amount, 310);

// Gas is tracked separately; an older bill stretches the range back, capped at 12 months.
const g = trackMonths([b("g", "2025-06-30", 30, 90, 3000, "gas")], "gas", { today });
assert.equal(g.length, 12);
assert.equal(g[0].key, "2025-12");
assert.equal(trackMonths([b("g", "2026-06-30", 30, 90, 3000, "gas")], "electricity", { today }).every((x) => x.covered === 0), true);

// Totals: average a month over covered months.
const t = trackerTotals(m);
assert.equal(t.months, 3);
assert.ok(Math.abs(t.avgAmount - 460 / 3) < 0.5);
assert.equal(t.missing, 2);

// A month typed in by hand covers the whole month.
assert.deepEqual(monthBill(2026, 1), { periodEnd: "2026-02-28", days: 28 });
assert.equal(trackMonths([b("x", monthBill(2026, 7).periodEnd, 31, 100, null)], "electricity", { today }).find((x) => x.key === "2026-08")!.estimatedGap, true);

console.log("billTracker: ok");

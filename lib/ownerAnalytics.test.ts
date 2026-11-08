import { test } from "node:test";
import assert from "node:assert/strict";
import {
  atRisk, breakEvenPerMember, channelOf, channelPayback, funnelWeeks, growthSeries, mrrTrend, periodKey, periodKeys, planVsActual,
  priceMix, readsByMonth, renewalsAhead, salesInMonth, valueDelivered, type MemberDetail,
} from "./ownerAnalytics";
import type { MemberRow } from "./adminReports";

const NOW = new Date("2026-11-20T02:00:00Z"); // Fri 20 Nov, Melbourne
const mem = (o: Partial<MemberDetail>): MemberDetail => ({ id: Math.random().toString(36), created_at: "2026-11-10T00:00:00Z", email: `${Math.random().toString(36).slice(2)}@x.com`, plan: "annual", status: "active", amount_cents: 4500, current_period_end: "2027-11-10T00:00:00Z", ...o });

test("periods: Monday weeks and months in Melbourne", () => {
  assert.equal(periodKey(new Date("2026-11-15T13:30:00Z"), "week"), "2026-11-16"); // Mon 16 Nov 00:30 in Melbourne
  assert.equal(periodKey(NOW, "week"), "2026-11-16");
  assert.deepEqual(periodKeys("month", 3, NOW), ["2026-09", "2026-10", "2026-11"]);
  assert.deepEqual(periodKeys("week", 2, NOW), ["2026-11-09", "2026-11-16"]);
});

test("growth: new by plan, cancellations, paying at period end, checks", () => {
  const rows: MemberRow[] = [
    mem({ created_at: "2026-11-10T00:00:00Z", plan: "annual" }),
    mem({ created_at: "2026-11-17T00:00:00Z", plan: "monthly", amount_cents: 700 }),
    mem({ created_at: "2026-11-11T00:00:00Z", plan: "monthly", amount_cents: 700, status: "canceled", canceled_at: "2026-11-18T00:00:00Z" }),
  ];
  const ev = [{ created_at: "2026-11-17T00:00:00Z", event: "check_completed" }, { created_at: "2026-11-17T00:00:00Z", event: "check_started" }];
  const g = growthSeries(rows, ev, "week", 2, NOW);
  assert.deepEqual(g.map((p) => [p.newYearly, p.newMonthly, p.cancelled, p.paying, p.checks]), [[1, 1, 0, 2, 0], [0, 1, -1, 2, 1]]);
});

test("funnel: visitors are distinct sessions; conversion = paid / finished checks", () => {
  const f = funnelWeeks(
    [{ created_at: "2026-11-17T00:00:00Z", sid: "a" }, { created_at: "2026-11-18T00:00:00Z", sid: "a" }, { created_at: "2026-11-18T00:00:00Z", sid: "b" }],
    [{ created_at: "2026-11-17T00:00:00Z", event: "check_completed" }, { created_at: "2026-11-17T00:00:00Z", event: "check_completed" }, { created_at: "2026-11-17T00:00:00Z", event: "checkout_started" }],
    [{ created_at: "2026-11-17T00:00:00Z" }], [mem({ created_at: "2026-11-18T00:00:00Z" })], 1, NOW);
  assert.equal(f[0].visitors, 2); assert.equal(f[0].completed, 2); assert.equal(f[0].emailed, 1); assert.equal(f[0].paid, 1); assert.equal(f[0].conversion, 0.5);
});

test("channels and ad payback", () => {
  assert.equal(channelOf("u:meta/paid/reel1"), "Meta");
  assert.equal(channelOf("u:chatgpt/cpc/x"), "ChatGPT");
  assert.equal(channelOf("u:tiktok/paid/x"), "Other ads");
  assert.equal(channelOf("r:ABC"), "Referrals");
  assert.equal(channelOf(null), "Direct");
  const be = breakEvenPerMember();
  assert.ok(be > 55 && be < 70, `break-even ${be}`); // ~A$61.5 at regular prices, 70% yearly
  const ev = Array.from({ length: 100 }, () => ({ created_at: "2026-11-17T00:00:00Z", event: "check_completed", source: "u:meta/paid/r1" }));
  const ms = [mem({ source: "u:meta/paid/r1" }), mem({ source: "u:meta/paid/r1" }), mem({ source: null })];
  const rows = channelPayback(ev, ms, [{ month: "2026-11-01", channel: "Meta", amount: 140 }], null);
  const meta = rows.find((r) => r.channel === "Meta")!;
  assert.equal(meta.checks, 100); assert.equal(meta.members, 2); assert.equal(meta.costPerCheck, 1.4); assert.equal(meta.costPerMember, 70); assert.equal(meta.paysBackInYear, false);
  assert.equal(rows[0].channel, "Direct");
});

test("sales in a month: monthly every month, yearly on join and anniversary", () => {
  const rows = [mem({ created_at: "2025-11-05T00:00:00Z", plan: "annual", amount_cents: 4500 }), mem({ created_at: "2026-10-05T00:00:00Z", plan: "monthly", amount_cents: 700 }), mem({ created_at: "2026-11-05T00:00:00Z", plan: "annual", amount_cents: 4500 })];
  assert.equal(salesInMonth(rows, "2026-11"), 45 + 7 + 45);
  assert.equal(salesInMonth(rows, "2026-12"), 7);
});

test("plan vs actual scores the month so far", () => {
  const t = [{ month: "2026-11", checks: 493, newMembers: 15, active: 15, salesIncGst: 497 }];
  const rows = Array.from({ length: 10 }, () => mem({}));
  const p = planVsActual(t, [], rows, NOW)[0];
  assert.equal(p.partial, true); assert.equal(p.newMembers, 10); assert.equal(p.status, "ahead"); // 15 × 20/30 = 10 so far
});

test("MRR, price mix and renewals ahead", () => {
  const rows = [
    mem({ plan: "annual", amount_cents: 4500, current_period_end: "2026-12-10T00:00:00Z" }),
    mem({ plan: "annual", amount_cents: 5500, current_period_end: "2027-11-10T00:00:00Z" }),
    mem({ plan: "monthly", amount_cents: 700, current_period_end: "2026-12-01T00:00:00Z" }),
    mem({ plan: "monthly", amount_cents: 900, current_period_end: "2026-12-01T00:00:00Z", cancel_at: "2026-12-01T00:00:00Z" }),
  ];
  const m = mrrTrend(rows, 1, NOW)[0];
  assert.equal(Math.round(m.mrr * 100), 375 + 458 + 700 + 900);
  assert.deepEqual(priceMix(rows, NOW).map((x) => x.members), [1, 1, 1, 1]);
  const [d30, , d90] = renewalsAhead(rows, NOW);
  assert.deepEqual([d30.yearlyCount, d30.yearly, d30.monthlyPayments, d30.monthly], [1, 45, 1, 7]); // cancelling member left out
  assert.equal(d90.monthlyPayments, 3);
});

test("value delivered and at-risk list", () => {
  const a = mem({ email: "a@x.com", created_at: "2026-10-01T00:00:00Z", bill_inbox: "a-1", inbox_last_at: "2026-11-01T00:00:00Z", money_found: [{ key: "k", at: "2026-11-01", perYear: 300, oneOff: 12, ids: ["fees", "older"] }], last_notified_at: "2026-11-15T00:00:00Z", switched_at: "2026-11-02T00:00:00Z" });
  const b = mem({ email: "b@x.com", created_at: "2026-10-01T00:00:00Z", status: "past_due" });
  const c = mem({ email: "c@x.com", created_at: "2026-11-18T00:00:00Z", bill_inbox: "c-1" });
  const v = valueDelivered([a, b, c], [{ created_at: "2026-11-17T00:00:00Z" }], NOW, 2);
  assert.deepEqual([v.paying, v.forwardingSetUp, v.forwardedABill, v.thingsCaught, v.feesToAskBack, v.onOfferYear, v.alerts30, v.switched], [3, 2, 1, 2, 12, 300, 1, 1]);
  assert.equal(v.billsByWeek[1].bills, 1);
  const r = atRisk([a, b, c], [{ email: "a@x.com", created_at: "2026-11-01T00:00:00Z" }], NOW);
  assert.equal(r.length, 1); assert.equal(r[0].email, "b@x.com");
  assert.deepEqual(r[0].reasons, ["Payment failed", "No bill yet", "Forwarding not set up"]);
});

test("bill reads cost by month", () => {
  const r = readsByMonth([{ created_at: "2026-11-02T00:00:00Z" }, { created_at: "2026-11-03T00:00:00Z" }], 2, NOW);
  assert.equal(r[1].reads, 2); assert.equal(r[1].cost, 0.04);
});

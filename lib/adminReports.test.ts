import { test } from "node:test";
import assert from "node:assert/strict";
import { abandonedLeads, cancelReasons, churnByMonth, cohorts, latestPerEmail, maskEmail, monthKey, monthlyValueCents, revenue, type MemberRow } from "./adminReports";

const now = new Date("2026-11-02T01:00:00Z");
const m = (o: Partial<MemberRow>): MemberRow => ({ id: Math.random().toString(36), created_at: "2026-10-01T00:00:00Z", email: "a@x.com", plan: "monthly", status: "active", amount_cents: 700, current_period_end: null, ...o });

test("monthly value: yearly spreads over 12, once-off is 0", () => {
  assert.equal(monthlyValueCents("monthly", 700), 700);
  assert.equal(monthlyValueCents("annual", 3900), 325);
  assert.equal(monthlyValueCents("once_off", 1500), 0);
});

test("one row per person, live membership preferred", () => {
  const rows = [m({ email: "A@x.com", status: "canceled", created_at: "2026-10-20T00:00:00Z" }), m({ email: "a@x.com", status: "active" })];
  const out = latestPerEmail(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].status, "active");
});

test("revenue counts active members and those set to cancel", () => {
  const r = revenue([
    m({ email: "a@x.com" }),
    m({ email: "b@x.com", plan: "annual", amount_cents: 3900, cancel_at: "2027-01-01T00:00:00Z" }),
    m({ email: "c@x.com", status: "past_due" }),
    m({ email: "d@x.com", status: "canceled" }),
  ], now);
  assert.equal(r.mrrCents, 700 + 325);
  assert.equal(r.active, 2);
  assert.equal(r.pastDue, 1);
  assert.equal(r.cancelling, 1);
});

test("cohorts: retention only once everyone has reached the point", () => {
  const rows = [
    m({ email: "a@x.com", created_at: "2026-07-05T00:00:00Z" }),
    m({ email: "b@x.com", created_at: "2026-07-10T00:00:00Z", status: "canceled", canceled_at: "2026-08-20T00:00:00Z" }),
    m({ email: "c@x.com", created_at: "2026-10-15T00:00:00Z" }),
  ];
  const c = cohorts(rows, now);
  const jul = c.find((x) => x.month === "2026-07")!;
  assert.equal(jul.joined, 2);
  assert.equal(jul.retained[0], 1); // both still paying after 1 month
  assert.equal(jul.retained[1], 0.5); // b left before month 2
  assert.equal(jul.retained[3], null); // 6 months not reached
});

test("cohorts: a month not reached yet is null", () => {
  const c = cohorts([m({ email: "c@x.com", created_at: "2026-10-15T00:00:00Z" })], now);
  assert.equal(c[0].retained[0], null);
});

test("churn by month", () => {
  const rows = [
    m({ email: "a@x.com", created_at: "2026-08-05T00:00:00Z" }),
    m({ email: "b@x.com", created_at: "2026-08-10T00:00:00Z", status: "canceled", canceled_at: "2026-10-12T00:00:00Z" }),
    m({ email: "c@x.com", created_at: "2026-10-15T00:00:00Z" }),
  ];
  const ch = churnByMonth(rows, now, 3);
  assert.deepEqual(ch.map((x) => x.month), ["2026-09", "2026-10", "2026-11"]);
  const oct = ch[1];
  assert.equal(oct.joined, 1);
  assert.equal(oct.cancelled, 1);
  assert.equal(oct.atStart, 2);
  assert.equal(oct.rate, 0.5);
});

test("cancel reasons", () => {
  const r = cancelReasons([m({ email: "a@x.com", status: "canceled", cancel_reason: "too_expensive" }), m({ email: "b@x.com", status: "canceled" })]);
  assert.deepEqual(r.map((x) => x.reason).sort(), ["No reason given", "Too expensive"]);
});

test("abandoned: leads who never joined, newest result kept", () => {
  const leads = [
    { created_at: "2026-10-30T00:00:00Z", email: "Lead@x.com", estimated_saving: 300, distributor: "Powercor" },
    { created_at: "2026-10-31T00:00:00Z", email: "lead@x.com", estimated_saving: 320, distributor: "Powercor", unsubscribed: true },
    { created_at: "2026-10-31T00:00:00Z", email: "a@x.com", estimated_saving: 100, distributor: null },
    { created_at: "2026-07-01T00:00:00Z", email: "old@x.com", estimated_saving: 100, distributor: null },
  ];
  const out = abandonedLeads(leads, [m({ email: "a@x.com" })], now, 60);
  assert.equal(out.length, 1);
  assert.equal(out[0].saving, 320);
  assert.equal(out[0].checks, 2);
  assert.equal(out[0].unsubscribed, true);
});

test("month key is Melbourne time; mask hides the address", () => {
  assert.equal(monthKey(new Date("2026-10-31T14:00:00Z")), "2026-11");
  assert.equal(maskEmail("philip@gmail.com"), "p***@gmail.com");
});

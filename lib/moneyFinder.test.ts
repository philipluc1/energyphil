import { test } from "node:test";
import assert from "node:assert/strict";
import { concessionPerYear, findMoney } from "./moneyFinder";

const base = { retailer: "Tango Energy", worthPerYear: 50, flagged: new Set<string>(), name: "Sam Sample", address: "12 Example Street, Williams Landing 3027", nmi: "6203123456" };

test("concession: 17.5% of the yearly bill after the first $171.60", () => {
  assert.equal(concessionPerYear(412.37, 91), Math.round(((412.37 * 365) / 91 - 171.6) * 0.175));
  assert.equal(concessionPerYear(null, 91), null);
});

test("concession is only found when they have a card and the bill shows none", () => {
  assert.equal(findMoney({ ...base, hasCard: null, billTotal: 400, days: 91 }).findings.length, 0);
  assert.equal(findMoney({ ...base, hasCard: true, concessionApplied: true, billTotal: 400, days: 91 }).findings.length, 0);
  const r = findMoney({ ...base, hasCard: true, concessionApplied: false, billTotal: 400, days: 91 });
  assert.equal(r.findings[0].id, "concession");
  assert.ok(r.perYear > 200);
  assert.match(r.findings[0].message.body, /Annual Electricity Concession/);
  assert.match(r.findings[0].message.body, /\[card number\]/);
});

test("late fee: one-off refund to ask for; paper-bill fee isn't a waiver request", () => {
  const r = findMoney({ ...base, fees: [{ kind: "late_payment", amount: 12 }, { kind: "paper_bill", amount: 1.75 }] });
  assert.equal(r.oneOff, 12);
  assert.match(r.findings[0].message.body, /\$12\.00 late-payment fee/);
});

test("same-company cheaper plan becomes a ready message, most valuable first", () => {
  const r = findMoney({ ...base, olderVersion: { planName: "Everyday Easy", perYear: 114 }, readingType: "estimated", billPlanName: "eSelect" });
  assert.deepEqual(r.findings.map((f) => f.id), ["older", "read"]);
  assert.equal(r.perYear, 114);
  assert.match(r.findings[0].message.subject, /Everyday Easy/);
  assert.match(r.findings[0].message.body, /NMI 6203123456/);
  assert.match(r.findings[0].ewov, /\[date\]/);
});

test("nothing invented: unknown name stays a placeholder", () => {
  const r = findMoney({ ...base, name: null, flagged: new Set(["discount"]) });
  assert.match(r.findings[0].message.body, /\[your name\]$/);
});

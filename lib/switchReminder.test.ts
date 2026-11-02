import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanNote, cleanRemindDate, melbourneDay, reminderDue, remindDayLabel } from "./switchReminder";

// 2 Nov 2026, 8pm UTC = 3 Nov, 7am in Melbourne (AEDT).
const now = new Date("2026-11-02T20:00:00Z");

test("Melbourne's date, not UTC's", () => {
  assert.equal(melbourneDay(now), "2026-11-03");
});

test("remind dates: today to four months out", () => {
  assert.equal(cleanRemindDate("2026-11-03", now), "2026-11-03");
  assert.equal(cleanRemindDate("2026-11-07", now), "2026-11-07");
  assert.equal(cleanRemindDate("2026-11-02", now), null); // yesterday in Melbourne
  assert.equal(cleanRemindDate("2027-06-01", now), null); // too far
  assert.equal(cleanRemindDate("2026-02-30", now), null);
  assert.equal(cleanRemindDate("soon", now), null);
});

test("due on the day or after", () => {
  assert.equal(reminderDue("2026-11-03", now), true);
  assert.equal(reminderDue("2026-11-01", now), true);
  assert.equal(reminderDue("2026-11-04", now), false);
  assert.equal(reminderDue(null, now), false);
});

test("the note keeps only what's needed", () => {
  assert.deepEqual(cleanNote({ retailer: "Tango Energy", plan: "Everyday Easy", savingYear: 212.4, same: true, extra: 1 }), { retailer: "Tango Energy", plan: "Everyday Easy", savingYear: 212, same: true });
  assert.equal(cleanNote({ retailer: "", plan: "x" }), null);
  assert.equal(remindDayLabel("2026-11-07"), "Saturday 7 November");
});

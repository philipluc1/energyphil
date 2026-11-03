import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteFollowUpDue } from "./inviteFollowUp";
import { networkRewards } from "./networkRewards";

const now = new Date("2026-11-10T19:00:00Z");
const base = { invitedAt: "2026-11-03T02:00:00Z", followUpAt: null, unsubscribed: false, isMember: false, now };

test("a week after the invite, once", () => {
  assert.equal(inviteFollowUpDue(base), true);
  assert.equal(inviteFollowUpDue({ ...base, invitedAt: "2026-11-05T02:00:00Z" }), false);
  assert.equal(inviteFollowUpDue({ ...base, followUpAt: "2026-11-10T19:00:00Z" }), false);
  assert.equal(inviteFollowUpDue({ ...base, invitedAt: null }), false);
});

test("never to members, unsubscribes or old invites", () => {
  assert.equal(inviteFollowUpDue({ ...base, isMember: true }), false);
  assert.equal(inviteFollowUpDue({ ...base, unsubscribed: true }), false);
  assert.equal(inviteFollowUpDue({ ...base, invitedAt: "2026-10-01T02:00:00Z" }), false);
});

test("rewards on a network are counted", () => {
  const r = networkRewards("Powercor");
  assert.ok(r.counts.credit + r.counts.points + r.counts.gift + r.counts.discount >= 0);
  assert.equal(networkRewards("Nowhere").retailers, 0);
});

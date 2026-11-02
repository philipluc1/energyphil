import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteBlock } from "./leadInvite";

const now = new Date("2026-11-02T02:00:00Z");
test("invite rules", () => {
  assert.equal(inviteBlock([{ unsubscribed: false }], false, now), null);
  assert.match(inviteBlock([{ unsubscribed: false }, { unsubscribed: true }], false, now)!, /unsubscribed/);
  assert.match(inviteBlock([{ unsubscribed: false }], true, now)!, /member/);
  assert.match(inviteBlock([{ unsubscribed: false, invite_sent_at: "2026-10-25T00:00:00Z" }], false, now)!, /Already invited 8 days ago/);
  assert.equal(inviteBlock([{ unsubscribed: false, invite_sent_at: "2026-09-01T00:00:00Z" }], false, now), null);
  assert.match(inviteBlock([], false, now)!, /No result/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { afterRead, beforeRead, nextFreeDate } from "./freeReads";

const now = Date.parse("2026-11-01T10:00:00Z");
const ago = (min: number) => new Date(now - min * 60_000).toISOString();

test("first photo on a device is free", () => {
  assert.deepEqual(beforeRead({ priors: [], deviceReads: [], hasEmail: false, now }), { sameSession: false, block: null });
  assert.equal(afterRead({ priors: [], fuel: "electricity", sameSession: false, hasEmail: false }), null);
});

test("a second electricity photo on the device asks for an email; a gas one is still free", () => {
  const priors = [{ fuel: "electricity", created_at: ago(60 * 24) }];
  assert.equal(beforeRead({ priors, deviceReads: priors, hasEmail: false, now }).block, null);
  assert.equal(afterRead({ priors, fuel: "electricity", sameSession: false, hasEmail: false }), "needEmail");
  assert.equal(afterRead({ priors, fuel: "gas", sameSession: false, hasEmail: false }), null);
});

test("both fuels used: blocked before spending a read", () => {
  const priors = [{ fuel: "dual", created_at: ago(60 * 24) }];
  assert.equal(beforeRead({ priors, deviceReads: priors, hasEmail: false, now }).block, "needEmail");
  assert.equal(beforeRead({ priors, deviceReads: priors, hasEmail: true, now }).block, "quota");
});

test("page 2 within 30 minutes is the same sitting", () => {
  const priors = [{ fuel: "electricity", created_at: ago(5) }];
  const b = beforeRead({ priors, deviceReads: priors, hasEmail: false, now });
  assert.equal(b.sameSession, true);
  assert.equal(afterRead({ priors, fuel: "electricity", sameSession: b.sameSession, hasEmail: false }), null);
});

test("with an email, the quarter's electricity read used: quota, and the next date is 91 days on", () => {
  const priors = [{ fuel: "electricity", created_at: "2026-10-01T00:00:00Z" }];
  assert.equal(afterRead({ priors, fuel: "electricity", sameSession: false, hasEmail: true }), "quota");
  assert.equal(nextFreeDate(priors, "electricity")?.toISOString().slice(0, 10), "2026-12-31");
});

test("an email can't be cycled forever on one device", () => {
  const dev = [1, 2, 3, 4].map((d) => ({ fuel: "electricity", created_at: ago(60 * 24 * d) }));
  assert.equal(beforeRead({ priors: [], deviceReads: dev, hasEmail: true, now }).block, "quota");
});

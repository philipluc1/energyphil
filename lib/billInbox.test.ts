import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { forwardedVerdict, gmailConfirmation, localFromAddresses, newInboxLocal, pickBillAttachments, verifyWebhook } from "./billInbox";

test("address: first name then 8 safe characters", () => {
  const l = newInboxLocal("Sam", () => 0);
  assert.equal(l, "sam-22222222");
  assert.match(newInboxLocal(null), /^bills-[2-9a-z]{8}$/);
  assert.match(newInboxLocal("Zoë-Anne"), /^zoeanne-[2-9a-z]{8}$/);
});

test("finds the member's part of our address", () => {
  assert.equal(localFromAddresses(["other@x.com", "Sam <SAM-ab23cd45@bills.utilo.com.au>"], "bills.utilo.com.au"), "sam-ab23cd45");
  assert.equal(localFromAddresses(["sam-ab23cd45+agl@bills.utilo.com.au"], "bills.utilo.com.au"), "sam-ab23cd45");
  assert.equal(localFromAddresses(["sam@utilo.com.au"], "bills.utilo.com.au"), null);
});

test("webhook signature: right secret passes, tampering and old timestamps fail", () => {
  const secret = "whsec_" + Buffer.from("test-secret-key-123").toString("base64");
  const body = '{"type":"email.received"}';
  const id = "msg_1", ts = "1762300000";
  const sig = createHmac("sha256", Buffer.from("test-secret-key-123")).update(`${id}.${ts}.${body}`).digest("base64");
  const h = { id, timestamp: ts, signature: `v1,${sig}` };
  assert.equal(verifyWebhook(body, h, secret, 1762300010), true);
  assert.equal(verifyWebhook(body + " ", h, secret, 1762300010), false);
  assert.equal(verifyWebhook(body, h, secret, 1762300000 + 3600), false);
  assert.equal(verifyWebhook(body, { ...h, signature: `v1,abc v1,${sig}` }, secret, 1762300010), true);
  assert.equal(verifyWebhook(body, h, "whsec_" + Buffer.from("wrong").toString("base64"), 1762300010), false);
});

test("Gmail forwarding confirmation: code and link", () => {
  const g = gmailConfirmation("forwarding-noreply@google.com", "(#123456789) Gmail Forwarding Confirmation - Receive Mail from sam@gmail.com",
    "Confirmation code: 123456789\nTo allow ... click the link below to confirm:\nhttps://mail-settings.google.com/mail/vf-%5BANGjdJ_abc%5D-xyz\n");
  assert.equal(g?.code, "123456789");
  assert.match(g?.link ?? "", /^https:\/\/mail-settings\.google\.com\/mail\/vf-/);
  assert.equal(gmailConfirmation("billing@agl.com.au", "Your bill", "Confirmation code: 1234567"), null);
});

test("picks the bill PDF, skips logos", () => {
  const list = [
    { id: "logo", filename: "logo.png", content_type: "image/png", content_disposition: "inline", size: 8000 },
    { id: "terms", filename: "terms.pdf", content_type: "application/pdf", size: 90000 },
    { id: "bill", filename: "Electricity_Bill_Nov.pdf", content_type: "application/pdf", size: 300000 },
  ];
  assert.deepEqual(pickBillAttachments(list).map((a) => a.id), ["bill"]);
  assert.deepEqual(pickBillAttachments([{ id: "photo", filename: "IMG_1.jpg", content_type: "image/jpeg", size: 900000 }, list[0]]).map((a) => a.id), ["photo"]);
  assert.deepEqual(pickBillAttachments([list[0]]), []);
});

test("forwarded bill saved only when it's complete and for the member's meter", () => {
  const b = { fuel: "electricity", distributor: "Powercor", billingDays: 91, usageMode: "simple", anytimeKwh: 1012, nmi: "6203111111" };
  assert.equal(forwardedVerdict(b, "6203111111"), "save");
  assert.equal(forwardedVerdict({ ...b, looksPartial: true }), "partial");
  assert.equal(forwardedVerdict({ ...b, anytimeKwh: null }), "missing");
  assert.equal(forwardedVerdict(b, "6305999999"), "other-meter");
  assert.equal(forwardedVerdict({ fuel: "gas", gasDistributor: "Multinet", gasMj: 4000, billingDays: 60 }), "save");
});

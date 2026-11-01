import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFromAddress } from "./fromAddress";

test("a mistyped sender is tidied, a good one kept", () => {
  assert.equal(cleanFromAddress("info@utilo.com.au>"), "Utilo <info@utilo.com.au>");
  assert.equal(cleanFromAddress("Utilo <info@utilo.com.au>"), "Utilo <info@utilo.com.au>");
  assert.equal(cleanFromAddress('"Utilo <info@utilo.com.au>"'), "Utilo <info@utilo.com.au>");
  assert.equal(cleanFromAddress("info@utilo.com.au"), "Utilo <info@utilo.com.au>");
  assert.equal(cleanFromAddress("Utilo Alerts <alerts@utilo.com.au>"), "Utilo Alerts <alerts@utilo.com.au>");
  assert.equal(cleanFromAddress(""), "Utilo <onboarding@resend.dev>");
  assert.equal(cleanFromAddress("rubbish"), "Utilo <onboarding@resend.dev>");
});

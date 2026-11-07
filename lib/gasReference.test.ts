import { test } from "node:test";
import assert from "node:assert/strict";
import { withGasReference } from "./gasReference";

test("a stored total after a credit is replaced by rates x usage", () => {
  const row = { gas_reference_total: 42.65, gas_mj: 857.03, gas_billing_days: 28, gas_rates: { supply: 117.7, usage: 3.982 } };
  assert.equal(withGasReference(row).gas_reference_total, 67.08);
});
test("a stored total that agrees with the rates is kept (pay-on-time discount)", () => {
  const row = { gas_reference_total: 65.1, gas_mj: 857.03, gas_billing_days: 28, gas_rates: { supply: 117.7, usage: 3.982 } };
  assert.equal(withGasReference(row).gas_reference_total, 65.1);
});
test("no rates on file: nothing changes", () => {
  const row = { gas_reference_total: 41.52, gas_mj: 857, gas_billing_days: 28, gas_rates: null };
  assert.equal(withGasReference(row), row);
});

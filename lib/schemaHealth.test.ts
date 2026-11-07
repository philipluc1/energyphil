import { test } from "node:test";
import assert from "node:assert/strict";
import { columnFromError } from "./schemaHealth";

test("names the missing column in each PostgREST phrasing", () => {
  assert.equal(columnFromError("Could not find the 'gas_rates' column of 'subscribers' in the schema cache"), "gas_rates");
  assert.equal(columnFromError('column "gas_current_retailer" of relation "subscribers" does not exist'), "gas_current_retailer");
  assert.equal(columnFromError("column subscribers.demand_kw does not exist"), "demand_kw");
  assert.equal(columnFromError("permission denied"), null);
});

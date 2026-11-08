import { test } from "node:test";
import assert from "node:assert/strict";
import { columnFromError, RECENT_TABLES, RECENT_SUBSCRIBER_COLUMNS } from "./schemaHealth";
import { readFileSync } from "node:fs";

test("names the missing column in each PostgREST phrasing", () => {
  assert.equal(columnFromError("Could not find the 'gas_rates' column of 'subscribers' in the schema cache"), "gas_rates");
  assert.equal(columnFromError('column "gas_current_retailer" of relation "subscribers" does not exist'), "gas_current_retailer");
  assert.equal(columnFromError("column subscribers.demand_kw does not exist"), "demand_kw");
  assert.equal(columnFromError("permission denied"), null);
});

test("every table it checks is a table in schema.sql, and every column is added there", () => {
  const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  for (const t of RECENT_TABLES) assert.match(sql, new RegExp(`create table (if not exists )?public\\.${t}\\b`), t);
  for (const c of RECENT_SUBSCRIBER_COLUMNS) assert.match(sql, new RegExp(`\\b${c}\\b`), c);
  assert.ok(!RECENT_TABLES.includes("bill_inbox"));
});

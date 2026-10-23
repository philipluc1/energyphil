// Run: npx tsx --conditions=react-server lib/membership.test.ts
// A database missing a newer column must not cost the member their free check.
import assert from "node:assert/strict";
import { missingColumn } from "./membership";

assert.equal(missingColumn("Could not find the 'source' column of 'subscribers' in the schema cache"), "source");
assert.equal(missingColumn('column "alert_min_saving" of relation "subscribers" does not exist'), "alert_min_saving");
assert.equal(missingColumn("duplicate key value violates unique constraint"), null);
console.log("membership ok");

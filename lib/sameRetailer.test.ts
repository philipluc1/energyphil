import { test } from "node:test";
import assert from "node:assert/strict";
import { retailerKey, sameRetailer } from "./sameRetailer";

test("same retailer, however the bill spells it", () => {
  assert.equal(sameRetailer("Tango Energy", "Tango Energy"), true);
  assert.equal(sameRetailer("TANGO", "Tango Energy"), true);
  assert.equal(sameRetailer("Tango Energy Pty Ltd", "Tango Energy"), true);
  assert.equal(sameRetailer("Origin", "Origin Energy"), true);
  assert.equal(sameRetailer("EnergyAustralia", "Energy Australia"), true);
  assert.equal(retailerKey("AGL"), "agl");
});

test("different or unknown retailers are not the same", () => {
  assert.equal(sameRetailer("AGL", "Origin Energy"), false);
  assert.equal(sameRetailer("Red Energy", "Lumo Energy"), false);
  assert.equal(sameRetailer(null, "Tango Energy"), false);
  assert.equal(sameRetailer("", ""), false);
  assert.equal(sameRetailer("Energy", "Power"), false);
});

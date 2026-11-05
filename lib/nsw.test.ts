import { test } from "node:test";
import assert from "node:assert/strict";
import { DMO, nswStandardYear, nswVsDmo } from "./nsw";

test("single-rate plan priced at the network's DMO usage", () => {
  const p = { supply: 1, anytime: 0.4, peak: null, shoulder: null, offpeak: null };
  assert.equal(nswStandardYear(p, "Ausgrid"), 365 + 0.4 * DMO.Ausgrid.kwh);
  const pct = nswVsDmo(p, "Ausgrid")!;
  assert.ok(Math.abs(pct - ((365 + 1560) / 1899 - 1)) < 1e-9);
});

test("time-of-use waits for the AER split", () => {
  assert.equal(nswVsDmo({ supply: 1, anytime: null, peak: 0.5, shoulder: 0.3, offpeak: 0.2 }, "Endeavour Energy"), null);
});

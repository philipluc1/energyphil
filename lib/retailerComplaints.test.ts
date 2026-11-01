import { test } from "node:test";
import assert from "node:assert/strict";
import { complaintBand, reviewsUrl } from "./retailerComplaints";

const t = { A: 2, B: 6, C: 8, D: 9, E: 10, F: 14, G: 20 };

test("bands against the middle rate", () => {
  assert.equal(complaintBand("A", t)?.band, "low");
  assert.equal(complaintBand("D", t)?.band, "average");
  assert.equal(complaintBand("G", t)?.band, "high");
  assert.equal(complaintBand("D", t)?.median, 9);
});

test("no figure, or too few retailers, shows nothing", () => {
  assert.equal(complaintBand("Z", t), null);
  assert.equal(complaintBand("A", { A: 1, B: 2 }), null);
  assert.equal(complaintBand("A", {}), null);
});

test("reviews link is a search, not copied ratings", () => {
  assert.match(reviewsUrl("Red Energy"), /^https:\/\/www\.google\.com\/search\?q=Red%20Energy%20energy%20reviews$/);
});

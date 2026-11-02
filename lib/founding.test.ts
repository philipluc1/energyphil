import { test } from "node:test";
import assert from "node:assert/strict";
import { isFoundingAmount, perWeekWords, priceFor, timesPrice } from "./pricingPlans";

test("founding members are those on a special price of their plan", () => {
  assert.equal(isFoundingAmount("annual", 4500), true);
  assert.equal(isFoundingAmount("annual", 3900), true); // joined at the first special price
  assert.equal(isFoundingAmount("monthly", 700), true);
  assert.equal(isFoundingAmount("annual", 5500), false);
  assert.equal(isFoundingAmount("quarterly", 1800), false);
});

test("a founder switching plans pays the founding price, never more than list", () => {
  assert.equal(priceFor("annual", true), 4500);
  assert.equal(priceFor("monthly", true), 700);
});

test("N times the price: shown from 2x up", () => {
  assert.equal(timesPrice(450), "10");
  assert.equal(timesPrice(119), "2.6");
  assert.equal(timesPrice(60), null);
});

test("per week, in words", () => {
  assert.equal(perWeekWords(), "under $1 a week"); // $45 a year is 87c a week
});

import { foundingLine, regularPrice } from "./pricingPlans";
test("regular prices show struck through during the founding offer", () => {
  assert.equal(regularPrice("annual"), 5500);
  assert.equal(regularPrice("monthly"), 900);
  assert.equal(regularPrice("quarterly"), null);
  assert.match(foundingLine(), /New Year special: \$45 a year \(regular \$55\) or \$7 a month \(regular \$9\) when you join before 1 February 2027/);
});

import { foundingOpenAt, listPriceNow } from "./pricingPlans";
test("the New Year special ends at midnight on 1 Feb 2027, Melbourne time", () => {
  assert.equal(foundingOpenAt(Date.parse("2027-01-31T12:59:59Z")), true);
  assert.equal(foundingOpenAt(Date.parse("2027-01-31T13:00:00Z")), false);
  assert.equal(listPriceNow("annual", Date.parse("2027-01-15T00:00:00Z")), 4500);
  assert.equal(listPriceNow("annual", Date.parse("2027-02-02T00:00:00Z")), 5500);
  assert.equal(listPriceNow("monthly", Date.parse("2027-02-02T00:00:00Z")), 900);
});

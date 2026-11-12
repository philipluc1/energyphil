import { test } from "node:test";
import assert from "node:assert/strict";
import { averageStars, parseTestimonial } from "./testimonials";

test("testimonials: form checks and the average", () => {
  const ok = parseTestimonial({ name: " Sarah  M. ", place: "Geelong", stars: "5", body: "Saved us $300 on gas.", source: "Google", review_date: "2026-11-20" });
  assert.equal(ok.ok, true);
  if (ok.ok) { assert.equal(ok.value.name, "Sarah M."); assert.equal(ok.value.stars, 5); }
  assert.equal(parseTestimonial({ name: "A", stars: 6, body: "Fine service here" }).ok, false);
  assert.equal(parseTestimonial({ name: "A", stars: 4, body: "ok" }).ok, false);
  assert.equal(parseTestimonial({ name: "A", stars: 3, body: "Good enough service", source: "Fake" }).ok, true);
  assert.equal(averageStars([{ stars: 5 }, { stars: 4 }, { stars: 4 }]), 4.3);
  assert.equal(averageStars([]), null);
});

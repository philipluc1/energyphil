// Run: npx tsx --conditions=react-server lib/attribution.test.ts
// Source cookie parsing, referral codes, and the owner dashboard's launch funnel.
import assert from "node:assert/strict";
import { cleanCode, cleanReferralCode, formatSource, parseSource, sourceFromUtm, sourceLabel, sourceValue } from "./attribution";
import { computeFunnelStats } from "./dashboardStats";
import { isMeaningfullyCheaper } from "./priceWatch";

// Partner, referral and ad sources round-trip.
assert.deepEqual(parseSource("p:sample"), { kind: "partner", code: "sample" });
assert.deepEqual(parseSource(encodeURIComponent("r:ABC234")), { kind: "referral", code: "ABC234" });
assert.equal(formatSource({ kind: "ad", code: "facebook/cpc/launch" }), "u:facebook/cpc/launch");
assert.equal(sourceValue("u:Facebook/CPC/Launch Week"), "u:facebook/cpc/launch-week");
// Junk is ignored.
assert.equal(parseSource("x:hello"), null);
assert.equal(parseSource("r:abc"), null); // too short
assert.equal(parseSource("r:ABCD10"), null); // 1 and 0 aren't in the alphabet
assert.equal(parseSource("p:<script>")?.code, "script");
assert.equal(cleanCode("  Some Council!! "), "some-council");
assert.equal(cleanReferralCode("abc234"), "ABC234");
assert.equal(cleanReferralCode("ABCI23"), null);
// utm parameters.
assert.deepEqual(sourceFromUtm(new URLSearchParams("utm_source=Google&utm_medium=cpc")), { kind: "ad", code: "google/cpc" });
assert.equal(sourceFromUtm(new URLSearchParams("ref=x")), null);
// Labels.
assert.equal(sourceLabel(null), "Direct or unknown");
assert.equal(sourceLabel("p:sample", () => "Sample Community Group"), "Partner: Sample Community Group");
assert.equal(sourceLabel("r:ABC234"), "A member's referral");

// The funnel: windows, conversion and sources.
const now = new Date("2026-12-15T00:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const events = [
  { created_at: ago(1), event: "check_started", source: "p:sample" },
  { created_at: ago(1), event: "check_completed", source: "p:sample" },
  { created_at: ago(2), event: "check_completed", source: null },
  { created_at: ago(20), event: "check_completed", source: "r:ABC234" },
  { created_at: ago(40), event: "check_completed", source: null },
  { created_at: ago(40), event: "unlock_clicked", source: null },
];
const members = [
  { created_at: ago(3), status: "active", source: "p:sample" },
  { created_at: ago(45), status: "canceled", source: null },
];
const f = computeFunnelStats(events, members, now, () => "Sample Community Group");
assert.equal(f.windows[0].completed, 2); // last 7 days
assert.equal(f.windows[0].members, 1);
assert.equal(f.windows[0].conversion, 0.5);
assert.equal(f.windows[1].completed, 3); // last 30 days
assert.equal(f.windows[2].completed, 4); // since launch
assert.equal(f.windows[2].joinClicks, 1);
assert.equal(f.windows[2].conversion, 0.5);
const partnerRow = f.bySource.find((r) => r.label === "Partner: Sample Community Group")!;
assert.deepEqual([partnerRow.completed, partnerRow.members], [1, 1]);
assert.equal(f.checkpoints[0].actual, 4);
assert.equal(f.checkpoints[0].met, false);
assert.equal(f.checkpoints[1].met, true); // 50% ≥ 2.5%
assert.equal(f.checkpoints[2].actual, 1); // active members only
assert.equal(computeFunnelStats([], [], now).windows[2].conversion, null);

// Members' own alert minimum.
assert.equal(isMeaningfullyCheaper(100, 110, 91), false); // ~$40 a year < $50 default
assert.equal(isMeaningfullyCheaper(100, 110, 91, 25), true); // ≥ $25
assert.equal(isMeaningfullyCheaper(100, 130, 91, 200), false); // ~$120 < $200
assert.equal(isMeaningfullyCheaper(100, 110, 91, Number.NaN), false); // bad value → default

console.log("attribution ok");

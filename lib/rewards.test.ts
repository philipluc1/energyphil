import { test } from "node:test";
import assert from "node:assert/strict";
import { rewardFromIncentive, rewardFromDiscount, rewardsIn } from "./rewards";
import type { PlanExtras } from "./planExtras";

const inc = (name: string, category: "GIFT" | "ACCOUNT_CREDIT" | "OTHER" = "OTHER", description: string | null = null) => ({ name, category, description, eligibility: null });

test("credits read the dollar figure from the name or the description", () => {
  assert.equal(rewardFromIncentive(inc("Once Off First Bill $200"))?.headline, "$200 credit");
  assert.equal(rewardFromIncentive(inc("$150 sign up credit", "ACCOUNT_CREDIT"))?.headline, "$150 credit");
  const r = rewardFromIncentive(inc("Once Off Join and Stay - $260", "OTHER", "If you're a new or moving customer, your offer includes a one-off credit, applied to your next bill 90 days from start."));
  assert.equal(r?.kind, "credit");
  assert.equal(r?.value, 260);
  assert.match(r?.detail ?? "", /90 days/);
});

test("points name the scheme and the number", () => {
  assert.equal(rewardFromIncentive(inc("10,000 Sign-up Velocity Points", "GIFT"))?.headline, "10,000 Velocity points");
  assert.equal(rewardFromIncentive(inc("Qantas Points"))?.headline, "Qantas points");
  const v = rewardFromIncentive(inc("Velocity Reward Points", "OTHER", "You'll receive an upfront bonus of 5,000 Velocity Points, and then 2 Velocity Points for every dollar"));
  assert.equal(v?.headline, "5,000 Velocity points");
});

test("gifts keep their name; non-rewards are left out", () => {
  assert.equal(rewardFromIncentive(inc("Bonus $100 Prepaid Visa Card", "GIFT"))?.headline, "$100 Prepaid Visa Card");
  assert.equal(rewardFromIncentive(inc("Bonus $100 Prepaid Visa Card", "GIFT"))?.kind, "gift");
  for (const n of ["Refer a Friend Credit", "Solar feed-in tariffs", "Contributions to BCNA", "100% GreenPower as standard", "PowerResponse program rebate"]) {
    assert.equal(rewardFromIncentive(inc(n, n.startsWith("Refer") ? "ACCOUNT_CREDIT" : "OTHER")), null, n);
  }
});

test("discounts say whether they're in the price", () => {
  const pot = rewardFromDiscount({ name: "5% pay on time", type: "CONDITIONAL", category: "PAY_ON_TIME", method: "percentOfBill", rate: 0.05, amount: null, threshold: null, endDate: null, description: null });
  assert.equal(pot?.headline, "5% off the bill");
  assert.equal(pot?.inPrice, true);
  assert.equal(rewardFromDiscount({ name: "old", type: "GUARANTEED", category: null, method: "percentOfUse", rate: 0.1, amount: null, threshold: null, endDate: "2020-01-01", description: null }), null);
});

test("rewardsIn puts credits first and drops duplicates", () => {
  const x = { discounts: [], incentives: [inc("Qantas Points"), inc("$150 sign up credit", "ACCOUNT_CREDIT"), inc("$150 sign up credit", "OTHER")], fees: [], eligibility: [], payment: [], term: null, benefitPeriod: null, coolingOffDays: null, onExpiry: null, termsUrl: null, eligibilityUrl: null } as PlanExtras;
  assert.deepEqual(rewardsIn(x).map((r) => r.headline), ["$150 credit", "Qantas points"]);
});

test("fixed-dollar sign-up discounts count as credits; referrals don't", () => {
  const base = { type: "CONDITIONAL" as const, category: "OTHER" as const, method: "fixedAmount" as const, rate: null, threshold: null, endDate: null };
  const ps = rewardFromDiscount({ ...base, name: "Conditional Discount", amount: 200, description: "$200 sign up credit is available to residential customers who have not held a contract in 12 months" });
  assert.equal(ps?.kind, "credit");
  assert.equal(ps?.headline, "$200 credit");
  assert.equal(rewardFromDiscount({ ...base, name: "Referral Discount", amount: 33, description: "Refer someone to sign up" }), null);
});

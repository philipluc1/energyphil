// Run: npx tsx lib/planExtras.test.ts
// Discounts and eligibility in pricing, with made-up offers (not real retailer data).
import assert from "node:assert/strict";
import { PLAN_EXTRAS_INDEX, PLAN_EXTRAS_LIST, describeOffer, extrasLoaded, restrictionFor, type PlanExtras } from "./planExtras";
import { PLANS, billDetail, bestPlan, computeBill, rankPlans, type PlanRow, type UsageInput } from "./plans";
import { computeGasBill, type GasPlanRow } from "./gasPlans";

const blank: PlanExtras = { discounts: [], incentives: [], fees: [], eligibility: [], payment: [], term: null, benefitPeriod: null, coolingOffDays: null, onExpiry: null, termsUrl: null, eligibilityUrl: null };
const add = (key: string, x: Partial<PlanExtras>) => { PLAN_EXTRAS_INDEX[key] = PLAN_EXTRAS_LIST.push({ ...blank, ...x }) - 1; };
const disc = (o: Partial<PlanExtras["discounts"][number]>) => ({ name: "Discount", type: "GUARANTEED" as const, category: null, method: "percentOfUse" as const, rate: null, amount: null, threshold: null, endDate: null, description: null, ...o });

const row = (retailer: string, plan: string, supply: number, anytime: number): PlanRow => [retailer, "Citipower", plan, "MARKET", supply, anytime, null, null, null, null, 0.05];
const u: UsageInput = { days: 90, peak: 0, shoulder: 0, offpeak: 0, anytime: 1000, cl: 0, solarExportKwh: 200 };
const base = (p: PlanRow) => computeBill(p, u, { discounts: false }) as number;

// 1. Guaranteed 5% off usage comes off the price.
const a = row("Test A", "Saver", 1, 0.3);
add("E|Test A|Saver", { discounts: [disc({ rate: 0.05 })] });
assert.ok(Math.abs((computeBill(a, u) as number) - (base(a) - 0.05 * 300)) < 1e-9);

// 2. Guaranteed 10% off the bill: after solar credits.
const b = row("Test B", "Bill off", 1, 0.3);
add("E|Test B|Bill off", { discounts: [disc({ method: "percentOfBill", rate: 0.1 })] });
assert.ok(Math.abs((computeBill(b, u) as number) - (base(b) - 0.1 * (90 + 300 - 10))) < 1e-9);

// 3. Pay-on-time and direct-debit discounts are priced (we assume you pay on time);
//    other conditions aren't. 4. Expired ones are ignored. 5. Fixed-dollar ones aren't priced.
const c = row("Test C", "Pay on time", 1, 0.3);
add("E|Test C|Pay on time", {
  discounts: [
    disc({ type: "CONDITIONAL", category: "PAY_ON_TIME", rate: 0.03 }),
    disc({ type: "CONDITIONAL", category: "DIRECT_DEBIT", method: "percentOfBill", rate: 0.02 }),
    disc({ type: "CONDITIONAL", category: "OTHER", rate: 0.1 }), // e.g. "take our gas too": not assumed
    disc({ rate: 0.2, endDate: "2020-01-01" }),
    disc({ method: "fixedAmount", amount: 50 }),
  ],
});
const dc = billDetail(c, u)!;
const onTime = 0.03 * 300 + 0.02 * (90 + 300 - 10);
assert.ok(Math.abs(dc.conditionalDiscount - onTime) < 1e-9);
assert.ok(Math.abs(dc.discount - onTime) < 1e-9);
assert.ok(Math.abs(dc.total - (base(c) - onTime)) < 1e-9);

// The customer's own rates are never discounted.
assert.equal(computeBill(a, u, { discounts: false }), base(a));

// 6. Members-only offers are listed but never the best. 7. "Existing customers" counts for their own retailer.
const real = PLANS.length;
const cheap = row("Test D", "Members deal", 0.1, 0.05);
const loyal = row("Test E", "Loyal", 0.2, 0.05);
PLANS.push(cheap, loyal);
add("E|Test D|Members deal", { eligibility: [{ type: "ORG_MEMBER", information: "Club X members", description: null }] });
add("E|Test E|Loyal", { eligibility: [{ type: "EXISTING_CUST", information: "Current customers", description: null }] });
const ranked = rankPlans("Citipower", u);
assert.equal(ranked[0].plan, cheap);
assert.equal(ranked[0].restricted, "Members only: Club X members");
assert.equal(ranked[1].restricted, "Existing customers only");
assert.notEqual(bestPlan("Citipower", u)?.plan, cheap);
assert.notEqual(bestPlan("Citipower", u)?.plan, loyal);
assert.equal(bestPlan("Citipower", u, { currentRetailer: "Test E" })?.plan, loyal);
PLANS.splice(real);

// 8. Before the feed's conditions load, the plan name still flags members-only offers.
const kogan = rankPlans("Citipower", { ...u, solarExportKwh: 0 }).find((m) => /members/i.test(m.plan[2]));
if (kogan) assert.equal(kogan.restricted, "Members only");

// 9. Plain words for the page.
add("E|Test F|Everything", {
  discounts: [disc({ rate: 0.04 }), disc({ type: "CONDITIONAL", category: "DIRECT_DEBIT", method: "percentOfBill", rate: 0.02 })],
  incentives: [{ name: "$75 welcome credit", category: "ACCOUNT_CREDIT", description: "On your first bill", eligibility: null }],
  fees: [{ type: "PAPER_BILL", term: "FIXED", amount: 1.75, rate: null, description: null }, { type: "EXIT", term: "1_YEAR", amount: 0, rate: null, description: null }],
  eligibility: [{ type: "ONLINE_ONLY", information: "Online", description: null }],
  payment: ["DIRECT_DEBIT"],
  term: "ONGOING",
  coolingOffDays: 10,
});
const o = describeOffer("E", "Test F", "Everything", "Citipower", { hasSolar: false });
assert.equal(o.restricted, null);
assert.deepEqual(o.discounts.map((l) => [l.text, l.tone]), [
  ["4% off usage charges: in our price, no conditions", "good"],
  ["2% off the bill: in our price (direct debit)", "good"],
]);
assert.deepEqual(o.chips.map((ch) => ch.text), ["4% off usage + 2% off the bill (direct debit) included", "Online only", "Direct debit only"]);
assert.equal(o.moreChips, 1); // the credit
assert.ok(o.needs.some((n) => n.text === "You must pay by direct debit"));
assert.ok(o.needs.some((n) => n.text === "Pay by direct debit to get the 2% off the bill (our price assumes you do)"));
// A discount with some other condition is shown, not priced.
add("E|Test H|Bundle", { discounts: [disc({ type: "CONDITIONAL", category: "OTHER", rate: 0.05, description: "If you also take our gas" })] });
const oh = describeOffer("E", "Test H", "Bundle", "Citipower", { hasSolar: false });
assert.deepEqual(oh.discounts.map((l) => [l.text, l.tone]), [["5% off usage charges: not in our price", "info"]]);
assert.deepEqual(oh.chips.map((ch) => ch.text), ["5% off usage with conditions"]);
assert.deepEqual(o.fees.map((f) => f.text), ["Paper bill fee: $1.75"]); // a $0 exit fee isn't worth a line
assert.deepEqual(o.contract.map((l) => l.text), ["No fixed contract term", "10-day cooling-off"]);
const none = describeOffer("E", "Nobody", "Nothing", "Citipower", { hasSolar: false });
assert.equal(none.found, false);
assert.equal(none.loaded, extrasLoaded);

// 10. Gas: guaranteed % off usage.
const g: GasPlanRow = ["Test G", "Multinet", "Gas saver", "MARKET", 0.8, [{ upTo: null, rate: 0.04 }], true];
const before = computeGasBill(g, { days: 90, mj: 4000 }) as number;
add("G|Test G|Gas saver", { discounts: [disc({ rate: 0.1 })] });
assert.ok(Math.abs((computeGasBill(g, { days: 90, mj: 4000 }) as number) - (before - 16)) < 1e-9);

// Free-text conditions: bundle-only, battery owners, solar owners.
const elig = (information: string) => ({ eligibility: [{ type: "OTHER", information, description: null }] }) as unknown as PlanExtras;
const home = { hasSolar: false, currentRetailer: null };
assert.equal(restrictionFor(elig("This contingent plan is available to residential customers when bundled with one of GloBird's eligible electricity plans"), "X", "Gas plan", home), "Only bundled with their other fuel");
assert.equal(restrictionFor(elig("Offer only available to customers with solar panels, battery, EV and smart meter."), "X", "Plan", { hasSolar: true, currentRetailer: null }), "Homes with a battery");
assert.equal(restrictionFor(elig("Offer only available to customers with solar panels."), "X", "Plan", home), "Homes with solar");
assert.equal(restrictionFor(elig("Offer only available to customers with solar panels."), "X", "Plan", { hasSolar: true, currentRetailer: null }), null);
assert.equal(restrictionFor(elig("This plan is available to residential customers. Other conditions apply."), "X", "Plan", home), null);

console.log("plan extras ok");

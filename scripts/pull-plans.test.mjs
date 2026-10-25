import assert from "node:assert/strict";
import { parsePlan } from "./pull-plans.mjs";
const tou = { electricityContract: { tariffPeriod: [{ rateBlockUType: "timeOfUseRates", dailySupplyCharges: "1.0842",
  timeOfUseRates: [{ type: "PEAK", rates: [{ unitPrice: "0.4028" }] }, { type: "OFF_PEAK", rates: [{ unitPrice: "0.1487" }] }, { type: "SHOULDER", rates: [{ unitPrice: "0.1911" }] }] }],
  controlledLoad: [{ singleRate: { rates: [{ unitPrice: "0.1869" }] } }], solarFeedInTariff: [{ singleTariff: { rates: [{ unitPrice: "0.01" }] } }] } };
assert.deepEqual(parsePlan(tou), { supply: 1.19262, anytime: null, peak: 0.44308, shoulder: 0.21021, offpeak: 0.16357, cl: 0.20559, solarFit: 0.01 });
const single = { electricityContract: { tariffPeriod: [{ rateBlockUType: "singleRate", dailySupplyCharges: "1.1658", singleRate: { rates: [{ unitPrice: "0.2907" }] } }] } };
assert.deepEqual(parsePlan(single), { supply: 1.28238, anytime: 0.31977, peak: null, shoulder: null, offpeak: null, cl: null, solarFit: null });
assert.equal(parsePlan({ electricityContract: { tariffPeriod: [{ rateBlockUType: "demandCharges", dailySupplyCharges: "1" }] } }), null);
// A single rate with a demand charge beside it can't be priced from kWh: left out, not priced without the demand charge.
const withDemand = { electricityContract: { tariffPeriod: [{ ...single.electricityContract.tariffPeriod[0], demandCharges: [{ amount: "0.3", measureUnit: "KW" }] }] } };
assert.equal(parsePlan(withDemand), null);
assert.equal(parsePlan({ ...single, displayName: "Origin Basic (Residential Demand)" }), null);
assert.notEqual(parsePlan({ ...single, displayName: "Origin Basic" }), null);
console.log("parser ok");
import { parseGasPlan } from "./pull-plans.mjs";
const gas = { gasContract: { tariffPeriod: [{ dailySupplyCharges: "0.85", singleRate: { rates: [{ unitPrice: "0.0412", volume: 50, period: "P1D", measureUnit: "MJ" }, { unitPrice: "0.0318", period: "P1D", measureUnit: "MJ" }] } }] } };
assert.deepEqual(parseGasPlan(gas), { supply: 0.935, blocks: [{ upTo: 50, rate: 0.04532 }, { upTo: null, rate: 0.03498 }], perDay: true });
console.log("gas parser ok");

// Duplicate bands (e.g. a free 11am-2pm window listed as a second OFF_PEAK) keep the higher rate.
const dup = { electricityContract: { tariffPeriod: [{ rateBlockUType: "timeOfUseRates", dailySupplyCharges: "1",
  timeOfUseRates: [{ type: "PEAK", rates: [{ unitPrice: "0.40" }] }, { type: "OFF_PEAK", rates: [{ unitPrice: "0" }] }, { type: "OFF_PEAK", rates: [{ unitPrice: "0.20" }] }] }] } };
assert.equal(parsePlan(dup).offpeak, 0.22);
console.log("duplicate band ok");

// A time-of-use plan that also carries a blank singleRate block is still time of use.
const touWithBlank = { electricityContract: { tariffPeriod: [{ ...tou.electricityContract.tariffPeriod[0], singleRate: { rates: [] } }] } };
assert.equal(parsePlan(touWithBlank).peak, 0.44308);
assert.equal(parsePlan(touWithBlank).anytime, null);
// No label at all: go by which block has rates.
const unlabelled = { electricityContract: { tariffPeriod: [{ dailySupplyCharges: "1", timeOfUseRates: [{ type: "PEAK", rates: [{ unitPrice: "0.4" }] }, { type: "OFF_PEAK", rates: [{ unitPrice: "0.2" }] }] }] } };
assert.equal(parsePlan(unlabelled).peak, 0.44);
console.log("time-of-use labels ok");

// Offer dates: a new offer gets "seen" today; a price change gets "priceChanged" today.
import { buildPlanDates } from "./pull-plans.mjs";
const terms = 'export const PLAN_DATES: Record<string, PlanDates> = {"AGL|Saver":{"from":"2026-07-01","updated":null,"seen":null,"priceChanged":null}};';
const prevPlans = 'export const PLANS: PlanRow[] = [["AGL","Citipower","Saver","MARKET",1,0.3,null,null,null,null,null]];';
const newRows = [["AGL", "Citipower", "Saver", "MARKET", 1, 0.28, null, null, null, null, null], ["GloBird Energy", "Citipower", "GloSave", "MARKET", 1, 0.25, null, null, null, null, null]];
const outSrc = buildPlanDates(terms, prevPlans, newRows, "2026-10-17");
const dates = JSON.parse(outSrc.match(/= (\{.*\});/)[1]);
assert.equal(dates["AGL|Saver"].from, "2026-07-01");
assert.equal(dates["AGL|Saver"].priceChanged, "2026-10-17");
assert.equal(dates["AGL|Saver"].seen, null);
assert.equal(dates["GloBird Energy|GloSave"].seen, "2026-10-17");
console.log("offer dates ok");

// Discounts, credits, fees and sign-up conditions.
import { parseExtras, buildExtras, writeExtrasSource, tidyText } from "./pull-plans.mjs";
const withTerms = {
  additionalInformation: { termsUri: "https://example.com/terms", eligibilityUri: "http://insecure.example.com" },
  electricityContract: {
    isFixed: false, pricingModel: "SINGLE_RATE", paymentOption: ["DIRECT_DEBIT", "BPAY", "DIRECT_DEBIT"], termType: "ONGOING", benefitPeriod: "12 months",
    coolingOffDays: 10, onExpiryDescription: "<p>After 12 months the discount ends.</p>",
    discounts: [
      { displayName: "Guaranteed discount", type: "GUARANTEED", category: "GUARANTEED_DISCOUNT", methodUType: "percentOfUse", percentOfUse: { rate: "0.05" } },
      { displayName: "Pay on time", type: "CONDITIONAL", category: "PAY_ON_TIME", methodUType: "percentOfBill", percentOfBill: { rate: "0.03" }, endDate: "2027-06-30T00:00:00Z", description: "Pay  in full\nby the due date" },
      { displayName: "Odd", type: "CONDITIONAL", methodUType: "somethingNew" },
    ],
    incentives: [{ displayName: "$50 welcome credit", category: "ACCOUNT_CREDIT", description: "Credited on your first bill.", eligibility: "New customers" }],
    fees: [{ type: "EXIT", term: "1_YEAR", amount: "0" }, { type: "PAPER_BILL", term: "FIXED", amount: "1.75", description: "Per bill" }, { type: "CC_PROCESSING", term: "PERCENT_OF_BILL", rate: "0.0095" }],
    eligibility: [{ type: "ONLINE_ONLY", information: "Manage your account online" }],
    tariffPeriod: [],
  },
};
const ex = parseExtras(withTerms);
assert.equal(ex.discounts.length, 2);
assert.deepEqual(ex.discounts[0], { name: "Guaranteed discount", type: "GUARANTEED", category: "GUARANTEED_DISCOUNT", method: "percentOfUse", rate: 0.05, amount: null, threshold: null, endDate: null, description: null });
assert.equal(ex.discounts[1].rate, 0.03);
assert.equal(ex.discounts[1].endDate, "2027-06-30");
assert.equal(ex.discounts[1].description, "Pay in full by the due date");
assert.deepEqual(ex.payment, ["DIRECT_DEBIT", "BPAY"]);
assert.equal(ex.incentives[0].category, "ACCOUNT_CREDIT");
assert.deepEqual(ex.fees.map((f) => [f.type, f.amount, f.rate]), [["EXIT", 0, null], ["PAPER_BILL", 1.75, null], ["CC_PROCESSING", null, 0.0095]]);
assert.equal(ex.eligibility[0].type, "ONLINE_ONLY");
assert.equal(ex.term, "ONGOING");
assert.equal(ex.coolingOffDays, 10);
assert.equal(ex.onExpiry, "After 12 months the discount ends.");
assert.equal(ex.termsUrl, "https://example.com/terms");
assert.equal(ex.eligibilityUrl, null); // only https links are kept
assert.equal(parseExtras({ electricityContract: { tariffPeriod: [] } }).discounts.length, 0);
assert.equal(parseExtras({}), null);
assert.equal(tidyText("See [our terms](https://x.com) <b>now</b>"), "See our terms now");
// Shared entries: the usual extras for the plan, plus a network key only where one differs.
const other = { ...ex, discounts: [] };
const built = buildExtras([
  { fuel: "E", retailer: "AGL", plan: "Saver", network: "Citipower", extras: ex },
  { fuel: "E", retailer: "AGL", plan: "Saver", network: "Jemena", extras: ex },
  { fuel: "E", retailer: "AGL", plan: "Saver", network: "Powercor", extras: other },
  { fuel: "G", retailer: "AGL", plan: "Saver", network: "Multinet", extras: other },
]);
assert.equal(built.list.length, 2);
assert.equal(built.index["E|AGL|Saver"], 0);
assert.equal(built.index["E|AGL|Saver|Powercor"], 1);
assert.equal(built.index["E|AGL|Saver|Citipower"], undefined);
assert.equal(built.index["G|AGL|Saver"], 1);
const srcIn = 'x\nexport const PLAN_EXTRAS_DATE: string | null = null;\n\nexport const PLAN_EXTRAS_LIST: PlanExtras[] = [];\n\nexport const PLAN_EXTRAS_INDEX: Record<string, number> = {};\ny';
const srcOut = writeExtrasSource(srcIn, built, "2026-10-18");
assert.match(srcOut, /PLAN_EXTRAS_DATE: string \| null = "2026-10-18";/);
assert.equal(JSON.parse(srcOut.match(/PLAN_EXTRAS_INDEX: Record<string, number> = (.*);$/m)[1])["E|AGL|Saver|Powercor"], 1);
assert.equal(JSON.parse(srcOut.match(/PLAN_EXTRAS_LIST: PlanExtras\[\] = (.*);$/m)[1]).length, 2);
assert.ok(srcOut.startsWith("x\n") && srcOut.endsWith("\ny"));
console.log("offer conditions ok");

// Every retailer in the register: its organisations come as an object keyed by id.
import { registryTargets, registryDirectory, siteRetailerName, websiteOf, KNOWN } from "./pull-plans.mjs";
const reg = { data: { organisations: {
  1: { cdrCode: "kogan", orgName: "Kogan Energy", orgStatus: "active", websiteURL: "www.koganenergy.com.au", residentialContact: "1300 005 123" },
  2: { cdrCode: "globird", orgName: "Globird Energy", orgStatus: "active", websiteURL: "www.globirdenergy.com.au" },
  3: { cdrCode: "sumo-gas", orgName: "Sumo", orgStatus: "inactive", websiteURL: "www.sumo.com.au" },
  4: { cdrCode: "lumo", orgName: "Lumo Energy (NSW)", orgStatus: "active", websiteURL: "www.lumoenergy.com.au" },
  5: { cdrCode: "lumo", orgName: "Lumo Energy", orgStatus: "active", websiteURL: "www.lumoenergy.com.au" },
  6: { cdrCode: "future-x", orgName: "Sunswitch Energy Pty Ltd", orgStatus: "active", websiteURL: "sunswitchenergy.com.au/" },
  7: { cdrCode: "macarthur", orgName: "Macarthur Energy Retail", orgStatus: "active", websiteURL: "ww.macarthurenergy.com.au" },
  8: { orgName: "No code", orgStatus: "active" },
} } };
const t = registryTargets(reg);
assert.deepEqual(t.map((x) => [x.code, x.name]), [["future-x", "Sunswitch Energy"], ["globird", "GloBird Energy"], ["kogan", "Kogan Energy"], ["lumo", "Lumo Energy"], ["macarthur", "Macarthur Energy Retail"]]);
assert.deepEqual(registryTargets(reg, { knownOnly: true }).map((x) => x.code), ["globird", "kogan", "lumo"]);
assert.equal(registryDirectory(reg)["Kogan Energy"].website, "https://www.koganenergy.com.au");
assert.equal(registryDirectory(reg)["Kogan Energy"].phone, "1300 005 123");
assert.equal(websiteOf("ww.macarthurenergy.com.au"), "https://www.macarthurenergy.com.au");
assert.equal(websiteOf("www.amber.com.au/plan/energy-made-easy?x=1"), "https://www.amber.com.au");
assert.equal(websiteOf("Telstra.com"), "https://telstra.com");
assert.equal(websiteOf(""), null);
// Plans are named by their own brand (one CDR code can carry several).
assert.equal(siteRetailerName("1st Energy", "Cooperative Power", "energy-locals"), "1st Energy");
assert.equal(siteRetailerName(null, "Cooperative Power", "energy-locals"), "Cooperative Power");
assert.equal(siteRetailerName("Sumo Power", null, "sumo-power"), "Sumo");
assert.equal(siteRetailerName(undefined, undefined, "red-energy"), "Red Energy");
assert.equal(KNOWN["blue-nrg"], "Blue NRG");
console.log("all retailers ok");

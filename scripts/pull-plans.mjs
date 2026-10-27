#!/usr/bin/env node
// Pulls every current residential electricity plan for Victoria from the
// retailers' public Consumer Data Right (CDR) feeds and regenerates
// lib/plans.ts (rates), lib/gasPlans.ts, lib/planTerms.ts (fixed/variable and
// offer dates) and lib/planExtras.ts (discounts, credits, fees and sign-up
// conditions). No login or key is needed. Run by GitHub Actions every day
// (.github/workflows/pull-plans.yml) and by hand with:
//
//   node scripts/pull-plans.mjs            # every retailer in the register: fetch and rewrite lib/*.ts
//   node scripts/pull-plans.mjs --dry-run  # fetch and report, change nothing
//   node scripts/pull-plans.mjs --known    # only the KNOWN list below (a quick test)
//
// Endpoints (no auth):
//   registry:  https://api.energymadeeasy.gov.au/refdata2?keys=organisations
//   plan list: https://cdr.energymadeeasy.gov.au/{cdrCode}/cds-au/v1/energy/plans   (header x-v: 1)
//   plan:      https://cdr.energymadeeasy.gov.au/{cdrCode}/cds-au/v1/energy/plans/{planId}  (header x-v: 3)
// Feeds publish prices excluding GST; we store GST-inclusive dollars (see gst()). One request a second per retailer; retailers run in parallel.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLANS_TS = path.join(ROOT, "lib", "plans.ts");
const GAS_TS = path.join(ROOT, "lib", "gasPlans.ts");
const TERMS_TS = path.join(ROOT, "lib", "planTerms.ts");
// "Retailer|Plan name" for every plan whose CDR contract says isFixed: true.
const FIXED = new Set();
// When each offer took effect and was last updated, from the feed (CDR
// effectiveFrom / lastUpdated). Keyed "retailer|plan name".
const FEED_DATES = new Map();
const isoDay = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
function noteDates(retailerName, name, detail, p) {
  const key = `${retailerName}|${name}`;
  if (FEED_DATES.has(key)) return;
  FEED_DATES.set(key, {
    from: isoDay(detail.effectiveFrom ?? p.effectiveFrom),
    updated: isoDay(detail.lastUpdated ?? p.lastUpdated),
  });
}
const DATA_DIR = path.join(ROOT, "data");
const DRY = process.argv.includes("--dry-run");
const KNOWN_ONLY = process.argv.includes("--known");
const DIRECTORY_TS = path.join(ROOT, "lib", "retailerDirectory.ts");

// Every retailer in Energy Made Easy's register is pulled; retailers with no
// Victorian residential plans simply add no rows. KNOWN is the fallback list
// if the register can't be read, and gives the site's name for each CDR code
// (must match lib/retailerLinks.ts).
export const KNOWN = {
  agl: "AGL",
  alinta: "Alinta Energy",
  "blue-nrg": "Blue NRG",
  covau: "CovaU",
  dodo: "Dodo",
  energyaustralia: "EnergyAustralia",
  globird: "GloBird Energy",
  kogan: "Kogan Energy",
  lumo: "Lumo Energy",
  momentum: "Momentum Energy",
  origin: "Origin Energy",
  powershop: "Powershop",
  "red-energy": "Red Energy",
  "sumo-power": "Sumo",
  "sumo-gas": "Sumo",
  tango: "Tango Energy",
};

// Feed brand names that differ from the name the site uses (lower case → site name).
const NAME_FIX = {
  "globird energy": "GloBird Energy", globird: "GloBird Energy",
  "sumo power": "Sumo", "sumo gas": "Sumo", sumo: "Sumo",
  "blue nrg": "Blue NRG", bluenrg: "Blue NRG",
  "red energy": "Red Energy",
  "dodo power & gas": "Dodo", "dodo power and gas": "Dodo", dodo: "Dodo",
  "energy australia": "EnergyAustralia", energyaustralia: "EnergyAustralia",
  "agl energy": "AGL", agl: "AGL",
  origin: "Origin Energy", "origin energy": "Origin Energy",
  alinta: "Alinta Energy", "alinta energy": "Alinta Energy",
  lumo: "Lumo Energy", "lumo energy": "Lumo Energy",
  momentum: "Momentum Energy", "momentum energy": "Momentum Energy",
  powershop: "Powershop", "powershop australia": "Powershop",
  tango: "Tango Energy", "tango energy": "Tango Energy",
  kogan: "Kogan Energy", "kogan energy": "Kogan Energy",
  covau: "CovaU", "covau energy": "CovaU",
};

/** The name the site shows for a retailer: the plan's brand where the feed gives one. */
export function siteRetailerName(brandName, orgName, code) {
  const raw = String(brandName || KNOWN[code] || orgName || code || "")
    .replace(/\s*\((?:NSW|QLD|SA|VIC|ACT|TAS|Old)\)\s*$/i, "")
    .replace(/\s+Pty\.?\s*Ltd\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return NAME_FIX[raw.toLowerCase()] ?? raw;
}

/** A retailer's home page from the register's website field: https and the host only. */
export function websiteOf(v) {
  if (typeof v !== "string" || !v.trim()) return null;
  let host = v.trim().replace(/^https?:\/\//i, "").split(/[/?#]/)[0].toLowerCase();
  if (host.startsWith("ww.")) host = "w" + host;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? `https://${host}` : null;
}

/** Retailers to pull, one per CDR code, from the register (its organisations
 *  come as an object keyed by id, or as a list in older versions). */
export function registryTargets(registry, { knownOnly = false } = {}) {
  const raw = registry?.data?.organisations ?? registry?.organisations ?? [];
  const orgs = Array.isArray(raw) ? raw : Object.values(raw);
  const byCode = new Map();
  for (const o of orgs) {
    const code = typeof o?.cdrCode === "string" ? o.cdrCode.trim() : "";
    if (!code) continue;
    const status = String(o.orgStatus ?? o.status ?? "").toUpperCase();
    if (/INACTIVE|CLOSED|SUSPEND|REVOKED/.test(status)) continue;
    if (knownOnly && !KNOWN[code]) continue;
    if (!byCode.has(code)) byCode.set(code, { code, name: siteRetailerName(null, o.orgName ?? o.name, code), website: websiteOf(o.websiteURL), phone: o.residentialContact ?? null });
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** Website and phone by the site's retailer name, for every organisation in the register. */
export function registryDirectory(registry) {
  const raw = registry?.data?.organisations ?? registry?.organisations ?? [];
  const orgs = Array.isArray(raw) ? raw : Object.values(raw);
  const out = {};
  for (const o of orgs) {
    const name = siteRetailerName(null, o.orgName ?? o.name, o.cdrCode);
    if (!name || out[name]) continue;
    out[name] = { website: websiteOf(o.websiteURL), phone: typeof o.residentialContact === "string" ? o.residentialContact.trim() : null };
  }
  return out;
}

// The five Victorian networks, as the site names them, with the words the
// CDR feed uses for each (matched case-insensitively).
const VIC = [
  ["Citipower", ["citipower"]],
  ["Powercor", ["powercor"]],
  ["United Energy", ["united"]],
  ["Jemena", ["jemena"]],
  ["AusNet Services", ["ausnet"]],
];

// Victoria's gas networks, matched against the feed's distributor names.
const GAS_ZONES = [
  ["Australian Gas Networks", ["australian gas", "agn"]],
  ["Multinet", ["multinet"]],
  ["AusNet Services", ["ausnet"]],
];
function gasZones(plan) {
  const text = (plan.geography?.distributors ?? []).join(" ").toLowerCase();
  return GAS_ZONES.filter(([, words]) => words.some((w) => text.includes(w))).map(([name]) => name);
}

/** Gas: daily supply plus stepped usage blocks in $/MJ. */
export function parseGasPlan(detail) {
  const c = detail.gasContract;
  if (!c) return null;
  const period = (c.tariffPeriod ?? [])[0];
  if (!period) return null;
  const supply = num(period.dailySupplyCharges ?? period.dailySupplyCharge);
  const rates = period.singleRate?.rates;
  if (supply === null || !Array.isArray(rates) || !rates.length) return null;
  const perDay = String(rates[0].period ?? "P1D").toUpperCase().startsWith("P1D");
  const blocks = rates.map((r) => ({ upTo: r.volume === undefined || r.volume === null ? null : Number(r.volume), rate: num(r.unitPrice) }));
  if (blocks.some((b) => b.rate === null)) return null;
  // Rates are per MJ; a few feeds quote per kWh — convert (1 kWh = 3.6 MJ).
  const unit = String(rates[0].measureUnit ?? "MJ").toUpperCase();
  if (unit === "KWH") for (const b of blocks) { b.rate = b.rate / 3.6; if (b.upTo !== null) b.upTo = b.upTo * 3.6; }
  blocks[blocks.length - 1].upTo = null;
  // Add GST, like electricity.
  for (const b of blocks) b.rate = gst(b.rate);
  return { supply: gst(supply), blocks, perDay };
}

async function pullGasRetailer(cdrCode, orgName, log) {
  const base = `https://cdr.energymadeeasy.gov.au/${cdrCode}/cds-au/v1/energy/plans`;
  const plans = (await listPlans(`${base}?fuelType=GAS&type=ALL&effective=CURRENT`)).filter((p) => String(p.customerType ?? "RESIDENTIAL").toUpperCase() === "RESIDENTIAL" && gasZones(p).length > 0);
  const retailerName = siteRetailerName(plans[0]?.brandName, orgName, cdrCode);
  const rows = [];
  for (const p of plans) {
    await sleep(1000);
    let detail;
    try { detail = (await getJson(`${base}/${encodeURIComponent(p.planId)}`, 3)).data; } catch (e) { log(`  ${retailerName} gas: skipped ${p.planId} (${e.message})`); continue; }
    const g = parseGasPlan(detail);
    if (!g) continue;
    const name = String(detail.displayName ?? p.displayName ?? p.planId).replace(/\s+/g, " ").trim();
    const brand = siteRetailerName(detail.brandName ?? p.brandName, orgName, cdrCode);
    const offerType = String(p.type ?? detail.type ?? "MARKET").toUpperCase() === "STANDING" ? "STANDING" : "MARKET";
    noteDates(brand, name, detail, p);
    const extras = parseExtras(detail);
    for (const z of gasZones(detail.geography ? detail : p)) {
      rows.push([brand, z, name, offerType, g.supply, g.blocks, g.perDay]);
      if (extras) EXTRAS.push({ fuel: "G", retailer: brand, plan: name, network: z, extras });
    }
  }
  if (plans.length) log(`  ${retailerName} gas: ${plans.length} VIC residential plans listed, ${rows.length} rows priced`);
  return rows;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, version, attempt = 1) {
  const res = await fetch(url, { headers: { "x-v": String(version), accept: "application/json" } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(`${res.status} from ${url}`);
    await sleep(1500 * attempt);
    return getJson(url, version, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

/** Every plan in a retailer's list, following the feed's "next" links. */
async function listPlans(url) {
  const plans = [];
  let next = `${url}&page-size=1000`;
  for (let page = 0; next && page < 20; page++) {
    const body = await getJson(next, 1);
    plans.push(...(body.data?.plans ?? []));
    const link = body.links?.next;
    next = typeof link === "string" && link.startsWith("https://cdr.energymadeeasy.gov.au/") && link !== next ? link : null;
    if (next) await sleep(1000);
  }
  return plans;
}

/** Which VIC networks a plan applies to, from its geography block. */
function vicDistributors(plan) {
  const names = [...(plan.geography?.distributors ?? []), ...(plan.geography?.includedPostcodes ?? []).map(String)];
  const text = names.join(" ").toLowerCase();
  return VIC.filter(([, words]) => words.some((w) => text.includes(w))).map(([name]) => name);
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
/** Add 10% GST, rounded to 6 decimal places. */
export const gst = (v) => (v === null || v === undefined ? null : Math.round(v * 1.1 * 1e6) / 1e6);
const firstRate = (rates) => (Array.isArray(rates) && rates.length ? num(rates[0].unitPrice) : null);

/** Turn one CDR plan detail into the rate columns the site uses, or null if it can't be priced. */
export function parsePlan(detail) {
  const c = detail.electricityContract;
  if (!c) return null;
  const period = (c.tariffPeriod ?? [])[0];
  if (!period) return null;
  // Demand tariffs add a charge for the household's peak kW, on top of the
  // kWh rates. We keep the plan with that charge as $ per kW per day, and the
  // site prices it only for a home whose bill shows its max demand in kW
  // (everyone else never sees it). A plan that says "demand" in its name but
  // publishes no demand charge can't be priced fairly, so it's left out.
  const demandRate = parseDemand(c);
  if (demandRate === undefined) return null; // a demand charge we can't express per kW per day
  if (demandRate === null && /\bdemand\b/i.test(String(detail.displayName ?? ""))) return null;
  // Daily supply: dollars per day. Some feeds give it per period; CDR says per day.
  const supply = num(period.dailySupplyCharges ?? period.dailySupplyCharge);
  if (supply === null) return null;
  let anytime = null, peak = null, shoulder = null, offpeak = null;
  // Go by the feed's own label first: some time-of-use plans also carry a
  // (blank or leftover) singleRate block, and reading that first dropped
  // every time-of-use plan or priced it as single rate.
  const block = period.rateBlockUType ?? (period.timeOfUseRates?.length ? "timeOfUseRates" : period.singleRate ? "singleRate" : null);
  if (block === "singleRate") {
    anytime = firstRate(period.singleRate?.rates);
  } else if (block === "timeOfUseRates") {
    // Some plans list a short free or cheap window (e.g. "free 11am-2pm") as
    // a second band of the same type. Pricing all of that band's usage at the
    // free rate would overstate savings, so when a type appears twice we keep
    // the higher rate (the conservative choice).
    const keep = (prev, r) => (prev === null ? r : r === null ? prev : Math.max(prev, r));
    for (const t of period.timeOfUseRates ?? []) {
      const r = firstRate(t.rates);
      const type = String(t.type ?? "").toUpperCase();
      if (type === "PEAK") peak = keep(peak, r);
      else if (type.startsWith("SHOULDER")) shoulder = keep(shoulder, r);
      else if (type === "OFF_PEAK" || type === "OFFPEAK" || type === "SOLAR_SPONGE") offpeak = keep(offpeak, r);
    }
  } else {
    return null; // demand tariffs and anything else we can't price fairly
  }
  if (anytime === null && peak === null) return null;
  const cl = c.controlledLoad?.length ? firstRate(c.controlledLoad[0].singleRate?.rates) : null;
  let solarFit = null;
  for (const f of c.solarFeedInTariff ?? []) {
    const r = f.singleTariff?.rates ? firstRate(f.singleTariff.rates) : num(f.singleTariff?.amount);
    if (r !== null) { solarFit = r; break; }
  }
  // CDR prices exclude GST; the site shows what people actually pay, so add
  // 10% to everything except the solar feed-in credit (no GST on that).
  return { supply: gst(supply), anytime: gst(anytime), peak: gst(peak), shoulder: gst(shoulder), offpeak: gst(offpeak), cl: gst(cl), solarFit, demand: demandRate === null ? null : gst(demandRate) };
}

/**
 * The plan's demand charge as $ per kW per day (before GST): null when the
 * plan has none, undefined when it has one we can't convert (a kVA or
 * per-period charge, or a charge with no amount).
 */
export function parseDemand(c) {
  const charges = (c.tariffPeriod ?? []).flatMap((t) => t.demandCharges ?? []);
  if (charges.length === 0) return null;
  const d = charges[0];
  const amount = num(d.amount);
  const unit = String(d.measureUnit ?? "KW").toUpperCase();
  const per = String(d.chargePeriod ?? "DAY").toUpperCase();
  if (amount === null || unit !== "KW") return undefined;
  if (per === "DAY") return amount;
  if (per === "MONTH") return amount / 30.4;
  return undefined;
}

// ---------------------------------------------------------------------------
// Discounts, credits, fees and sign-up conditions (lib/planExtras.ts).

const EXTRAS_TS = path.join(ROOT, "lib", "planExtras.ts");
// One entry per fuel + retailer + network + plan name.
const EXTRAS = [];

/** Plain text: no HTML tags or markdown links, one line, at most n characters. */
export function tidyText(v, n = 240) {
  if (v === null || v === undefined) return null;
  const t = String(v)
    .replace(/<[^>]*>/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}
const url = (v) => (typeof v === "string" && /^https:\/\//i.test(v.trim()) ? v.trim() : null);
const oneOf = (v, list, fallback) => { const u = String(v ?? "").toUpperCase(); return list.includes(u) ? u : fallback; };

/** The offer's discounts, incentives, fees, eligibility and contract terms,
 *  from a CDR plan detail (electricity or gas). Amounts are kept as the
 *  retailer publishes them; percentages as fractions (0.03 = 3%). */
export function parseExtras(detail) {
  const c = detail?.electricityContract ?? detail?.gasContract;
  if (!c) return null;
  const discounts = [];
  for (const d of c.discounts ?? []) {
    const method = ["percentOfBill", "percentOfUse", "fixedAmount", "percentOverThreshold"].includes(d.methodUType) ? d.methodUType : null;
    if (!method) continue;
    const body = d[method] ?? {};
    discounts.push({
      name: tidyText(d.displayName, 80) ?? "Discount",
      type: oneOf(d.type, ["GUARANTEED", "CONDITIONAL", "OTHER"], "OTHER"),
      category: d.category ? oneOf(d.category, ["PAY_ON_TIME", "DIRECT_DEBIT", "GUARANTEED_DISCOUNT", "OTHER"], "OTHER") : null,
      method,
      rate: method === "fixedAmount" ? null : num(body.rate),
      amount: method === "fixedAmount" ? num(body.amount) : null,
      threshold: method === "percentOverThreshold" ? num(body.usageAmount) : null,
      endDate: isoDay(d.endDate),
      description: tidyText(d.description),
    });
  }
  const incentives = (c.incentives ?? []).map((i) => ({
    name: tidyText(i.displayName, 80) ?? "Incentive",
    category: oneOf(i.category, ["GIFT", "ACCOUNT_CREDIT", "OTHER"], "OTHER"),
    description: tidyText(i.description),
    eligibility: tidyText(i.eligibility, 160),
  }));
  const fees = (c.fees ?? []).map((f) => ({
    type: String(f.type ?? "OTHER").toUpperCase(),
    term: f.term ? String(f.term).toUpperCase() : null,
    amount: num(f.amount),
    rate: num(f.rate),
    description: tidyText(f.description, 200),
  }));
  const eligibility = (c.eligibility ?? []).map((e) => ({
    type: String(e.type ?? "OTHER").toUpperCase(),
    information: tidyText(e.information, 200),
    description: tidyText(e.description, 200),
  }));
  const info = detail.additionalInformation ?? {};
  return {
    discounts,
    incentives,
    fees,
    eligibility,
    payment: [...new Set((c.paymentOption ?? []).map((p) => String(p).toUpperCase()))],
    term: c.termType ? String(c.termType).toUpperCase() : null,
    benefitPeriod: tidyText(c.benefitPeriod, 160),
    coolingOffDays: Number.isFinite(Number(c.coolingOffDays)) && c.coolingOffDays !== null && c.coolingOffDays !== undefined ? Number(c.coolingOffDays) : null,
    onExpiry: tidyText(c.onExpiryDescription),
    termsUrl: url(info.termsUri),
    eligibilityUrl: url(info.eligibilityUri),
  };
}

/** Shared entries plus a lookup: "fuel|retailer|plan" for the plan's usual
 *  extras (the one most networks share), and "fuel|retailer|plan|network"
 *  only where a network differs. Keeps the file small. */
export function buildExtras(entries) {
  const list = [];
  const seen = new Map();
  const idOf = (x) => {
    const j = JSON.stringify(x);
    if (!seen.has(j)) { seen.set(j, list.length); list.push(x); }
    return seen.get(j);
  };
  const byPlan = new Map();
  for (const e of entries) {
    const k = `${e.fuel}|${e.retailer}|${e.plan}`;
    if (!byPlan.has(k)) byPlan.set(k, []);
    byPlan.get(k).push(e);
  }
  const index = {};
  for (const [k, es] of [...byPlan.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const counts = new Map();
    for (const e of es) { const id = idOf(e.extras); counts.set(id, (counts.get(id) ?? 0) + 1); }
    const usual = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    index[k] = usual;
    for (const e of es) { const id = idOf(e.extras); if (id !== usual) index[`${k}|${e.network}`] = id; }
  }
  return { list, index };
}

/** Rewrite the three generated lines in lib/planExtras.ts. */
export function writeExtrasSource(src, built, today) {
  return src
    .replace(/^export const PLAN_EXTRAS_DATE: string \| null = .*;$/m, `export const PLAN_EXTRAS_DATE: string | null = ${JSON.stringify(today)};`)
    .replace(/^export const PLAN_EXTRAS_LIST: PlanExtras\[\] = .*;$/m, () => `export const PLAN_EXTRAS_LIST: PlanExtras[] = ${JSON.stringify(built.list)};`)
    .replace(/^export const PLAN_EXTRAS_INDEX: Record<string, number> = .*;$/m, () => `export const PLAN_EXTRAS_INDEX: Record<string, number> = ${JSON.stringify(built.index)};`);
}

async function pullRetailer(cdrCode, orgName, log) {
  const base = `https://cdr.energymadeeasy.gov.au/${cdrCode}/cds-au/v1/energy/plans`;
  const plans = (await listPlans(`${base}?fuelType=ELECTRICITY&type=ALL&effective=CURRENT`)).filter((p) => {
    const ct = String(p.customerType ?? "RESIDENTIAL").toUpperCase();
    return ct === "RESIDENTIAL" && vicDistributors(p).length > 0;
  });
  const retailerName = siteRetailerName(plans[0]?.brandName, orgName, cdrCode);
  const rows = [];
  let skipped = 0;
  for (const p of plans) {
    await sleep(1000);
    let detail;
    try {
      detail = (await getJson(`${base}/${encodeURIComponent(p.planId)}`, 3)).data;
    } catch (e) {
      log(`  ${retailerName}: skipped ${p.planId} (${e.message})`);
      continue;
    }
    const rates = parsePlan(detail);
    if (!rates) { skipped++; continue; }
    const name = String(detail.displayName ?? p.displayName ?? p.planId).replace(/\s+/g, " ").trim();
    // One CDR code can carry several brands (e.g. energy-locals): name each plan by its own brand.
    const brand = siteRetailerName(detail.brandName ?? p.brandName, orgName, cdrCode);
    const offerType = String(p.type ?? detail.type ?? "MARKET").toUpperCase() === "STANDING" ? "STANDING" : "MARKET";
    if (detail.electricityContract?.isFixed === true) FIXED.add(`${brand}|${name}`);
    noteDates(brand, name, detail, p);
    const extras = parseExtras(detail);
    for (const d of vicDistributors(detail.geography ? detail : p)) {
      rows.push([brand, d, name, offerType, rates.supply, rates.anytime, rates.peak, rates.shoulder, rates.offpeak, rates.cl, rates.solarFit, rates.demand]);
      if (extras) EXTRAS.push({ fuel: "E", retailer: brand, plan: name, network: d, extras });
    }
  }
  if (plans.length) log(`  ${retailerName}: ${plans.length} VIC residential plans listed, ${rows.length} rows priced (${rows.filter((r) => r[6] !== null).length} time-of-use), ${skipped} plans skipped (demand charges or no usable rates)`);
  return rows;
}

/** Offer dates: the feed's own dates, plus when we first saw each offer and
 *  when its prices last changed (worked out by comparing with yesterday). */
export function buildPlanDates(termsSrc, previousPlansSrc, rows, today, previousGasSrc = "", gasRows = []) {
  const prevMatch = termsSrc.match(/export const PLAN_DATES: Record<string, PlanDates> = (\{.*?\});/s);
  const prevDates = prevMatch ? JSON.parse(prevMatch[1]) : {};
  const prevRowsMatch = previousPlansSrc.match(/^export const PLANS: PlanRow\[\] = (\[.*\]);$/m);
  const prevRows = prevRowsMatch ? JSON.parse(prevRowsMatch[1]) : [];
  const priceOf = (r) => JSON.stringify(r.slice(4));
  const prevGasMatch = previousGasSrc.match(/export const GAS_PLANS: GasPlanRow\[\] = (\[.*?\]);/s);
  const prevGas = prevGasMatch ? JSON.parse(prevGasMatch[1]) : [];
  const prevPrice = new Map([...prevRows, ...prevGas].map((r) => [`${r[0]}|${r[1]}|${r[2]}`, priceOf(r)]));
  const firstRun = prevRows.length === 0 || Object.keys(prevDates).length === 0;
  const changed = new Set();
  for (const r of [...rows, ...gasRows]) {
    const before = prevPrice.get(`${r[0]}|${r[1]}|${r[2]}`);
    if (before !== undefined && before !== priceOf(r)) changed.add(`${r[0]}|${r[2]}`);
  }
  const out = {};
  for (const key of new Set([...rows, ...gasRows].map((r) => `${r[0]}|${r[2]}`))) {
    const prev = prevDates[key];
    const feed = FEED_DATES.get(key) ?? {};
    out[key] = {
      from: feed.from ?? prev?.from ?? null,
      updated: feed.updated ?? prev?.updated ?? null,
      // On the very first run everything is "seen" today, so don't call it new.
      seen: prev ? prev.seen : firstRun ? null : today,
      priceChanged: changed.has(key) ? today : prev?.priceChanged ?? null,
    };
  }
  return termsSrc.replace(
    /export const PLAN_DATES: Record<string, PlanDates> = \{.*?\};/s,
    `export const PLAN_DATES: Record<string, PlanDates> = ${JSON.stringify(out)};`,
  );
}

async function main() {
  const log = (m) => console.log(m);
  // Every retailer in the register; the KNOWN list if the register can't be read.
  let registry = null;
  try {
    registry = await getJson("https://api.energymadeeasy.gov.au/refdata2?keys=organisations", 1);
  } catch (e) {
    log(`Register not available (${e.message}); using the KNOWN list.`);
  }
  let found = registry ? registryTargets(registry, { knownOnly: KNOWN_ONLY }) : [];
  if (found.length < 10) found = Object.entries(KNOWN).map(([code, name]) => ({ code, name, website: null, phone: null }));
  const targets = found.map((t) => [t.code, t.name]);
  log(`Pulling ${targets.length} retailers${DRY ? " (dry run)" : ""}…`);

  const results = await Promise.allSettled(targets.map(([code, name]) => pullRetailer(code, name, log)));
  const gasResults = await Promise.allSettled(targets.map(([code, name]) => pullGasRetailer(code, name, log)));
  const gasRows = [];
  gasResults.forEach((r, i) => { if (r.status === "fulfilled") gasRows.push(...r.value); else log(`  ${targets[i][1]} gas: FAILED (${r.reason?.message ?? r.reason})`); });
  const gasSeen = new Set();
  const gasUnique = gasRows.filter((r) => { const k = `${r[0]}|${r[1]}|${r[2]}`; if (gasSeen.has(k)) return false; gasSeen.add(k); return true; });
  gasUnique.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]));
  log(`${gasUnique.length} gas plan rows.`);

  const rows = [];
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") rows.push(...r.value);
    else { failed++; log(`  ${targets[i][1]}: FAILED (${r.reason?.message ?? r.reason})`); }
  });

  // One row per retailer + network + plan name.
  const seen = new Set();
  const unique = rows.filter((r) => { const k = `${r[0]}|${r[1]}|${r[2]}`; if (seen.has(k)) return false; seen.add(k); return true; });
  unique.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]));

  const current = fs.readFileSync(PLANS_TS, "utf8");
  const prevCount = (current.match(/^export const PLANS: PlanRow\[\] = (\[.*\]);$/m) ?? [, "[]"])[1].split("],[").length;
  log(`\n${unique.length} plan rows from ${new Set(unique.map((r) => r[0])).size} retailers (previous file: ${prevCount}). ${failed} retailer(s) failed.`);

  // Safety: never replace good data with a half-empty pull.
  if (unique.length < prevCount * 0.6) {
    console.error(`Refusing to write: only ${unique.length} rows vs ${prevCount} before. Check the feeds and try again.`);
    process.exit(2);
  }
  if (DRY) return;

  const today = new Date().toISOString().slice(0, 10);
  const header = current.slice(0, current.indexOf("export const PLAN_DATA_DATE"));
  const after = current.slice(current.indexOf("\n", current.indexOf("export const PLANS: PlanRow[] =")) + 1);
  const out =
    header.replace(/Auto-generated from live CDR pull, .*?\./, `Auto-generated from live CDR pull, ${today}.`) +
    `export const PLAN_DATA_DATE = "${today}";\n\n` +
    `export const PLANS: PlanRow[] = ${JSON.stringify(unique)};\n` +
    after;
  fs.writeFileSync(PLANS_TS, out);
  // Fixed vs variable prices, from each plan's CDR isFixed flag.
  const termsSrc = fs.readFileSync(TERMS_TS, "utf8")
    .replace(/export const PLAN_TERMS_DATE: string \| null = .*?;/, `export const PLAN_TERMS_DATE: string | null = "${today}";`)
    .replace(/export const FIXED_PLAN_KEYS: string\[\] = \[.*?\];/s, `export const FIXED_PLAN_KEYS: string[] = ${JSON.stringify([...FIXED].sort())};`);
  const gasBefore = fs.existsSync(GAS_TS) ? fs.readFileSync(GAS_TS, "utf8") : "";
  fs.writeFileSync(TERMS_TS, buildPlanDates(termsSrc, current, unique, today, gasBefore, gasUnique));
  log(`${FIXED.size} fixed-price plans.`);
  // Discounts, credits, fees and conditions, for the rows we kept.
  const keptElec = new Set(unique.map((r) => `${r[0]}|${r[1]}|${r[2]}`));
  const keptGas = new Set(gasUnique.map((r) => `${r[0]}|${r[1]}|${r[2]}`));
  const keptExtras = EXTRAS.filter((e) => (e.fuel === "E" ? keptElec : keptGas).has(`${e.retailer}|${e.network}|${e.plan}`));
  const built = buildExtras(keptExtras);
  fs.writeFileSync(EXTRAS_TS, writeExtrasSource(fs.readFileSync(EXTRAS_TS, "utf8"), built, today));
  const withDiscounts = built.list.filter((x) => x.discounts.length > 0).length;
  log(`${built.list.length} distinct sets of offer conditions (${withDiscounts} with discounts) for ${Object.keys(built.index).length} plan keys.`);
  // Retailer websites and phone numbers, for the "Go to" links of retailers
  // without a hand-checked link (lib/retailerLinks.ts).
  const directory = registry ? registryDirectory(registry) : {};
  const shown = [...new Set([...unique, ...gasUnique].map((r) => r[0]))].sort();
  const byCode = new Map(found.map((t) => [t.name, t]));
  const dirOut = Object.fromEntries(shown.map((n) => [n, directory[n] ?? { website: byCode.get(n)?.website ?? null, phone: byCode.get(n)?.phone ?? null }]));
  if (fs.existsSync(DIRECTORY_TS)) {
    const dsrc = fs.readFileSync(DIRECTORY_TS, "utf8")
      .replace(/export const RETAILER_DIRECTORY_DATE: string \| null = .*?;/, `export const RETAILER_DIRECTORY_DATE: string | null = "${today}";`)
      .replace(/export const RETAILER_DIRECTORY: Record<string, RetailerContact> = \{.*?\};/s, `export const RETAILER_DIRECTORY: Record<string, RetailerContact> = ${JSON.stringify(dirOut)};`);
    fs.writeFileSync(DIRECTORY_TS, dsrc);
  }
  log(`${shown.length} retailers shown: ${shown.join(", ")}`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `plans-${today}.json`), JSON.stringify({ pulled: today, rows: unique }, null, 0));
  // Gas file: same shape, only rewritten when the pull found something.
  if (gasUnique.length > 0) {
    const g = fs.readFileSync(GAS_TS, "utf8");
    const out2 = g
      .replace(/export const GAS_PLAN_DATA_DATE = ".*?";/, `export const GAS_PLAN_DATA_DATE = "${today}";`)
      .replace(/export const GAS_PLANS: GasPlanRow\[\] = \[.*?\];/s, `export const GAS_PLANS: GasPlanRow[] = ${JSON.stringify(gasUnique)};`);
    fs.writeFileSync(GAS_TS, out2);
    fs.writeFileSync(path.join(DATA_DIR, `gas-plans-${today}.json`), JSON.stringify({ pulled: today, rows: gasUnique }));
  }
  log(`Wrote lib/plans.ts, lib/gasPlans.ts and data/*-${today}.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

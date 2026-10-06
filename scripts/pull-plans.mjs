#!/usr/bin/env node
// Pulls every current residential electricity plan for Victoria from the
// retailers' public Consumer Data Right (CDR) feeds and regenerates
// lib/plans.ts. No login or key is needed. Run by GitHub Actions every day
// (.github/workflows/pull-plans.yml) and by hand with:
//
//   node scripts/pull-plans.mjs            # fetch and rewrite lib/plans.ts
//   node scripts/pull-plans.mjs --dry-run  # fetch and report, change nothing
//   node scripts/pull-plans.mjs --all      # every active retailer, not just the known list
//
// Endpoints (no auth):
//   registry:  https://api.energymadeeasy.gov.au/refdata2?keys=organisations
//   plan list: https://cdr.energymadeeasy.gov.au/{cdrCode}/cds-au/v1/energy/plans   (header x-v: 1)
//   plan:      https://cdr.energymadeeasy.gov.au/{cdrCode}/cds-au/v1/energy/plans/{planId}  (header x-v: 3)
// Rates are GST-inclusive dollars. One request a second per retailer; retailers run in parallel.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLANS_TS = path.join(ROOT, "lib", "plans.ts");
const DATA_DIR = path.join(ROOT, "data");
const DRY = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");

// Retailers we show by default. Keys are the CDR codes, values the name the
// site uses (must match lib/retailerLinks.ts). Add a line to add a retailer.
const KNOWN = {
  agl: "AGL",
  alinta: "Alinta Energy",
  bluenrg: "Blue NRG",
  covau: "CovaU",
  dodo: "Dodo",
  energyaustralia: "EnergyAustralia",
  globird: "GloBird Energy",
  kogan: "Kogan Energy",
  lumo: "Lumo Energy",
  momentum: "Momentum Energy",
  origin: "Origin Energy",
  powershop: "Powershop",
  red: "Red Energy",
  sumo: "Sumo",
  tango: "Tango Energy",
};

// The five Victorian networks, as the site names them, with the words the
// CDR feed uses for each (matched case-insensitively).
const VIC = [
  ["Citipower", ["citipower"]],
  ["Powercor", ["powercor"]],
  ["United Energy", ["united"]],
  ["Jemena", ["jemena"]],
  ["AusNet Services", ["ausnet"]],
];

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

/** Which VIC networks a plan applies to, from its geography block. */
function vicDistributors(plan) {
  const names = [...(plan.geography?.distributors ?? []), ...(plan.geography?.includedPostcodes ?? []).map(String)];
  const text = names.join(" ").toLowerCase();
  return VIC.filter(([, words]) => words.some((w) => text.includes(w))).map(([name]) => name);
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const firstRate = (rates) => (Array.isArray(rates) && rates.length ? num(rates[0].unitPrice) : null);

/** Turn one CDR plan detail into the rate columns the site uses, or null if it can't be priced. */
export function parsePlan(detail) {
  const c = detail.electricityContract;
  if (!c) return null;
  const period = (c.tariffPeriod ?? [])[0];
  if (!period) return null;
  // Daily supply: dollars per day. Some feeds give it per period; CDR says per day.
  const supply = num(period.dailySupplyCharges ?? period.dailySupplyCharge);
  if (supply === null) return null;
  let anytime = null, peak = null, shoulder = null, offpeak = null;
  if (period.rateBlockUType === "singleRate" || period.singleRate) {
    anytime = firstRate(period.singleRate?.rates);
  } else if (period.rateBlockUType === "timeOfUseRates" || period.timeOfUseRates) {
    for (const t of period.timeOfUseRates ?? []) {
      const r = firstRate(t.rates);
      const type = String(t.type ?? "").toUpperCase();
      if (type === "PEAK" && peak === null) peak = r;
      else if (type === "SHOULDER" && shoulder === null) shoulder = r;
      else if ((type === "OFF_PEAK" || type === "OFFPEAK") && offpeak === null) offpeak = r;
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
  return { supply, anytime, peak, shoulder, offpeak, cl, solarFit };
}

async function pullRetailer(cdrCode, retailerName, log) {
  const base = `https://cdr.energymadeeasy.gov.au/${cdrCode}/cds-au/v1/energy/plans`;
  const list = await getJson(`${base}?fuelType=ELECTRICITY&type=ALL&effective=CURRENT&page-size=1000`, 1);
  const plans = (list.data?.plans ?? []).filter((p) => {
    const ct = String(p.customerType ?? "RESIDENTIAL").toUpperCase();
    return ct === "RESIDENTIAL" && vicDistributors(p).length > 0;
  });
  const rows = [];
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
    if (!rates) continue;
    const name = String(detail.displayName ?? p.displayName ?? p.planId).replace(/\s+/g, " ").trim();
    const offerType = String(p.type ?? detail.type ?? "MARKET").toUpperCase() === "STANDING" ? "STANDING" : "MARKET";
    for (const d of vicDistributors(detail.geography ? detail : p)) {
      rows.push([retailerName, d, name, offerType, rates.supply, rates.anytime, rates.peak, rates.shoulder, rates.offpeak, rates.cl, rates.solarFit]);
    }
  }
  log(`  ${retailerName}: ${plans.length} VIC residential plans listed, ${rows.length} rows priced`);
  return rows;
}

async function main() {
  const log = (m) => console.log(m);
  const registry = await getJson("https://api.energymadeeasy.gov.au/refdata2?keys=organisations", 1);
  const orgs = (registry.organisations ?? registry.data?.organisations ?? []).filter((o) => o.cdrCode);
  const targets = ALL
    ? orgs.filter((o) => (o.status ?? "ACTIVE").toUpperCase() === "ACTIVE").map((o) => [o.cdrCode, KNOWN[o.cdrCode] ?? o.name ?? o.cdrCode])
    : Object.entries(KNOWN);
  log(`Pulling ${targets.length} retailers${DRY ? " (dry run)" : ""}…`);

  const results = await Promise.allSettled(targets.map(([code, name]) => pullRetailer(code, name, log)));
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
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `plans-${today}.json`), JSON.stringify({ pulled: today, rows: unique }, null, 0));
  log(`Wrote lib/plans.ts and data/plans-${today}.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

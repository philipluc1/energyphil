// Renders a sample monthly summary email to an HTML file, with made-up member
// details (not a real customer), so it can be checked before it goes out.
// Run: npx tsx --conditions=react-server scripts/preview-monthly-email.ts [out.html]

import fs from "node:fs";
import { renderEmail } from "../lib/email";
import { monthlyCheck } from "../lib/emailTemplates";
import { summaryFacts } from "../lib/monthlySummary";
import { computeBest } from "../lib/priceWatch";
import { activityWords, marketActivity } from "../lib/marketActivity";
import { DEFAULT_PROFILE } from "../lib/profileUsage";

const out = process.argv[2] || "monthly-summary-sample.html";
const now = new Date("2026-11-01T21:00:00Z");
const watch = { distributor: "Powercor" as const, billingDays: 91, peak: 0, shoulder: 0, offpeak: 0, anytime: 1010, cl: 0, solarExportKwh: 0 };
const best = computeBest(watch)!;
const reference = 412.35;
const facts = summaryFacts({
  network: watch.distributor,
  usage: { days: 91, peak: 0, shoulder: 0, offpeak: 0, anytime: 1010, cl: 0, solarExportKwh: 0 },
  reference,
  vsBill: true,
  rates: null,
  profile: { ...DEFAULT_PROFILE, people: 3, heating: "reverse_cycle", cooling: true, daytimeHome: "some" },
  ev: false,
  best: { retailer: best.bestRetailer, planName: best.bestPlanName, total: best.bestTotal },
  discountEndsAt: "2026-12-10",
  fixedUntil: null,
  now,
});
const act = marketActivity({ network: watch.distributor, days: 31 });
const e = monthlyCheck({
  origin: "https://www.utiloaustralia.com.au",
  monthName: "November",
  isJuly: false,
  retailer: best.bestRetailer,
  planName: best.bestPlanName,
  yearly: ((reference - best.bestTotal) * 365) / 91,
  unsubscribeUrl: "https://www.utiloaustralia.com.au/api/unsubscribe?type=subscriber&id=sample",
  activity: act.ready ? activityWords(act) || "8 new offers and 12 price changes" : "8 new offers and 12 price changes",
  activityCount: act.ready ? act.newOffers + act.priceChanges : 20,
  facts,
});
fs.writeFileSync(out, `<!-- Subject: ${e.subject} -->\n` + renderEmail({ title: e.title, bodyHtml: e.html }));
console.log("Subject:", e.subject);
console.log("Wrote", out);

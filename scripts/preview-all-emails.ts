// Renders every customer email with made-up details ("Sam Sample", not a real
// customer) so the whole set can be reviewed side by side.
// Run: npx tsx --conditions=react-server scripts/preview-all-emails.ts <out-dir>

import fs from "node:fs";
import path from "node:path";
import { renderEmail } from "../lib/email";
import * as T from "../lib/emailTemplates";
import { welcomeEmail } from "../lib/welcomeEmail";

const out = process.argv[2] || "email-previews";
fs.mkdirSync(out, { recursive: true });
const origin = "https://www.utilo.com.au";
const unsub = `${origin}/api/unsubscribe?type=lead&id=sample`;
const name = "Sam Sample";
const year = "JFMAMJJASOND".split("").map((label, i) => ({ label, best: 260 + Math.round(60 * Math.cos((i - 6) / 1.9)), now: 340 + Math.round(80 * Math.cos((i - 6) / 1.9)) }));

const list: { id: string; when: string; who: string; e: { subject: string; title: string; html: string } }[] = [
  { id: "01-result", when: "Straight after a free check (they asked for the result by email)", who: "Free check", e: T.resultEmail({ origin, retailer: "OVO Energy", planName: "The One Plan", yearly: 426, vsBill: true, unsubscribeUrl: unsub, name, nowYear: 1654, bestYear: 1228, runnersUp: [{ retailer: "OVO Energy", year: 1228 }, { retailer: "1st Energy", year: 1240 }, { retailer: "Sumo", year: 1268 }], usageLine: "1,012 kWh over 91 days (11.1 kWh a day)", network: "Powercor", marketChanges: 20, year }) },
  { id: "02-follow-up-day3", when: "3 days after the check, if they didn't join", who: "Free check", e: T.followUpMembership({ origin, unsubscribeUrl: unsub, name, retailer: "OVO Energy", nowYear: 1654, bestYear: 1228, vsBill: true }) },
  { id: "03-follow-up-day7", when: "7 days after the check, if they didn't join (last one)", who: "Free check", e: T.followUpWeek({ origin, retailer: "OVO Energy", planName: "The One Plan", yearly: 426, unsubscribeUrl: unsub, nowYear: 1654, bestYear: 1228, vsBill: true, name }) },
  { id: "04-invite", when: "When you press Send invite on the dashboard", who: "Free check", e: T.leadInvite({ origin, retailer: "OVO Energy", planName: "The One Plan", yearly: 426, unsubscribeUrl: unsub, checkedOn: "31 October", name }) },
  { id: "05-cheaper-lead", when: "Prices moved: a cheaper plan than their check found (they ticked price alerts)", who: "Free check", e: T.cheaperForLead({ origin, previousRetailer: "OVO Energy", retailer: "Sumo", planName: "Sumo Sunrise Plus", yearly: 112, unsubscribeUrl: unsub, prevYear: 1228, newYear: 1116, name }) },
  { id: "06-welcome", when: "The moment they join Plus", who: "Member", e: welcomeEmail({ origin, customerName: name, planName: "Yearly", priceLabel: "$45 a year", bestRetailer: "OVO Energy", bestPlanName: "The One Plan", yearlySaving: 426, fromBill: true, signInUrl: `${origin}/account` }) },
  { id: "07-sign-in", when: "When a member asks for a sign-in link", who: "Member", e: T.signInEmail({ origin, url: `${origin}/account`, name }) },
  { id: "08-cheaper-member", when: "A plan beats their pick by $50+ a year (checked every morning)", who: "Member", e: T.cheaperForMember({ origin, retailer: "Sumo", planName: "Sumo Sunrise Plus", yearly: 112, unsubscribeUrl: unsub, prevYear: 1228, newYear: 1116, prevRetailer: "OVO Energy", name }) },
  { id: "09-cheaper-gas", when: "A gas plan beats their gas pick by $50+ a year", who: "Member", e: T.cheaperGasForMember({ origin, retailer: "Alinta Energy", planName: "Gas Saver", yearly: 96, vsBill: true, unsubscribeUrl: unsub, prevYear: 1180, newYear: 1084, name }) },
  { id: "10-deal-ending", when: "A month before the discount or fixed price they told us about ends", who: "Member", e: T.dealEnding({ origin, what: "discount (or benefit period)", when: "2 December", daysLeft: 30, best: { retailer: "OVO Energy", planName: "The One Plan" }, yearly: 426, unsubscribeUrl: unsub, nowYear: 1654, bestYear: 1228, name }) },
  { id: "11-monthly", when: "1st of each month (short version; the full summary adds charts)", who: "Member", e: T.monthlyCheck({ origin, monthName: "November", isJuly: false, retailer: "OVO Energy", planName: "The One Plan", yearly: 426, unsubscribeUrl: unsub, activity: "8 new offers and 12 price changes", activityCount: 20, customerName: name, currentRetailer: "Tango Energy", nearTies: ["1st Energy"] }) },
  { id: "11b-monthly-same-retailer", when: "1st of each month, when the cheapest plan is with the retailer they're already with", who: "Member", e: T.monthlyCheck({ origin, monthName: "November", isJuly: false, retailer: "Tango Energy", planName: "eSelect", yearly: 212, unsubscribeUrl: unsub, activity: "8 new offers and 12 price changes", activityCount: 20, customerName: name, currentRetailer: "Tango Energy" }) },
  { id: "11c-switch-reminder", when: "The morning of the day they picked under Remind me (same retailer shown)", who: "Member", e: T.switchReminderEmail({ origin, name, retailer: "Tango Energy", planName: "eSelect", savingYear: 212, same: true, nmi: "6305123456" }) },
  { id: "12-renewal", when: "Two weeks before their membership renews", who: "Member", e: T.renewalRecap({ origin, name, daysWatched: 351, marketChanges: 240, network: "Powercor", switched: true, savedSoFar: 318, availableYear: null, renewsOn: "16 November", priceLabel: "$45 a year", founding: true, unsubscribeUrl: unsub, reviewLink: `${origin}/api/review?src=recap` }) },
  { id: "13-referral", when: "A friend joins with their referral link", who: "Member", e: T.referralCreditEmail({ origin, name }) },
  { id: "14-duplicate", when: "They paid twice by mistake (second one refunded)", who: "Member", e: T.duplicatePaymentEmail({ origin, name }) },
  { id: "17-review-switched", when: "3 weeks after they tell us they switched (needs the Google review link set)", who: "Member", e: T.reviewAsk({ origin, name, kind: "switched", url: `${origin}/api/review?src=switched`, switchedTo: "OVO Energy", unsubscribeUrl: unsub }) },
  { id: "18-review-member", when: "45 days after joining, if they haven't switched", who: "Member", e: T.reviewAsk({ origin, name, kind: "member", url: `${origin}/api/review?src=member`, daysWatched: 45, unsubscribeUrl: unsub }) },
  { id: "19-review-reminder", when: "Once, a week after the first ask, only if they didn't click", who: "Member", e: T.reviewAsk({ origin, name, kind: "reminder", url: `${origin}/api/review?src=reminder`, unsubscribeUrl: unsub }) },
  { id: "15-cancelled", when: "They cancel in Stripe's portal (it runs to the end of what they've paid for)", who: "Member", e: T.membershipCancelled({ origin, name, kind: "scheduled", endsOn: "16 November 2027", lockedPrice: "$45 a year", regularPrice: "$55 a year" }) },
  { id: "16-ended", when: "The membership stops straight away (cancelled now, or payments failed)", who: "Member", e: T.membershipCancelled({ origin, name, kind: "ended" }) },
];
const index = list.map(({ id, when, who, e }) => {
  fs.writeFileSync(path.join(out, `${id}.html`), renderEmail({ title: e.title, bodyHtml: e.html }));
  return { id, when, who, subject: e.subject, title: e.title, opens: /Hi (\w+),/.exec(e.html)?.[0] ?? "(no greeting)" };
});
fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(index, null, 2));
for (const r of index) console.log(r.id.padEnd(20), r.opens.padEnd(10), r.subject);

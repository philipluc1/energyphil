// Every customer email's wording, in one place. Each function returns the
// subject, the heading shown at the top of the card, and the body HTML; the
// branded shell (logo header, footer) is added by renderEmail in lib/email.ts.
// The welcome email lives in lib/welcomeEmail.ts. The sign-in link is sent by
// /api/login-link using signInEmail below (the Supabase templates in
// supabase/email-templates/ are only the fallback when that isn't set up).
//
// To change wording: edit the strings below, keep the ${...} parts.

import { esc } from "./email";
import { FREE_SHOWS_NAMES, PRICE_CHANGE_CLAUSE, WORTH_SWITCHING_PER_YEAR } from "./dataPolicy";
import { RETAILER_LINKS } from "./retailerLinks";
import { REFERRAL_CREDIT_CENTS, REFERRAL_FRIEND_CENTS, referralDollars } from "./referralOffer";
import { FOUNDING_OFFER, plusValue, timesPrice } from "./pricingPlans";
import { C, bigFigure, button, chips, columns, countdown, glance, glanceRow, hBars, heading, heroPanel, legend, miniBars, money, note, planCard, signOff, statRow, statusBox, step, steps, tiles, tip, unsubscribe, versus } from "./emailParts";
import type { SummaryFacts } from "./monthlySummary";
import { middayWorthIt } from "./monthlySummary";

export interface Email { subject: string; title: string; html: string }

const SWITCH_FACTS = ["About 10 minutes online", "Your power stays on", "10-day cooling-off"];
const retailerLink = (r: string) => (RETAILER_LINKS[r] ? { label: `See the plan on ${esc(r)}'s site`, url: RETAILER_LINKS[r] } : null);

/* ---------- 1. Your result (sent straight after a free check) ----------
   The cheapest plan by name (FREE_SHOWS_NAMES, 1 Nov 2026), the same as on
   the results page; then why Plus keeps watching. */
export function resultEmail(i: {
  origin: string;
  retailer: string;
  planName: string | null;
  yearly: number;          // saving a year vs the reference
  vsBill: boolean;         // reference is their own bill (else the default offer)
  unsubscribeUrl: string;
  sentLater?: boolean;     // the day-after fallback copy
  /** 1 Nov 2026: the fuller result. All optional, so older callers still work. */
  name?: string | null;
  nowYear?: number | null;     // what they pay a year (their bill, or the default offer)
  bestYear?: number | null;    // the cheapest plan, a year
  runnersUp?: { retailer: string; year: number }[];  // the next cheapest retailers
  usageLine?: string | null;   // "1,012 kWh over 91 days (11.1 kWh a day)"
  network?: string | null;
  marketChanges?: number;      // offers new or changed on their network in 30 days
  year?: { label: string; best: number; now: number }[];  // 12 months ahead, for the Plus preview
}): Email {
  const worth = i.yearly >= WORTH_SWITCHING_PER_YEAR;
  const v = plusValue();
  const subject = worth ? `Your result: about ${money(i.yearly)} a year` : "Your Utilo result";
  const title = worth ? (i.vsBill ? "You could pay less." : "Here's your result.") : "You're on a good deal.";
  const nowWord = i.vsBill ? "Your bill" : "Default offer";
  const card = worth
    ? planCard({
        kicker: "Cheapest for you",
        retailer: FREE_SHOWS_NAMES ? i.retailer : "Utilo Plus shows which retailer",
        planName: FREE_SHOWS_NAMES ? i.planName : "The plan name, rates and sign-up conditions are on your dashboard.",
        figure: { amount: i.yearly, after: i.vsBill ? "a year less than your bill." : "a year less than the default offer." },
        link: FREE_SHOWS_NAMES ? retailerLink(i.retailer) : { label: "Unlock the cheapest plans", url: `${i.origin}/pricing` },
      })
    : statusBox({ kicker: "Your result", headline: "Nothing beats it by enough to bother", body: `The cheapest plan we found saves less than ${money(WORTH_SWITCHING_PER_YEAR)} a year. Stay put.`, tone: "green" });

  // The numbers at a glance: what you pay, the cheapest, the saving.
  const stats = i.nowYear && i.bestYear
    ? statRow([
        { big: money(i.nowYear), small: `${nowWord}, a year`, tone: "navy" },
        { big: money(i.bestYear), small: "Cheapest plan, a year", tone: "green" },
        { big: money(Math.max(0, i.nowYear - i.bestYear)), small: "You'd save, a year", tone: "amber" },
      ])
    : "";

  // How the cheapest few compare with what you pay.
  const ranking = i.runnersUp && i.runnersUp.length && i.nowYear && FREE_SHOWS_NAMES
    ? `${heading("How the cheapest compare")}${hBars([
        ...i.runnersUp.slice(0, 4).map((r, n) => ({ label: `${n + 1}. ${esc(r.retailer)}`, value: r.year, color: n === 0 ? C.green : C.tealBright, text: money(r.year), strong: n === 0 })),
        { label: nowWord, value: i.nowYear, color: "#e8590c", text: money(i.nowYear), strong: true },
      ])}`
    : "";

  const facts = [
    i.usageLine ? `Priced on <strong>${esc(i.usageLine)}</strong>${i.network ? ` on the ${esc(i.network)} network` : ""}, with today's prices.` : "",
    i.marketChanges && i.marketChanges > 0 ? `Retailers made <strong>${i.marketChanges} new or changed offers</strong>${i.network ? ` on ${esc(i.network)}` : ""} in the last 30 days. Today's cheapest may not be next month's.` : "",
  ].filter(Boolean);

  // A taste of the dashboard: the year ahead, month by month, on the cheapest plan and on what they pay now.
  const preview = i.year && i.year.length === 12
    ? `${columns(i.year.map((m) => ({ parts: [{ value: m.best, color: C.green }, { value: Math.max(0, m.now - m.best), color: "#f4b183" }], label: m.label })), { height: 90 })}
       ${legend([{ color: C.green, label: "On the cheapest plan" }, { color: "#f4b183", label: `Extra on ${i.vsBill ? "your plan" : "the default offer"}` }])}`
    : "";

  const html = `
    <p>${i.name ? `Hi ${esc(i.name)},<br>` : ""}${i.sentLater ? "Here's your result from yesterday's check, so it's easy to find." : "Here's your result on today's prices, so it's easy to find later."}</p>
    ${stats}
    ${card}
    ${!i.vsBill && worth ? tip(`This is against the default offer. <strong>Snap your bill</strong> for your exact saving: <a href="${i.origin}/check">check again with a photo</a>.`) : ""}
    ${worth ? chips(SWITCH_FACTS) : ""}
    ${ranking}
    ${facts.length ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${C.grey};">${facts.join("<br>")}</p>` : ""}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 22px;border-collapse:separate;">
      <tr><td style="padding:22px 20px;border-radius:16px;background:${C.navy};">
        <div style="display:inline-block;padding:3px 10px;border-radius:999px;background:${C.amber};color:${C.amberInk};font:800 11px Arial,Helvetica,sans-serif;letter-spacing:0.6px;text-transform:uppercase;">Utilo Plus</div>
        <div style="margin:10px 0 4px;font:800 22px/1.25 Arial,Helvetica,sans-serif;color:#ffffff;">Stop paying the loyalty tax.</div>
        <div style="font:14px/1.55 Arial,Helvetica,sans-serif;color:#c9d0e6;">Discounts end and prices change. We watch your power and gas every day, from your own bill, and tell you when to move. Join and your dashboard sets itself up from this check.</div>
      </td></tr>
    </table>
    ${preview ? `${heading("A preview of your dashboard: your year ahead")}${preview}` : ""}
    ${tiles([
      { sym: "!", title: "Never miss a price jump", text: "A month's warning before your discount or fixed price ends.", tint: "amber" },
      { sym: "&#8635;", title: "Know the day it's cheaper", text: "Every plan re-checked against your bill, every morning.", tint: "teal" },
      { sym: "&#9993;", title: "Only emails that pay", text: `One email, when switching saves ${money(WORTH_SWITCHING_PER_YEAR)}+ a year.`, tint: "green" },
      { sym: "&#9638;", title: "One membership, every bill", text: "Power and gas now, more to come. Your dashboard tracks it all.", tint: "navy" },
    ])}
    ${statusBox({
      kicker: FOUNDING_OFFER ? "Founding member price" : "Utilo Plus",
      headline: `${v.annual} a year: ${v.perWeek} a week`,
      body: `${worth && timesPrice(i.yearly) ? `Your saving is <strong>${timesPrice(i.yearly)} times</strong> the yearly price. ` : ""}${FOUNDING_OFFER ? "Locked in while you stay. " : ""}Or ${v.monthly} month to month. Cancel any time. Not a cent from retailers.`,
      tone: "teal",
    })}
    ${button("Start Utilo Plus", `${i.origin}/pricing`)}
    ${note(`${esc(PRICE_CHANGE_CLAUSE)}`)}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you asked for your result by email.")}`;
  return { subject, title, html };
}

/* ---------- 2. Follow-up, day 3: what members get ---------- */
export function followUpMembership(i: { origin: string; unsubscribeUrl: string }): Email {
  const html = `
    ${heroPanel({ pill: "Utilo Plus", headline: "Cheapest today isn't cheapest forever.", body: "Retailers change their plans through the year, and most discounts end after the first year. We watch, so you don't have to." })}
    ${tiles([
      { sym: "!", title: "Never miss a price jump", text: "A month's warning before your discount or fixed price ends.", tint: "amber" },
      { sym: "&#8635;", title: "Know the day it's cheaper", text: "Every plan re-checked against your bill, every morning.", tint: "teal" },
      { sym: "&#9993;", title: "Only emails that pay", text: `One email, when switching saves ${money(WORTH_SWITCHING_PER_YEAR)}+ a year.`, tint: "green" },
      { sym: "&#9638;", title: "1 July re-check", text: "When retailers change their prices, we re-run everything.", tint: "navy" },
    ])}
    ${statRow([
      { big: plusValue().annual, small: FOUNDING_OFFER ? "a year, founding price" : "a year", tone: "green" },
      { big: plusValue().perWeek, small: "a week", tone: "navy" },
      { big: plusValue().monthly, small: "or month to month", tone: "amber" },
    ])}
    ${button("See Utilo Plus", `${i.origin}/pricing`)}
    <p style="margin:0 0 8px;font-size:13px;color:#5f6b82;">No lock-in: cancel any time. Not a cent from retailers.</p>
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you checked your plan with Utilo and asked for updates.")}`;
  return { subject: "Prices move. We can keep watching for you", title: "We watch, so you don't have to.", html };
}

/* ---------- 3. Follow-up, day 7: did you switch? ---------- */
export function followUpWeek(i: { origin: string; retailer: string | null; planName: string | null; yearly: number | null; unsubscribeUrl: string; nowYear?: number | null; bestYear?: number | null; vsBill?: boolean }): Email {
  // A year, not a week (1 Nov 2026): "$2 a week" undersold a $119 saving.
  const yearly = i.yearly && i.yearly >= WORTH_SWITCHING_PER_YEAR ? i.yearly : null;
  const html = `
    <p>${FREE_SHOWS_NAMES && i.retailer ? `A week ago we found a cheaper plan for you with ${esc(i.retailer)}${i.planName ? ` (&ldquo;${esc(i.planName)}&rdquo;)` : ""}.` : "A week ago we found a cheaper plan for you."} Utilo Plus re-checks it every morning and warns you before your discount ends: <a href="${i.origin}/pricing">$7 a month, or $39 a year</a>.</p>
    ${yearly && i.nowYear && i.bestYear
      ? versus({ before: { label: i.vsBill ? "Staying on your plan" : "The default offer", value: i.nowYear }, after: { label: FREE_SHOWS_NAMES && i.retailer ? `Switching to ${esc(i.retailer)}` : "Switching", value: i.bestYear }, gapLabel: "Staying put costs" })
      : yearly ? bigFigure({ figure: money(yearly), label: "Still on the old plan?", body: `What staying put costs you a year: about ${money(yearly / 12)} every month.`, tone: "amber" }) : ""}
    ${button("Check again with today's prices", `${i.origin}/check`)}
    <p>Already switched? Nice work. This is the last of these emails.</p>
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you checked your plan with Utilo and asked for updates.")}`;
  return {
    subject: yearly ? `Still on the old plan? That's about ${money(yearly)} a year` : "A week on: did you switch?",
    title: "A week on: did you switch?",
    html,
  };
}

/* ---------- 4. Cheaper plan found (member) ---------- */
export function cheaperForMember(i: { origin: string; retailer: string; planName: string; yearly: number; unsubscribeUrl: string; offerNote?: string | null; prevYear?: number | null; newYear?: number | null; prevRetailer?: string | null }): Email {
  const html = `
    ${heroPanel({ pill: "Cheaper plan found", headline: `About ${money(i.yearly)} a year less`, body: `Watching the market for you this morning, we found a plan that beats our last pick.${i.offerNote ? ` ${esc(i.offerNote)}` : ""}` })}
    ${i.prevYear && i.newYear ? versus({ before: { label: i.prevRetailer ? `Our last pick (${esc(i.prevRetailer)})` : "Our last pick", value: i.prevYear }, after: { label: esc(i.retailer), value: i.newYear }, gapLabel: "You'd save" }) : ""}
    ${planCard({ kicker: "New cheapest for you", retailer: i.retailer, planName: i.planName, figure: { amount: i.yearly, after: "a year cheaper than our last pick." }, link: retailerLink(i.retailer), tone: "green" })}
    ${button("See it on my dashboard", `${i.origin}/account#compare`)}
    ${chips(SWITCH_FACTS)}
    ${note(esc(PRICE_CHANGE_CLAUSE))}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel Utilo Plus; manage it from your dashboard.")}`;
  return { subject: `A cheaper plan just showed up: about ${money(i.yearly)} a year less`, title: "We found a cheaper plan.", html };
}

/* ---------- 4b. Cheaper gas plan found (member) ---------- */
export function cheaperGasForMember(i: { origin: string; retailer: string; planName: string; yearly: number; vsBill: boolean; unsubscribeUrl: string; prevYear?: number | null; newYear?: number | null }): Email {
  const html = `
    ${heroPanel({ pill: "Gas", headline: `A cheaper gas plan: about ${money(i.yearly)} a year less`, body: "Watching gas prices for you this morning, we found a gas plan that beats our last pick." })}
    ${i.prevYear && i.newYear ? versus({ before: { label: "Our last gas pick", value: i.prevYear }, after: { label: esc(i.retailer), value: i.newYear }, gapLabel: "You'd save" }) : ""}
    ${planCard({ kicker: "New cheapest gas plan for you", retailer: i.retailer, planName: i.planName, figure: { amount: i.yearly, after: i.vsBill ? "a year less than our last pick, based on your gas bill." : "a year less than our last pick." }, link: retailerLink(i.retailer), tone: "amber" })}
    ${button("See it on my dashboard", `${i.origin}/account`)}
    ${tip("Getting electricity from the same retailer? Ask about a dual-fuel discount when you switch.")}
    ${note(esc(PRICE_CHANGE_CLAUSE) + " Gas use swings with the seasons, so yearly figures are scaled from your bill.")}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel Utilo Plus; manage it from your dashboard.")}`;
  return { subject: `A cheaper gas plan just showed up: about ${money(i.yearly)} a year less`, title: "We found a cheaper gas plan.", html };
}

/* ---------- 5. Cheaper plan found (free user who opted in) ---------- */
export function cheaperForLead(i: { origin: string; previousRetailer: string | null; retailer: string; planName: string; yearly: number; unsubscribeUrl: string; offerNote?: string | null; prevYear?: number | null; newYear?: number | null }): Email {
  const html = `
    ${heroPanel({ pill: "Prices moved", headline: `Something cheaper: about ${money(i.yearly)} a year less`, body: "Prices have moved since you checked your plan, and there's now a cheaper one for a home like yours." })}
    ${i.prevYear && i.newYear && FREE_SHOWS_NAMES ? versus({ before: { label: i.previousRetailer ? `Your earlier best (${esc(i.previousRetailer)})` : "Your earlier best", value: i.prevYear }, after: { label: esc(i.retailer), value: i.newYear }, gapLabel: "Now cheaper by" }) : ""}
    ${planCard({ kicker: "New cheapest in your area", retailer: FREE_SHOWS_NAMES ? i.retailer : "Utilo Plus shows which retailer", planName: FREE_SHOWS_NAMES ? i.planName : "The plan, its rates and sign-up conditions are on your dashboard.", figure: { amount: i.yearly, after: "a year cheaper than your earlier best match." }, link: FREE_SHOWS_NAMES ? retailerLink(i.retailer) : { label: "Unlock the cheapest plans", url: `${i.origin}/pricing` }, tone: "amber" })}
    ${button("Check it with my bill", `${i.origin}/check`)}
    ${tip(`This is priced on the usage from your earlier check. Utilo Plus watches your own bill every morning and warns you before your discount ends: <a href="${i.origin}/pricing">$7 a month, or $39 a year</a>.`)}
    ${note(esc(PRICE_CHANGE_CLAUSE))}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you asked to be told about cheaper plans.")}`;
  return { subject: "A cheaper electricity plan just showed up in your area", title: "Prices moved in your favour.", html };
}

/* ---------- 6. Discount or fixed price ending (member) ---------- */
export function dealEnding(i: {
  origin: string;
  what: string;            // "discount (or benefit period)" | "fixed price"
  when: string;            // "12 November"
  daysLeft: number;
  best: { retailer: string; planName: string } | null;
  yearly: number | null;   // best vs their last bill
  unsubscribeUrl: string;
  /** Their plan now and the cheapest, a year, when we know both. */
  nowYear?: number | null;
  bestYear?: number | null;
}): Email {
  const short = i.what.startsWith("discount") ? "discount" : "fixed price";
  const html = `
    ${countdown(i.daysLeft, `Your ${esc(short)} ends ${esc(i.when)}`, "Prices often go up when that happens. Here's where you stand today.")}
    ${i.nowYear && i.bestYear && i.best && i.nowYear - i.bestYear >= WORTH_SWITCHING_PER_YEAR ? versus({ before: { label: "Your plan now", value: i.nowYear }, after: { label: esc(i.best.retailer), value: i.bestYear }, gapLabel: "You could save" }) : ""}
    ${i.best ? planCard({ kicker: "Cheapest for you today", retailer: i.best.retailer, planName: i.best.planName, figure: i.yearly !== null && i.yearly >= WORTH_SWITCHING_PER_YEAR ? { amount: i.yearly, after: "a year less than your last bill." } : null, link: retailerLink(i.best.retailer) }) : ""}
    ${heading("Your three options")}
    ${steps([
      step(1, "Switch before it ends", "Takes about 10 minutes online. Your power stays on."),
      step(2, "Ask your retailer to match it", "Call them, quote the cheaper plan, and ask for a new deal."),
      step(3, "Do nothing", "You'll usually move to a higher rate. We'll keep watching either way."),
    ])}
    ${button("See my options", `${i.origin}/account#compare`)}
    ${unsubscribe(i.unsubscribeUrl, `You're getting this because you're a Utilo member and told us when your ${esc(short)} ends.`)}`;
  return { subject: `Your ${short} ends on ${i.when}`, title: "Heads up: your deal is ending.", html };
}

/* ---------- 7. Monthly check (member), July version included ---------- */
export function monthlyCheck(i: {
  origin: string;
  monthName: string;       // "October"
  isJuly: boolean;
  retailer: string;
  planName: string;
  yearly: number;          // best vs their last bill (may be <= 0)
  unsubscribeUrl: string;
  /** Members with a gas bill on file: the cheapest gas plan vs their gas bill. */
  gas?: { retailer: string; planName: string; yearly: number } | null;
  /** New offers and price changes on their network this month, e.g. "8 new offers and 21 updated offers". */
  activity?: string | null;
  /** How many offers changed on their network this month (for the numbers row). */
  activityCount?: number | null;
  /** The monthly summary's extra sections (lib/monthlySummary.ts). Without it, the short check. */
  facts?: SummaryFacts | null;
}): Email {
  const worth = i.yearly >= WORTH_SWITCHING_PER_YEAR;
  const gasWorth = !!i.gas && i.gas.yearly >= WORTH_SWITCHING_PER_YEAR;
  const gasBlock = !i.gas
    ? ""
    : gasWorth
      ? planCard({ kicker: "Gas: you could pay less", retailer: i.gas.retailer, planName: i.gas.planName, figure: { amount: i.gas.yearly, after: "a year less than your gas bill." }, link: retailerLink(i.gas.retailer), tone: "amber" })
      : statusBox({ kicker: "Gas", headline: "Your gas plan is a good deal", body: `Nothing beats it by ${money(WORTH_SWITCHING_PER_YEAR)} a year or more.`, tone: "green" });
  const lead = i.isJuly
    ? "Retailers changed their prices on 1 July, so we've re-checked your plan against the new ones."
    : "We re-checked your plan against today's prices.";
  const card = worth
    ? planCard({ kicker: "You could pay less", retailer: i.retailer, planName: i.planName, figure: { amount: i.yearly, after: "a year less than your last bill." }, link: retailerLink(i.retailer), tone: "amber" })
    : statusBox({ kicker: `Your ${esc(i.monthName)} check`, headline: "You're on a good deal", body: `Nothing beats your plan by ${money(WORTH_SWITCHING_PER_YEAR)} a year or more. We'll keep watching.`, tone: "green" });
  const f = i.facts ?? null;
  const html = f
    ? `
    <p>${i.isJuly ? "Retailers changed their prices on 1 July, so we've re-checked your plan against the new ones." : "Your month in 30 seconds. We re-checked your plan against today's prices"}${i.activityCount && !i.isJuly ? `, including ${i.activityCount} offers that changed on your network.` : i.isJuly ? "" : "."}</p>
    ${i.gas ? heading("Electricity") : ""}
    ${card}
    ${i.gas ? heading("Gas") + gasBlock : ""}
    ${summaryGlance(i, f)}
    ${tip(`<strong>Tip: ${esc(f.tip.title)}.</strong> ${esc(f.tip.body)}`)}
    ${button("Open my full summary", `${i.origin}/account#compare`)}
    ${note(`Switched recently? <a href="${i.origin}/account">Add the date on your dashboard</a> so your savings count from the right day. New bill? Snap it there and every figure updates. All figures are estimates from your bill and today's prices.`)}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this monthly summary as a Utilo member. You can also turn it off on the Plus tab. This won't cancel Utilo Plus.")}`
    : `
    <p>${lead}${i.activity ? ` This month retailers made ${esc(i.activity)} on your network, and we checked every one against your home.` : ""}</p>
    ${i.gas ? heading("Electricity") : ""}
    ${card}
    ${i.gas ? heading("Gas") + gasBlock : ""}
    ${button("Open my dashboard", `${i.origin}/account#compare`)}
    ${tip(`Switched recently? <a href="${i.origin}/account">Add the date on your dashboard</a> so your savings count from the right day. New bill? Snap it there too.`)}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel Utilo Plus.")}`;
  return {
    subject: i.isJuly ? "Prices changed on 1 July: your re-check" : worth ? `Your ${i.monthName} check: about ${money(i.yearly)} a year to save` : `Your ${i.monthName} check: you're on a good deal`,
    title: i.isJuly ? "Your 1 July re-check" : `Your ${esc(i.monthName)} check`,
    html,
  };
}

/* ---------- Monthly summary sections ---------- */
const shortDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });
type MonthlyInput = Parameters<typeof monthlyCheck>[0];

const INK = { you: "#e8590c", best: "#16a34a", vdo: "#b8bfcf", navy: "#22306e", light: "#c7cde0", amber: "#f5a623", teal: "#14b8a6", free: "#16a34a", soak: "#5eead4", peak: "#f87171", off: "#c7cde0" };

/** "At a glance": one line per topic with a small chart and a link to the full chart on the dashboard. */
function summaryGlance(i: MonthlyInput, f: SummaryFacts): string {
  const open = (what: string) => `${i.origin}/account?open=${what}#home`;
  const rows: string[] = [];
  const y = f.charts.year;

  if (y.vsBill) {
    rows.push(glanceRow({
      dot: INK.you,
      title: `Your year: ${money(y.you)} now, ${money(y.best)} on the cheapest`,
      line: `The default offer would be ${money(y.vdo)}.`,
      link: { label: "Compare every retailer", url: `${i.origin}/account#compare` },
      chart: miniBars([{ value: y.you, color: INK.you }, { value: y.best, color: INK.best }, { value: y.vdo, color: INK.vdo }]),
    }));
  }
  if (f.nextBill && f.charts.months) {
    const gap = f.nextBill.now - f.nextBill.best;
    rows.push(glanceRow({
      dot: INK.navy,
      title: `Next bill about ${money(f.nextBill.now)}`,
      line: `To ${esc(shortDate(f.nextBill.end))}${gap >= 5 ? `, or about ${money(f.nextBill.best)} on the cheapest plan` : ""}. Winter is the dear stretch.`,
      link: { label: "See your year ahead", url: open("year") },
      chart: columns(f.charts.months.map((m) => ({ parts: [{ value: m.now, color: m.next ? INK.navy : INK.light }] })), { height: 30, gap: 1 }),
    }));
  }
  if (f.ending) {
    const e = f.ending;
    const pct = Math.max(4, Math.min(100, Math.round((1 - e.days / 90) * 100)));
    const col = e.days <= 30 ? "#dc2626" : INK.amber;
    rows.push(glanceRow({
      dot: col,
      title: `Your ${esc(e.what)} ends ${esc(shortDate(e.date))}`,
      line: `In ${e.days} day${e.days === 1 ? "" : "s"}. Prices often go up then: switch, or ask your retailer to match.`,
      link: { label: "See your options", url: `${i.origin}/account#compare` },
      chart: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eceff5;border-radius:5px;"><tr><td><table role="presentation" width="${pct}%" cellspacing="0" cellpadding="0"><tr><td height="10" bgcolor="${col}" style="height:10px;background:${col};border-radius:5px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`,
    }));
  }
  const m = f.charts.market;
  if (m && m.some((d) => d.newOffers + d.priceChanges > 0)) {
    const n = m.reduce((a, d) => a + d.newOffers, 0);
    const p = m.reduce((a, d) => a + d.priceChanges, 0);
    rows.push(glanceRow({
      dot: INK.teal,
      title: `${n + p} changes on your network`,
      line: `${n} new offers and ${p} updated offers in 30 days. We priced every one for your home.`,
      link: { label: "See every change", url: open("market") },
      chart: columns(m.map((d) => ({ parts: [{ value: d.newOffers, color: INK.teal }, { value: d.priceChanges, color: INK.amber }] })), { height: 30, gap: 1 }),
    }));
  }
  if (f.midday && f.charts.hourly) {
    const gap = f.midday.bestYear - f.midday.choresYear;
    const colour = (h: number) => (h >= 11 && h < 14 ? INK.free : h >= 14 && h < 16 ? INK.soak : h >= 16 && h < 21 ? INK.peak : INK.off);
    rows.push(glanceRow({
      dot: INK.free,
      title: middayWorthIt(f.midday) ? `Free midday power could save ${money(gap)} a year` : "Free midday power: checked for you",
      line: middayWorthIt(f.midday)
        ? "On Victoria's new Midday Power Saver (free 11am to 2pm), with the washing and dishwasher at midday."
        : `Victoria's new Midday Power Saver would cost about ${gap >= 0 ? `${money(gap)} a year less` : `${money(-gap)} a year more`} than the cheapest plan for you.`,
      link: { label: "See your day", url: open("midday") },
      chart: columns(f.charts.hourly.map((v, h) => ({ parts: [{ value: v, color: colour(h) }] })), { height: 30, gap: 1 }),
    }));
  }
  if (f.credit) {
    const yearOne = Math.max(0, y.you - f.credit.yearOneVsNow);
    const good = y.vsBill && f.credit.yearOneVsNow >= WORTH_SWITCHING_PER_YEAR;
    rows.push(glanceRow({
      dot: INK.best,
      title: `${money(f.credit.amount)} sign-up credit at ${esc(f.credit.retailer)}`,
      line: good ? `Year one would come to about ${money(yearOne)}. Credits are usually for new customers.` : "The biggest on your network. Even with it, it doesn't beat what you pay by much.",
      link: { label: "See all rewards", url: open("rewards") },
      chart: good ? miniBars([{ value: y.you, color: INK.you }, { value: yearOne, color: INK.best }]) : undefined,
    }));
  }
  if (f.like) {
    const r = f.like.you / f.like.typical;
    rows.push(glanceRow({
      dot: "#8b5cf6",
      title: `You use ${f.like.you.toFixed(1)} kWh a day`,
      line: `A home like yours: about ${f.like.typical.toFixed(1)}. ${Math.abs(r - 1) < 0.1 ? "About right." : r < 1 ? "Nicely done." : "This month's tip might help."}`,
      link: { label: "See where it goes", url: `${i.origin}/account#home` },
      chart: miniBars([{ value: f.like.you, color: INK.you }, { value: f.like.typical, color: INK.navy }]),
    }));
  }
  return rows.length ? heading("Your month at a glance") + glance(rows) : "";
}

/* ---------- Yearly recap, two weeks before renewal (2 Nov 2026) ----------
   What we did for them this year, in their numbers, and the renewal date and
   price in plain sight (no surprise charges). */
export function renewalRecap(i: {
  origin: string;
  name?: string | null;
  daysWatched: number;
  marketChanges: number;        // offers new or changed on their network over the year
  network?: string | null;
  switched: boolean;
  savedSoFar: number;           // since they switched ($)
  availableYear: number | null; // what switching would save now, a year (if they haven't switched)
  bestRetailer?: string | null;
  nowYear?: number | null;
  bestYear?: number | null;
  renewsOn: string;             // "1 November"
  priceLabel: string;           // "$39 a year"
  founding?: boolean;
  unsubscribeUrl: string;
}): Email {
  const saved = i.switched && i.savedSoFar >= 1;
  const html = `
    <p>${i.name ? `Hi ${esc(i.name)},<br>` : ""}Your membership renews soon, so here's what Utilo did for you this year.</p>
    ${heroPanel({ pill: "Your year with Utilo Plus", headline: `We checked your plan every morning for ${i.daysWatched.toLocaleString("en-AU")} days.`, body: `Every plan${i.network ? ` on the ${esc(i.network)} network` : ""} re-priced against your own bill, so you didn't have to keep an eye on the market.` })}
    ${statRow([
      { big: i.daysWatched.toLocaleString("en-AU"), small: "days watched", tone: "navy" },
      { big: i.marketChanges > 0 ? i.marketChanges.toLocaleString("en-AU") : "Daily", small: i.marketChanges > 0 ? "offer changes checked" : "price checks", tone: "amber" },
      saved ? { big: money(i.savedSoFar), small: "saved since you switched", tone: "green" } : { big: i.availableYear && i.availableYear >= WORTH_SWITCHING_PER_YEAR ? money(i.availableYear) : "On track", small: i.availableYear && i.availableYear >= WORTH_SWITCHING_PER_YEAR ? "a year, there to save now" : "no move needed right now", tone: "green" },
    ])}
    ${!i.switched && i.availableYear && i.availableYear >= WORTH_SWITCHING_PER_YEAR && i.nowYear && i.bestYear
      ? `${heading("Still there to save")}${versus({ before: { label: "Your plan now", value: i.nowYear }, after: { label: i.bestRetailer ? esc(i.bestRetailer) : "The cheapest plan", value: i.bestYear }, gapLabel: "You could save" })}${button("See my options", `${i.origin}/account#compare`)}`
      : ""}
    ${heading("Coming up in your next year")}
    ${tiles([
      { sym: "!", title: "Never miss a price jump", text: "A month's warning before your discount or fixed price ends.", tint: "amber" },
      { sym: "&#8635;", title: "1 July re-check", text: "Retailers change their prices; we re-run everything for you.", tint: "teal" },
      { sym: "&#9993;", title: "Only emails that pay", text: `One email when switching saves ${money(WORTH_SWITCHING_PER_YEAR)}+ a year.`, tint: "green" },
      { sym: "&#9638;", title: "Your bills in one place", text: "Snap each bill, power and gas, and see your year build up.", tint: "navy" },
    ])}
    ${statusBox({ kicker: "Your renewal", headline: `${esc(i.priceLabel)} on ${esc(i.renewsOn)}`, body: `${i.founding ? "Your founding member price stays the same. " : ""}Nothing to do to keep going. To change or cancel, it's on your dashboard under Plus, any time before then.`, tone: "teal" })}
    ${button("Open my dashboard", `${i.origin}/account#membership`)}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because your Utilo Plus membership renews soon.")}`;
  return {
    subject: saved ? `Your year with Utilo: ${money(i.savedSoFar)} saved` : `Your year with Utilo: renewing ${i.renewsOn}`,
    title: saved ? `${money(i.savedSoFar)} saved this year.` : "Your year with Utilo Plus.",
    html,
  };
}

/* ---------- Referral: a friend joined with the member's link ----------
   No friend's name or email: just that someone joined and the credit. */
export function referralCreditEmail(i: { origin: string }): Email {
  const credit = referralDollars(REFERRAL_CREDIT_CENTS);
  const html = `
    <p>Someone joined Utilo with your link. Thank you for passing it on.</p>
    ${bigFigure({ figure: `${credit} off`, label: "Your credit", body: "On your account now. It comes off your next membership payment automatically.", tone: "green" })}
    ${heading("Share it again")}
    ${steps([
      step(1, "Copy your link", "It's on your dashboard, under Plus. Text, email or WhatsApp it."),
      step(2, "They join", `They get ${referralDollars(REFERRAL_FRIEND_CENTS)} off their first payment.`),
      step(3, "You get credit", `${credit} off your next payment once they've paid.`),
    ])}
    ${button("Get your link to share again", `${i.origin}/account#membership`)}`;
  return { subject: `A friend joined: ${credit} off your next payment`, title: "A friend joined with your link", html };
}

/* ---------- A second payment by mistake (already a member) ----------
   Sent once, when the duplicate is cancelled and refunded. */
export function duplicatePaymentEmail(i: { origin: string }): Email {
  const html = `
    <p>You were already a Utilo member under this email, so we've cancelled the second membership and refunded that payment in full. Your original membership carries on as normal.</p>
    ${bigFigure({ figure: "&#10003; Refunded", label: "Second payment", body: "On its way back to your card. Refunds usually show within 5 to 10 business days, depending on your bank.", tone: "green" })}
    ${button("Open my dashboard", `${i.origin}/account#membership`)}`;
  return { subject: "You were already a member: we've refunded the second payment", title: "Second payment refunded", html };
}

/* ---------- Member login: the sign-in link ----------
   One button. Works once, for about an hour. */
export function signInEmail(i: { origin: string; url: string }): Email {
  const html = `
    ${heroPanel({ pill: "Sign in", headline: "Your dashboard is one tap away", body: "No password needed. This link works once, for about an hour, on the device you open it on.", button: { label: "Sign in to Utilo", url: i.url } })}
    ${note("Didn't ask for this? You can ignore it; nobody can sign in without this email. Need a fresh link later? Go to Log in and enter this address again.")}
    <p style="margin:16px 0 0;font-size:13px;color:#5f6b82;">Sent from Utilo, ${esc(i.origin.replace(/^https?:\/\//, ""))}.</p>`;
  return { subject: "Your Utilo sign-in link", title: "Sign in to Utilo", html };
}

export { signOff };

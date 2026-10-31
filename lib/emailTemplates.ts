// Every customer email's wording, in one place. Each function returns the
// subject, the heading shown at the top of the card, and the body HTML; the
// branded shell (logo header, footer) is added by renderEmail in lib/email.ts.
// The welcome email lives in lib/welcomeEmail.ts. The sign-in link is sent by
// /api/login-link using signInEmail below (the Supabase templates in
// supabase/email-templates/ are only the fallback when that isn't set up).
//
// To change wording: edit the strings below, keep the ${...} parts.

import { esc } from "./email";
import { PRICE_CHANGE_CLAUSE, WORTH_SWITCHING_PER_YEAR } from "./dataPolicy";
import { RETAILER_LINKS } from "./retailerLinks";
import { REFERRAL_CREDIT_CENTS, referralDollars } from "./referralOffer";
import { button, chips, columns, dateBanner, glance, glanceRow, heading, iconRow, iconRows, miniBars, money, note, planCard, signOff, statusBox, step, steps, tip, unsubscribe } from "./emailParts";
import type { SummaryFacts } from "./monthlySummary";
import { middayWorthIt } from "./monthlySummary";

export interface Email { subject: string; title: string; html: string }

const SWITCH_FACTS = ["About 10 minutes online", "Your power stays on", "10-day cooling-off"];
const retailerLink = (r: string) => (RETAILER_LINKS[r] ? { label: `See the plan on ${esc(r)}'s site`, url: RETAILER_LINKS[r] } : null);

/* ---------- 1. Your result (sent straight after a free check) ----------
   Free users get the saving, not the retailer: the cheapest plans are for
   members, the same as on the results page. */
export function resultEmail(i: {
  origin: string;
  retailer: string;
  planName: string | null;
  yearly: number;          // saving a year vs the reference
  vsBill: boolean;         // reference is their own bill (else the default offer)
  unsubscribeUrl: string;
  sentLater?: boolean;     // the day-after fallback copy
}): Email {
  const worth = i.yearly >= WORTH_SWITCHING_PER_YEAR;
  const subject = worth ? `Your result: about ${money(i.yearly)} a year` : "Your Utilo result";
  const title = worth ? (i.vsBill ? "You could pay less." : "Here's your result.") : "You're on a good deal.";
  const card = worth
    ? planCard({
        kicker: "Cheapest for you",
        retailer: "Utilo Plus shows which retailer",
        planName: "The plan name, rates and sign-up conditions are on your dashboard.",
        figure: { amount: i.yearly, after: i.vsBill ? "a year less than your bill." : "a year less than the default offer." },
        link: { label: "Unlock the cheapest plans", url: `${i.origin}/pricing` },
      })
    : statusBox({ kicker: "Your result", headline: "Nothing beats it by enough to bother", body: `The cheapest plan we found saves less than ${money(WORTH_SWITCHING_PER_YEAR)} a year. Stay put.`, tone: "green" });
  const html = `
    <p>${i.sentLater ? "Here's your result from yesterday's check, so it's easy to find." : "Here's your result, so it's easy to find later."}</p>
    ${card}
    ${!i.vsBill && worth ? tip(`This is against the default offer. <strong>Snap your bill</strong> for your exact saving: <a href="${i.origin}/check">check again with a photo</a>.`) : ""}
    ${worth ? button("See the cheapest plan", `${i.origin}/pricing`) : button("See my result again", `${i.origin}/check`)}
    ${worth ? chips(SWITCH_FACTS) : ""}
    ${note(`Prices change through the year. Utilo Plus re-checks you every morning and tells you when switching is worth it. <a href="${i.origin}/pricing">$7 a month, or $39 a year</a>.`)}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you asked for your result by email.")}`;
  return { subject, title, html };
}

/* ---------- 2. Follow-up, day 3: what members get ---------- */
export function followUpMembership(i: { origin: string; unsubscribeUrl: string }): Email {
  const html = `
    <p>Retailers change their plans through the year. The plan that's cheapest today may not be in three months, and most discounts end after the first year.</p>
    ${heading("What Utilo Plus does")}
    ${iconRows([
      iconRow("&#128260;", "Every morning:", "your plan re-priced against today's prices."),
      iconRow("&#128276;", "30 days before:", "your discount or fixed price ends."),
      iconRow("&#128197;", "1 July:", "a re-check when retailers change their prices."),
      iconRow("&#128247;", "Any time:", "snap a bill and see where you stand."),
    ])}
    ${statusBox({ kicker: "Utilo Plus", headline: "$7 a month", body: "That's $84 a year. Pay yearly and it's $39: you save $45. Cancel any time.", tone: "teal" })}
    ${button("See Utilo Plus", `${i.origin}/pricing`)}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you checked your plan with Utilo and asked for updates.")}`;
  return { subject: "Prices move. We can keep watching for you", title: "Cheapest today isn't cheapest forever.", html };
}

/* ---------- 3. Follow-up, day 7: did you switch? ---------- */
export function followUpWeek(i: { origin: string; retailer: string | null; planName: string | null; yearly: number | null; unsubscribeUrl: string }): Email {
  const weekly = i.yearly && i.yearly >= WORTH_SWITCHING_PER_YEAR ? i.yearly / 52 : null;
  const html = `
    <p>A week ago we found a cheaper plan for you. Utilo Plus shows which retailer, and re-checks it every morning: <a href="${i.origin}/pricing">$7 a month, or $39 a year</a>.</p>
    ${weekly ? statusBox({ kicker: "Still on the old plan?", headline: `About ${money(weekly)} a week`, body: "That's what the old plan costs you each week, compared with the one we found.", tone: "amber" }) : ""}
    ${button("Check again with today's prices", `${i.origin}/check`)}
    <p>Already switched? Nice work. This is the last of these emails.</p>
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you checked your plan with Utilo and asked for updates.")}`;
  return {
    subject: weekly ? `Still on the old plan? That's about ${money(weekly)} a week` : "A week on: did you switch?",
    title: "A week on: did you switch?",
    html,
  };
}

/* ---------- 4. Cheaper plan found (member) ---------- */
export function cheaperForMember(i: { origin: string; retailer: string; planName: string; yearly: number; unsubscribeUrl: string; offerNote?: string | null }): Email {
  const html = `
    <p>Watching the market for you this morning, we found a plan that beats our last pick.${i.offerNote ? ` ${esc(i.offerNote)}` : ""}</p>
    ${planCard({ kicker: "New cheapest for you", retailer: i.retailer, planName: i.planName, figure: { amount: i.yearly, after: "a year cheaper than our last pick." }, link: retailerLink(i.retailer), tone: "amber" })}
    ${button("See it on my dashboard", `${i.origin}/account#compare`)}
    ${chips(SWITCH_FACTS)}
    ${note(esc(PRICE_CHANGE_CLAUSE))}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel Utilo Plus; manage it from your dashboard.")}`;
  return { subject: `A cheaper plan just showed up: about ${money(i.yearly)} a year less`, title: "We found a cheaper plan.", html };
}

/* ---------- 4b. Cheaper gas plan found (member) ---------- */
export function cheaperGasForMember(i: { origin: string; retailer: string; planName: string; yearly: number; vsBill: boolean; unsubscribeUrl: string }): Email {
  const html = `
    <p>Watching gas prices for you this morning, we found a gas plan that beats our last pick.</p>
    ${planCard({ kicker: "New cheapest gas plan for you", retailer: i.retailer, planName: i.planName, figure: { amount: i.yearly, after: i.vsBill ? "a year less than our last pick, based on your gas bill." : "a year less than our last pick." }, link: retailerLink(i.retailer), tone: "amber" })}
    ${button("See it on my dashboard", `${i.origin}/account`)}
    ${tip("Getting electricity from the same retailer? Ask about a dual-fuel discount when you switch.")}
    ${note(esc(PRICE_CHANGE_CLAUSE) + " Gas use swings with the seasons, so yearly figures are scaled from your bill.")}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel Utilo Plus; manage it from your dashboard.")}`;
  return { subject: `A cheaper gas plan just showed up: about ${money(i.yearly)} a year less`, title: "We found a cheaper gas plan.", html };
}

/* ---------- 5. Cheaper plan found (free user who opted in) ---------- */
export function cheaperForLead(i: { origin: string; previousRetailer: string | null; retailer: string; planName: string; yearly: number; unsubscribeUrl: string; offerNote?: string | null }): Email {
  const html = `
    <p>Prices have moved since you checked your plan, and there's now something cheaper.</p>
    ${planCard({ kicker: "New cheapest in your area", retailer: "Utilo Plus shows which retailer", planName: "The plan, its rates and sign-up conditions are on your dashboard.", figure: { amount: i.yearly, after: "a year cheaper than your earlier best match." }, link: { label: "Unlock the cheapest plans", url: `${i.origin}/pricing` }, tone: "amber" })}
    ${button("Check it with my bill", `${i.origin}/check`)}
    ${tip(`Want this done for you every morning, without waiting for an email like this? <a href="${i.origin}/pricing">Utilo Plus is $7 a month, or $39 a year</a>.`)}
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
}): Email {
  const short = i.what.startsWith("discount") ? "discount" : "fixed price";
  const html = `
    ${dateBanner(`Your ${esc(short)} ends ${esc(i.when)}`, `In ${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"}. Prices often go up when that happens.`)}
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

/* ---------- Referral: a friend joined with the member's link ----------
   No friend's name or email: just that someone joined and the credit. */
export function referralCreditEmail(i: { origin: string }): Email {
  const credit = referralDollars(REFERRAL_CREDIT_CENTS);
  const html = `
    <p>Someone joined Utilo with your link. Thank you for passing it on.</p>
    ${statusBox({ kicker: "Your credit", headline: `${credit} off your next payment`, body: "It's on your account now and comes off your next membership payment automatically.", tone: "green" })}
    ${button("Get your link to share again", `${i.origin}/account#membership`)}`;
  return { subject: `A friend joined: ${credit} off your next payment`, title: "A friend joined with your link", html };
}

/* ---------- A second payment by mistake (already a member) ----------
   Sent once, when the duplicate is cancelled and refunded. */
export function duplicatePaymentEmail(i: { origin: string }): Email {
  const html = `
    <p>You were already a Utilo member under this email, so we've cancelled the second membership and refunded that payment in full. Your original membership carries on as normal.</p>
    ${statusBox({ kicker: "Refund", headline: "On its way back to your card", body: "Refunds usually show within 5 to 10 business days, depending on your bank.", tone: "green" })}
    ${button("Open my dashboard", `${i.origin}/account#membership`)}`;
  return { subject: "You were already a member: we've refunded the second payment", title: "Second payment refunded", html };
}

/* ---------- Member login: the sign-in link ----------
   One button. Works once, for about an hour. */
export function signInEmail(i: { origin: string; url: string }): Email {
  const html = `
    <p>Here's your link to open My Dashboard. It works once, for about an hour, and only on the device you open it on.</p>
    ${button("Sign in to Utilo", i.url)}
    ${note("Didn't ask for this? You can ignore it; nobody can sign in without this email. Need a fresh link later? Go to Log in and enter this address again.")}
    <p style="margin:16px 0 0;font-size:13px;color:#5f6b82;">Sent from Utilo, ${esc(i.origin.replace(/^https?:\/\//, ""))}.</p>`;
  return { subject: "Your Utilo sign-in link", title: "Sign in to Utilo", html };
}

export { signOff };

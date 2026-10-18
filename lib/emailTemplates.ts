// Every customer email's wording, in one place. Each function returns the
// subject, the heading shown at the top of the card, and the body HTML; the
// branded shell (logo header, footer) is added by renderEmail in lib/email.ts.
// The welcome email lives in lib/welcomeEmail.ts. The sign-in link email is a
// Supabase template: supabase/email-templates/.
//
// To change wording: edit the strings below, keep the ${...} parts.

import { esc } from "./email";
import { PRICE_CHANGE_CLAUSE, WORTH_SWITCHING_PER_YEAR } from "./dataPolicy";
import { RETAILER_LINKS } from "./retailerLinks";
import { REFERRAL_CREDIT_CENTS, referralDollars } from "./referralOffer";
import { button, chips, dateBanner, heading, iconRow, iconRows, money, note, planCard, signOff, statusBox, step, steps, tip, unsubscribe } from "./emailParts";

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
        retailer: "Members see which retailer",
        planName: "The plan name, rates and sign-up conditions are on your members' dashboard.",
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
    ${note(`Prices change through the year. Members are re-checked every morning and told when switching is worth it. <a href="${i.origin}/pricing">$39 a year</a>.`)}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you asked for your result by email.")}`;
  return { subject, title, html };
}

/* ---------- 2. Follow-up, day 3: what members get ---------- */
export function followUpMembership(i: { origin: string; unsubscribeUrl: string }): Email {
  const html = `
    <p>Retailers change their plans through the year. The plan that's cheapest today may not be in three months, and most discounts end after the first year.</p>
    ${heading("What members get")}
    ${iconRows([
      iconRow("&#128260;", "Every morning:", "your plan re-priced against today's prices."),
      iconRow("&#128276;", "30 days before:", "your discount or fixed price ends."),
      iconRow("&#128197;", "1 July:", "a re-check when retailers change their prices."),
      iconRow("&#128247;", "Any time:", "snap a bill and see where you stand."),
    ])}
    ${statusBox({ kicker: "Membership", headline: "$39 a year", body: "Less than a coffee a month. Or $7 month to month. Cancel any time.", tone: "teal" })}
    ${button("See what members get", `${i.origin}/pricing`)}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you checked your plan with Utilo and asked for updates.")}`;
  return { subject: "Prices move. We can keep watching for you", title: "Cheapest today isn't cheapest forever.", html };
}

/* ---------- 3. Follow-up, day 7: did you switch? ---------- */
export function followUpWeek(i: { origin: string; retailer: string | null; planName: string | null; yearly: number | null; unsubscribeUrl: string }): Email {
  const weekly = i.yearly && i.yearly >= WORTH_SWITCHING_PER_YEAR ? i.yearly / 52 : null;
  const html = `
    <p>A week ago we found a cheaper plan for you. Members see which retailer, and get it re-checked every morning: <a href="${i.origin}/pricing">$39 a year</a>.</p>
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
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel your membership; manage it from your dashboard.")}`;
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
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel your membership; manage it from your dashboard.")}`;
  return { subject: `A cheaper gas plan just showed up: about ${money(i.yearly)} a year less`, title: "We found a cheaper gas plan.", html };
}

/* ---------- 5. Cheaper plan found (free user who opted in) ---------- */
export function cheaperForLead(i: { origin: string; previousRetailer: string | null; retailer: string; planName: string; yearly: number; unsubscribeUrl: string; offerNote?: string | null }): Email {
  const html = `
    <p>Prices have moved since you checked your plan, and there's now something cheaper.</p>
    ${planCard({ kicker: "New cheapest in your area", retailer: "Members see which retailer", planName: "The plan, its rates and sign-up conditions are on your members' dashboard.", figure: { amount: i.yearly, after: "a year cheaper than your earlier best match." }, link: { label: "Unlock the cheapest plans", url: `${i.origin}/pricing` }, tone: "amber" })}
    ${button("Check it with my bill", `${i.origin}/check`)}
    ${tip(`Want this done for you every morning, without waiting for an email like this? <a href="${i.origin}/pricing">Membership is $39 a year</a>.`)}
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
  const html = `
    <p>${lead}</p>
    ${i.gas ? heading("Electricity") : ""}
    ${card}
    ${i.gas ? heading("Gas") + gasBlock : ""}
    ${button("Open my dashboard", `${i.origin}/account#compare`)}
    ${tip(`Switched recently? <a href="${i.origin}/account">Add the date on your dashboard</a> so your savings count from the right day. New bill? Snap it there too.`)}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel your membership.")}`;
  return {
    subject: i.isJuly ? "Prices changed on 1 July: your re-check" : worth ? `Your ${i.monthName} check: about ${money(i.yearly)} a year to save` : `Your ${i.monthName} check: you're on a good deal`,
    title: i.isJuly ? "Your 1 July re-check" : `Your ${esc(i.monthName)} check`,
    html,
  };
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

export { signOff };

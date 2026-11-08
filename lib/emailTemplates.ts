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
import { namesList } from "./stickyPick";
import { sameRetailer } from "./sameRetailer";
import { REFERRAL_CREDIT_CENTS, REFERRAL_FRIEND_CENTS, referralDollars } from "./referralOffer";
import { FOUNDING_OFFER, SPECIAL_ENDS_LABEL, SPECIAL_ENDS_SHORT, SPECIAL_NAME, fmtPrice, plusValue, regularPrice, timesPrice } from "./pricingPlans";
import { C, lessonLine, alertPreview, billVsBest, iconRow, iconRows, joinCard, pains, plusMorning, sameRetailerBonus, pillars, youVsUs, screen, miniVerdict, plusAnimation, stars, bigFigure, endTimeline, keepBg, keepWhite, button, chips, columns, countdown, glance, glanceRow, greet, hBars, heading, firstNameOf, heroPanel, legend, miniBars, money, moneyHero, note, planCard, signOff, statRow, statusBox, step, steps, tiles, tip, unsubscribe, versus, yearStrip } from "./emailParts";
import type { SummaryFacts } from "./monthlySummary";
import { middayWorthIt } from "./monthlySummary";

export interface Email { subject: string; title: string; html: string }

const SWITCH_FACTS = ["About 10 minutes online", "Your power stays on", "10-day cooling-off"];
const F = "Arial,Helvetica,sans-serif";
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
  currentRetailer?: string | null;  // who they're with now, if they said or the bill showed
  lesson?: string | null;           // 8 Nov 2026: one line from their own bill (lib/billLesson)
}): Email {
  const worth = i.yearly >= WORTH_SWITCHING_PER_YEAR;
  const same = worth && FREE_SHOWS_NAMES && i.vsBill && sameRetailer(i.currentRetailer, i.retailer);
  const v = plusValue();
  const subject = worth ? `Your result: about ${money(i.yearly)} a year` : "Your Utilo result";
  const title = worth ? (i.vsBill ? "You could pay less." : "Here's your result.") : "You're on a good deal.";
  const nowWord = i.vsBill ? "Your bill" : "Default offer";
  const card = worth
    ? planCard({
        kicker: same ? "Cheapest for you · same retailer" : "Cheapest for you",
        retailer: FREE_SHOWS_NAMES ? i.retailer : "Utilo Plus shows which retailer",
        planName: FREE_SHOWS_NAMES ? i.planName : "The plan name, rates and sign-up conditions are on your dashboard.",
        figure: { amount: i.yearly, after: i.vsBill ? "a year less than your bill." : "a year less than the default offer." },
        link: FREE_SHOWS_NAMES ? retailerLink(i.retailer) : { label: "Unlock the cheapest plans", url: `${i.origin}/pricing` },
      })
    : statusBox({ kicker: "Your result", headline: "Nothing beats it by enough to bother", body: `The cheapest plan we found saves less than ${money(WORTH_SWITCHING_PER_YEAR)} a year. Stay put.`, tone: "green" });

  // The numbers at a glance: what you pay, the cheapest, the saving.
  // 6 Nov 2026: as two bars that grow when the email opens (billVsBest), in place of three number tiles.
  const stats = i.nowYear && i.bestYear ? billVsBest({ origin: i.origin, nowLabel: nowWord, now: i.nowYear, best: i.bestYear, money }) : "";

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


  const html = `
    ${greet(i.name)}
    <p>${i.sentLater ? "Here's your result from yesterday's check, so it's easy to find." : `Here's your result on prices as at ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" })}, so it's easy to find later.`} Prices change, so a later check can name a different plan: Plus members get one pick, kept up to date every morning.</p>
    ${stats}
    ${card}
    ${same ? sameRetailerBonus({ retailer: i.retailer, planName: i.planName ?? "their cheapest plan for you", amount: i.yearly }) : ""}
    ${!i.vsBill && worth ? tip(`This is against the default offer. <strong>Snap your bill</strong> for your exact saving: <a href="${i.origin}/check">check again with a photo</a>.`) : ""}
    ${worth ? chips(SWITCH_FACTS) : ""}
    ${ranking}
    ${facts.length ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${C.grey};">${facts.join("<br>")}</p>` : ""}
    ${i.lesson ? lessonLine(esc(i.lesson)) : ""}

    ${/* 6 Nov 2026: the Plus pitch, rebuilt to convert. The three things people tell us, then what
         Plus does about each, shown as a short animation (public/email/plus-morning.gif). */""}
    ${heading("Sound familiar?")}
    ${pains([
      { n: i.marketChanges && i.marketChanges > 0 ? `${i.marketChanges}` : "100+", label: "offers changed on your network in 30 days", fix: "Today's cheapest is rarely next month's. We re-check every one against your bill, every morning." },
      { n: "23.1c", label: "peak, 17.8c off-peak, 112c a day: rates nobody can read", fix: "We turn your bill into plain English: what you used, what each part cost, and where the money went." },
      { n: "+$61", label: "on the bill, and nobody says why", fix: "Every bill you send, we show what changed since the last one, in dollars: usage, prices, days, a concession or rebate gone. A late fee or missed discount, we tell you what to say to get it back." },
    ])}
    ${plusMorning(i.origin, `${i.origin}/pricing`)}
    ${joinCard({
      url: `${i.origin}/pricing`,
      special: FOUNDING_OFFER ? `${SPECIAL_NAME} · ends ${SPECIAL_ENDS_SHORT}` : null,
      regular: regularPrice("annual") ? fmtPrice(regularPrice("annual")!) : null,
      annual: v.annual, perWeek: v.perWeek, monthly: v.monthly,
      times: worth ? timesPrice(i.yearly) : null, saving: worth ? i.yearly : null,
      ticks: ["Every plan re-checked against your bill, every morning", "Power and gas, one membership", "We never call, and we never switch you. Cancel any time."],
    })}
    ${note(`${esc(PRICE_CHANGE_CLAUSE)}`)}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you asked for your result by email.")}`;
  return { subject, title, html };
}

/* ---------- 2. Follow-up, day 3: what members get ----------
   2 Nov 2026 (Phil: "more visual"): their own check as bars, the year ahead as
   a strip (checked daily, 1 July marked), and what an alert looks like. */
export function followUpMembership(i: {
  origin: string;
  unsubscribeUrl: string;
  name?: string | null;
  /** From their check, all optional. */
  retailer?: string | null;
  nowYear?: number | null;
  bestYear?: number | null;
  vsBill?: boolean;
}): Email {
  const v = plusValue();
  const ra = regularPrice("annual");
  const gap = i.nowYear && i.bestYear ? i.nowYear - i.bestYear : 0;
  const theirCheck = i.nowYear && i.bestYear && gap >= 1
    ? `${heading("Your check, 3 days ago")}${versus({
        before: { label: i.vsBill ? "Your plan now" : "The default offer", value: i.nowYear },
        after: { label: FREE_SHOWS_NAMES && i.retailer ? `Cheapest today: ${esc(i.retailer)}` : "Cheapest today", value: i.bestYear },
        gapLabel: "There to save",
      })}`
    : "";
  const melbMonth = Number(new Date().toLocaleString("en-AU", { month: "numeric", timeZone: "Australia/Melbourne" })) - 1;
  const html = `
    ${greet(i.name)}
    <p>A few days ago you checked your energy plan with Utilo. Here's what happens next, and how we'd keep watching it for you.</p>
    ${theirCheck}
    ${heroPanel({ pill: "Utilo Plus", headline: "Cheapest today isn't cheapest forever.", body: "Retailers change their plans through the year, and most discounts end after the first year. We watch, so you don't have to." })}
    ${heading("Your next 12 months with Utilo Plus")}
    ${yearStrip(melbMonth)}
    ${alertPreview({ title: "A cheaper plan for you", body: `A plan on your network now beats your pick by about ${money(120)} a year. Tap to see it.` })}
    ${statRow([
      { big: v.annual, small: FOUNDING_OFFER ? `a year, ${SPECIAL_NAME}${ra ? ` (regular ${fmtPrice(ra)})` : ""}` : "a year", tone: "green" },
      { big: v.perWeek, small: "a week", tone: "navy" },
      { big: v.monthly, small: "or month to month", tone: "amber" },
    ])}
    ${button("See Utilo Plus", `${i.origin}/pricing`)}
    <p style="margin:0 0 8px;font-size:13px;color:#5f6b82;">No lock-in: cancel any time. Not a cent from retailers.</p>
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you checked your plan with Utilo and asked for updates.")}`;
  return {
    subject: gap >= WORTH_SWITCHING_PER_YEAR ? `${money(gap)} a year today. Will it still be cheapest in July?` : "Prices move. We can keep watching for you",
    title: "We watch, so you don't have to.",
    html,
  };
}

/* ---------- 3. Follow-up, day 7: did you switch? ---------- */
export function followUpWeek(i: { origin: string; retailer: string | null; planName: string | null; yearly: number | null; unsubscribeUrl: string; nowYear?: number | null; bestYear?: number | null; vsBill?: boolean; name?: string | null }): Email {
  // A year, not a week (1 Nov 2026): "$2 a week" undersold a $119 saving.
  const yearly = i.yearly && i.yearly >= WORTH_SWITCHING_PER_YEAR ? i.yearly : null;
  const html = `
    ${greet(i.name)}
    <p>${FREE_SHOWS_NAMES && i.retailer ? `A week ago we found a cheaper plan for you with ${esc(i.retailer)}${i.planName ? ` (&ldquo;${esc(i.planName)}&rdquo;)` : ""}.` : "A week ago we found a cheaper plan for you."} Utilo Plus re-checks it every morning and warns you before your discount ends: <a href="${i.origin}/pricing">${plusValue().monthly} a month, or ${plusValue().annual} a year</a>.</p>
    ${yearly && i.nowYear && i.bestYear
      ? versus({ before: { label: i.vsBill ? "Staying on your plan" : "The default offer", value: i.nowYear }, after: { label: FREE_SHOWS_NAMES && i.retailer ? `Switching to ${esc(i.retailer)}` : "Switching", value: i.bestYear }, gapLabel: "Staying put costs" })
      : yearly ? bigFigure({ figure: money(yearly), label: "Still on the old plan?", body: `What staying put costs you a year: about ${money(yearly / 12)} every month.`, tone: "amber" }) : ""}
    ${plusAnimation(i.origin, `${i.origin}/pricing?utm_source=email&utm_medium=drip&utm_campaign=day7`)}
    ${button("Check again with today's prices", `${i.origin}/check`)}
    <p>Already switched? Nice work. This is the last of these emails.</p>
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you checked your plan with Utilo and asked for updates.")}`;
  return {
    subject: yearly ? `Still on the old plan? That's about ${money(yearly)} a year` : "A week on: did you switch?",
    title: "A week on: did you switch?",
    html,
  };
}

/* ---------- Invite (owner-sent, 2 Nov 2026): one personal nudge to a lead who didn't join ----------
   3 Nov 2026 (Phil: "more engaging… savings, time, ease, control, daily checks"):
   their saving big, their bill against the cheapest, four promises, on your own vs
   with Plus, the year of daily checks, then the price. */
export function leadInvite(i: {
  origin: string;
  retailer: string | null;
  planName: string | null;
  /** The saving a year (not per bill). */
  yearly: number | null;
  unsubscribeUrl: string;
  checkedOn: string;      // "31 October"
  name?: string | null;
  /** What they pay a year and the cheapest plan a year, for the bars. Optional. */
  nowYear?: number | null;
  bestYear?: number | null;
  /** How many plans we price on their network, e.g. 131. */
  plansChecked?: number | null;
}): Email {
  const v = plusValue();
  const yearly = i.yearly && i.yearly >= 1 ? i.yearly : null;
  const tagged = (path: string) => `${i.origin}${path}${path.includes("?") ? "&" : "?"}utm_source=email&utm_medium=invite&utm_campaign=lead-invite`;
  const ra = regularPrice("annual");
  const plans = i.plansChecked && i.plansChecked > 10 ? `all ${i.plansChecked} plans` : "every plan";
  const named = FREE_SHOWS_NAMES && i.retailer ? esc(i.retailer) : null;
  const hero = yearly
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:separate;">
        <tr><td style="padding:22px 22px 20px;border-radius:16px;${keepBg(C.navy)}">
          <div style="display:inline-block;padding:3px 10px;border-radius:999px;background:${C.amber};color:${C.amberInk};font:800 11px Arial,Helvetica,sans-serif;letter-spacing:0.6px;text-transform:uppercase;">Your check on ${esc(i.checkedOn)}</div>
          <div style="margin:14px 0 0;font:800 50px/1 Arial,Helvetica,sans-serif;color:${C.amber};letter-spacing:-1px;">${money(yearly)}</div>
          ${keepWhite(`<div style="margin:4px 0 0;font:700 16px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;">a year you could save${named ? ` with ${named}` : ""}.</div>
          <div style="margin:10px 0 0;font:14px/1.5 Arial,Helvetica,sans-serif;color:#ffffff;opacity:0.8;">Prices move all the time. Utilo Plus keeps that saving coming: we check for you every single morning.</div>`)}
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0 0;"><tr><td style="border-radius:999px;background:${C.amber};"><a href="${tagged("/pricing")}" style="display:inline-block;padding:12px 22px;font:800 15px Arial,Helvetica,sans-serif;color:${C.amberInk};text-decoration:none;border-radius:999px;">Keep my saving coming &rarr;</a></td></tr></table>
        </td></tr>
      </table>`
    : heroPanel({ pill: "Utilo Plus", headline: "We'll watch your energy plan, every morning.", body: "Prices move and discounts end. We keep checking so you don't have to." });
  const bars = yearly && i.nowYear && i.bestYear && i.nowYear > i.bestYear
    ? versus({ before: { label: "What you pay now", value: i.nowYear }, after: { label: named ? `${named}, cheapest for you` : "The cheapest plan for you", value: i.bestYear }, gapLabel: "Left on the table" })
    : "";
  const html = `
    ${greet(i.name)}
    <p>On ${esc(i.checkedOn)} you checked your energy plan with Utilo. Here's what it found, and how to keep saving without lifting a finger.</p>
    ${hero}
    ${bars}
    ${heading("Why members let us do it")}
    ${pillars([
      { big: yearly ? money(yearly) : "$50+", title: "Savings", text: `One email when switching saves ${money(WORTH_SWITCHING_PER_YEAR)} or more a year. Never for small change.`, tint: "green" },
      { big: "0 min", title: "Your time", text: `No comparing ${plans} yourself. We re-price them against your bill.`, tint: "amber" },
      { big: "1 photo", title: "Ease", text: "Snap your bill once. Your dashboard sets itself up from it.", tint: "teal" },
      { big: "You", title: "Control", text: "We never switch you. You choose, and set how big a saving is worth an email.", tint: "navy" },
    ])}
    ${youVsUs([
      { what: "Checking prices", you: "When you remember", us: "Every morning, 365 days a year" },
      { what: "Plans compared", you: "A few, by hand", us: `${plans[0].toUpperCase()}${plans.slice(1)} on your network` },
      { what: "Discount ending", you: "Found on a bigger bill", us: "A month's warning" },
      { what: "1 July price changes", you: "Start again", us: "Re-checked for you" },
    ])}
    ${plusAnimation(i.origin, tagged("/pricing"))}
    ${heroPanel({
      pill: FOUNDING_OFFER ? `${SPECIAL_NAME} · ends ${SPECIAL_ENDS_SHORT}` : "Utilo Plus",
      headline: `${ra ? `<s style="opacity:0.55;font-weight:700;">${fmtPrice(ra)}</s> ` : ""}${v.annual} a year: ${v.perWeek} a week`,
      body: `${yearly && timesPrice(yearly) ? `Your saving is <strong>${timesPrice(yearly)} times</strong> the price. ` : ""}Or ${v.monthly} month to month.${FOUNDING_OFFER ? " Your price stays locked in while you stay." : ""} Cancel any time. Not a cent from retailers.`,
      button: { label: "Start Utilo Plus", url: tagged("/pricing") },
    })}
    <p style="margin:0 0 8px;font-size:13px;color:#5f6b82;">Not ready? <a href="${tagged("/check")}">Check again with today's prices</a>, free.</p>
    ${unsubscribe(i.unsubscribeUrl, "You're getting this one-off email because you checked your plan with Utilo and asked for your result.")}`;
  return {
    subject: yearly ? `${money(yearly)} a year, checked every morning for you` : "Want us to keep watching your energy plan?",
    title: "Keep your saving coming.",
    html,
  };
}

/* ---------- Invite follow-up (3 Nov 2026): a look inside the dashboard ----------
   Sent by the morning job a week after the owner-sent invite, once, if they
   haven't joined (lib/inviteFollowUp.ts). Their own figures where we have them;
   the rewards and market counts are live for their network; anything else is
   marked as an example. */
const TYPICAL_MONTH_SHAPE = [0.94, 0.88, 0.92, 0.95, 1.05, 1.17, 1.22, 1.16, 1.03, 0.95, 0.9, 0.95]; // Jan..Dec, a typical Victorian home
export function inviteFollowUp(i: {
  origin: string;
  name?: string | null;
  retailer: string | null;
  yearly: number | null;
  nowYear?: number | null;
  bestYear?: number | null;
  network?: string | null;
  rewards?: { credit: number; points: number; gift: number; discount: number; topCredit: number | null; retailers: number } | null;
  marketChanges?: number | null;
  unsubscribeUrl: string;
}): Email {
  const v = plusValue();
  const ra = regularPrice("annual");
  const yearly = i.yearly && i.yearly >= 1 ? i.yearly : null;
  const named = FREE_SHOWS_NAMES && i.retailer ? esc(i.retailer) : "The cheapest plan";
  const tagged = (path: string) => `${i.origin}${path}${path.includes("?") ? "&" : "?"}utm_source=email&utm_medium=invite&utm_campaign=lead-invite-2`;
  const net = i.network ? esc(i.network) : "your network";

  // 1. The verdict, from their check.
  const verdict = yearly && i.nowYear && i.bestYear
    ? screen("Compare", miniVerdict({
        headline: `You could save <span style="color:#fde047;">${money(yearly)}</span> a year`,
        tiles: [
          { label: "You now", name: "Your bill", value: money(i.nowYear), tone: "plain" },
          { label: "Cheapest we found", name: named, value: money(i.bestYear), tone: "best" },
          { label: "You save", name: "By switching", value: money(yearly), tone: "save" },
        ],
      }), "From your own check. Members see this re-priced every morning, by bill, quarter or year.")
    : "";

  // 2. The year ahead (a typical shape, scaled to their figures).
  const yearNow = i.nowYear ?? null;
  const yearBest = i.bestYear ?? null;
  const total = TYPICAL_MONTH_SHAPE.reduce((a, b) => a + b, 0);
  const start = new Date().getMonth();
  const months = Array.from({ length: 12 }, (_, k) => (start + k) % 12);
  const year = yearNow && yearBest && yearNow > yearBest
    ? screen("Your year ahead", `${columns(months.map((m) => ({ parts: [{ value: (yearBest * TYPICAL_MONTH_SHAPE[m]) / total, color: C.green }, { value: ((yearNow - yearBest) * TYPICAL_MONTH_SHAPE[m]) / total, color: "#f4b183" }], label: "JFMAMJJASOND"[m] })), { height: 96 })}
        ${legend([{ color: C.green, label: "On the cheapest plan" }, { color: "#f4b183", label: "Extra on your plan now" }])}`,
        "Example shape of a Victorian home's year. Members see their own, from their bill and answers, with each bill marked.")
    : "";

  // 3. Discounts and rewards: live counts for their network.
  const rw = i.rewards;
  const rewardsBlock = rw && rw.credit + rw.points + rw.gift + rw.discount > 0
    ? screen(`Discounts and rewards on ${net}`, `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:6px 0;table-layout:fixed;"><tr>
        ${[
          { n: rw.credit, l: "sign-up credits", c: "#ecfdf3", f: C.green },
          { n: rw.points, l: "points offers", c: "#fff3d6", f: "#9a6400" },
          { n: rw.gift, l: "gift cards", c: "#fde8ef", f: "#b4235a" },
          { n: rw.discount, l: "% discounts", c: "#e6f6f5", f: C.teal },
        ].map((x) => `<td align="center" valign="top" style="padding:12px 6px;border-radius:12px;background:${x.c};font-family:Arial,Helvetica,sans-serif;"><div style="font:900 26px ${"Arial,Helvetica,sans-serif"};color:${x.f};">${x.n}</div><div style="font:700 12px/1.3 Arial,Helvetica,sans-serif;color:${C.grey};margin-top:2px;">${x.l}</div></td>`).join("")}
      </tr></table>
      ${rw.topCredit ? `<div style="margin-top:12px;font:14px/1.5 Arial,Helvetica,sans-serif;color:${C.ink};">Sign-up credits of up to <strong>${money(rw.topCredit)}</strong>, from ${rw.retailers} retailers. Members see each one beside what that plan costs them a year, so a big credit on a dear plan doesn't fool anyone.</div>` : ""}`,
      "Live counts for your network today. Credits, points and gifts are never in our prices; check each retailer's terms.")
    : "";

  // 4. The market, and 5. an alert.
  const market = i.marketChanges && i.marketChanges > 0
    ? screen("Market", `<div style="font:900 34px/1 Arial,Helvetica,sans-serif;color:${C.navy};">${i.marketChanges}</div>
        <div style="font:700 14px/1.45 Arial,Helvetica,sans-serif;color:${C.ink};margin-top:4px;">offers new or changed on ${net} in the last 30 days</div>
        <div style="font:13px/1.45 Arial,Helvetica,sans-serif;color:${C.grey};margin-top:4px;">Members see every one, checked against their own bill the morning it appears.</div>`)
    : "";

  const html = `
    ${greet(i.name)}
    <p>Last week we invited you to Utilo Plus. Here's a look inside the dashboard you'd get, set up from the check you already did.</p>
    ${verdict}
    ${year}
    ${rewardsBlock}
    ${market}
    ${heading("And when something changes")}
    ${alertPreview({ title: "Your discount ends in 30 days", body: `${yearly ? `Moving now keeps about ${money(yearly)} a year in your pocket.` : "Here's the plan to move to before it does."} Tap to see it.` })}
    ${heroPanel({
      pill: FOUNDING_OFFER ? `${SPECIAL_NAME} · ends ${SPECIAL_ENDS_SHORT}` : "Utilo Plus",
      headline: `${ra ? `<s style="opacity:0.55;font-weight:700;">${fmtPrice(ra)}</s> ` : ""}${v.annual} a year: ${v.perWeek} a week`,
      body: `Your dashboard is ready the moment you join: no forms, it builds itself from your check. Or ${v.monthly} month to month.${FOUNDING_OFFER ? " Your price stays locked in while you stay." : ""} Cancel any time. Not a cent from retailers.`,
      button: { label: "Get my dashboard", url: tagged("/pricing") },
    })}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because you checked your plan with Utilo and we invited you to Plus last week. It's the last one about it.")}`;
  return {
    subject: yearly ? `A look inside your dashboard (and your ${money(yearly)} a year)` : "A look inside your Utilo dashboard",
    title: "Here's what you'd see every morning.",
    html,
  };
}

/* ---------- 4. Cheaper plan found (member) ---------- */
export function cheaperForMember(i: { origin: string; retailer: string; planName: string; yearly: number; unsubscribeUrl: string; offerNote?: string | null; prevYear?: number | null; newYear?: number | null; prevRetailer?: string | null; name?: string | null; currentRetailer?: string | null }): Email {
  const same = sameRetailer(i.currentRetailer, i.retailer);
  const html = `
    ${greet(i.name)}
    ${heroPanel({ pill: same ? "Same retailer, better plan" : "Cheaper plan found", headline: `About ${money(i.yearly)} a year less`, body: `Watching the market for you this morning, we found a plan that beats our last pick.${i.offerNote ? ` ${esc(i.offerNote)}` : ""}` })}
    ${same ? sameRetailerBonus({ retailer: i.retailer, planName: i.planName }) : ""}
    ${i.prevYear && i.newYear ? versus({ before: { label: i.prevRetailer ? `Our last pick (${esc(i.prevRetailer)})` : "Our last pick", value: i.prevYear }, after: { label: esc(i.retailer), value: i.newYear }, gapLabel: "You'd save" }) : ""}
    ${planCard({ kicker: "New cheapest for you", retailer: i.retailer, planName: i.planName, figure: { amount: i.yearly, after: "a year cheaper than our last pick." }, link: retailerLink(i.retailer), tone: "green" })}
    ${button("See it on my dashboard", `${i.origin}/account#compare`)}
    ${chips(SWITCH_FACTS)}
    ${note(esc(PRICE_CHANGE_CLAUSE))}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel Utilo Plus; manage it from your dashboard.")}`;
  return { subject: `A cheaper plan just showed up: about ${money(i.yearly)} a year less`, title: "We found a cheaper plan.", html };
}

/* ---------- 4b. Cheaper gas plan found (member) ---------- */
export function cheaperGasForMember(i: { origin: string; retailer: string; planName: string; yearly: number; vsBill: boolean; unsubscribeUrl: string; prevYear?: number | null; newYear?: number | null; name?: string | null }): Email {
  const html = `
    ${greet(i.name)}
    ${heroPanel({ pill: "Gas", headline: `A cheaper gas plan: about ${money(i.yearly)} a year less`, body: i.vsBill ? "Watching gas prices for you this morning, we found a gas plan that beats your current bill." : "Watching gas prices for you this morning, we found a gas plan that beats our last pick." })}
    ${i.prevYear && i.newYear ? versus({ before: { label: i.vsBill ? "Your gas plan now" : "Our last gas pick", value: i.prevYear }, after: { label: esc(i.retailer), value: i.newYear }, gapLabel: "You'd save" }) : ""}
    ${planCard({ kicker: "New cheapest gas plan for you", retailer: i.retailer, planName: i.planName, figure: { amount: i.yearly, after: i.vsBill ? "a year less than your gas bill, scaled to a year." : "a year less than our last pick." }, link: retailerLink(i.retailer), tone: "amber" })}
    ${button("See it on my dashboard", `${i.origin}/account`)}
    ${tip("Getting electricity from the same retailer? Ask about a dual-fuel discount when you switch.")}
    ${note(esc(PRICE_CHANGE_CLAUSE) + " Gas use swings with the seasons, so yearly figures are scaled from your bill.")}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel Utilo Plus; manage it from your dashboard.")}`;
  return { subject: `A cheaper gas plan just showed up: about ${money(i.yearly)} a year less`, title: "We found a cheaper gas plan.", html };
}

/* ---------- 5. Cheaper plan found (free user who opted in) ---------- */
export function cheaperForLead(i: { origin: string; previousRetailer: string | null; retailer: string; planName: string; yearly: number; unsubscribeUrl: string; offerNote?: string | null; prevYear?: number | null; newYear?: number | null; name?: string | null }): Email {
  const html = `
    ${greet(i.name)}
    ${heroPanel({ pill: "Prices moved", headline: `Something cheaper: about ${money(i.yearly)} a year less`, body: "Prices have moved since you checked your plan, and there's now a cheaper one for a home like yours." })}
    ${i.prevYear && i.newYear && FREE_SHOWS_NAMES ? versus({ before: { label: i.previousRetailer ? `Your earlier best (${esc(i.previousRetailer)})` : "Your earlier best", value: i.prevYear }, after: { label: esc(i.retailer), value: i.newYear }, gapLabel: "Now cheaper by" }) : ""}
    ${planCard({ kicker: "New cheapest in your area", retailer: FREE_SHOWS_NAMES ? i.retailer : "Utilo Plus shows which retailer", planName: FREE_SHOWS_NAMES ? i.planName : "The plan, its rates and sign-up conditions are on your dashboard.", figure: { amount: i.yearly, after: "a year cheaper than your earlier best match." }, link: FREE_SHOWS_NAMES ? retailerLink(i.retailer) : { label: "Unlock the cheapest plans", url: `${i.origin}/pricing` }, tone: "amber" })}
    ${button("Check it with my bill", `${i.origin}/check`)}
    ${tip(`This is priced on the usage from your earlier check. Utilo Plus watches your own bill every morning and warns you before your discount ends: <a href="${i.origin}/pricing">${plusValue().monthly} a month, or ${plusValue().annual} a year</a>.`)}
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
  name?: string | null;
}): Email {
  const short = i.what.startsWith("discount") ? "discount" : "fixed price";
  const html = `
    ${greet(i.name)}
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
/* One fuel's line in the monthly "This month" box (6 Nov 2026). */
function fuelRow(o: { icon: string; fuel: string; status: string; statusColor: string; line: string; link: { label: string; url: string } | null; first?: boolean }): string {
  return `<tr><td style="padding:14px 0;${o.first === false ? "border-top:1px solid #e3e7f0;" : ""}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td style="font:800 16px ${F};color:${C.navy};">${o.icon}&nbsp; ${o.fuel}</td>
      <td align="right" style="font:900 17px ${F};color:${o.statusColor};white-space:nowrap;">${o.status}</td>
    </tr></table>
    <div style="margin-top:4px;font:14px/1.5 ${F};color:${C.ink};">${o.line}</div>
    ${o.link ? `<div style="margin-top:6px;"><a href="${o.link.url}" style="font:700 14px ${F};color:${C.teal};text-decoration:underline;">${o.link.label} &rarr;</a></div>` : ""}
  </td></tr>`;
}

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
  /** 2 Nov 2026: the member's name off their bill, and who they're with now. */
  customerName?: string | null;
  currentRetailer?: string | null;
  /** Other retailers within $20 a year of the pick (lib/stickyPick.ts). */
  nearTies?: string[];
  /** 5 Nov 2026: the running total of money found on their bills, as one sentence. */
  found?: string | null;
}): Email {
  const name = firstNameOf(i.customerName);
  const worth = i.yearly >= WORTH_SWITCHING_PER_YEAR;
  const gasWorth = !!i.gas && i.gas.yearly >= WORTH_SWITCHING_PER_YEAR;
  // The saving is the hero: the amount, big, and the retailer to move to (2 Nov 2026).
  const link = retailerLink(i.retailer);
  // Same retailer, different plan (2 Nov 2026): a plan change, not a switch.
  const same = sameRetailer(i.currentRetailer, i.retailer);
  // 6 Nov 2026: one short email for both fuels. A "This month" box with a row each for electricity
  // and gas (what to do, and what it's worth), the money found in one line, then at most three
  // "at a glance" rows. The full detail lives on the dashboard.
  const f = i.facts ?? null;
  const sameNote = worth && same ? " No need to change retailer: it's a few taps in their app or on their website." : "";
  const elecRow = fuelRow({
    icon: "&#9889;",
    fuel: "Electricity",
    status: worth ? `${money(i.yearly)} a year` : "Stay put",
    statusColor: worth ? "#b45309" : C.green,
    line: worth
      ? `${same ? `We recommend asking ${esc(i.retailer)} to move you to <strong>${esc(i.planName)}</strong>.` : `We recommend <strong>${esc(i.retailer)}</strong> · ${esc(i.planName)}, the cheapest for your home.`}${sameNote}${i.nearTies && i.nearTies.length ? ` Also within $20: ${esc(namesList(i.nearTies))}.` : ""}`
      : `We recommend staying on your plan: nothing beats it by ${money(WORTH_SWITCHING_PER_YEAR)} a year, the point where moving is worth your time.`,
    link: worth ? link : null,
  });
  const gasRow = !i.gas
    ? ""
    : fuelRow({
        icon: "&#128293;",
        fuel: "Gas",
        status: gasWorth ? `${money(i.gas.yearly)} a year` : "Stay put",
        statusColor: gasWorth ? "#b45309" : C.green,
        line: gasWorth
          ? `We recommend <strong>${esc(i.gas.retailer)}</strong> · ${esc(i.gas.planName)}, the cheapest for your home.`
          : `We recommend staying on your gas plan: nothing beats it by ${money(WORTH_SWITCHING_PER_YEAR)} a year.`,
        link: gasWorth ? retailerLink(i.gas.retailer) : null,
        first: false,
      });
  const total = worth && gasWorth && i.gas ? i.yearly + i.gas.yearly : 0;
  const box = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border:1px solid #e3e7f0;border-radius:16px;border-collapse:separate;">
    <tr><td style="padding:6px 18px 4px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${elecRow}${gasRow}</table>
    </td></tr>
    ${total > 0 ? `<tr><td style="padding:12px 18px;background:${C.amberTint};border-radius:0 0 16px 16px;font:15px/1.4 ${F};color:${C.ink};">Together: about <strong style="color:#b45309;">${money(total)} a year</strong> to save.</td></tr>` : ""}
  </table>`;
  const foundLine = i.found ? `<p style="margin:0 0 18px;font:14px/1.5 ${F};color:${C.ink};"><span style="color:${C.green};font-weight:700;">&#10003; Money we found:</span> ${esc(i.found)}</p>` : "";
  const intro = i.isJuly
    ? "Retailers changed their prices on 1 July, so we re-checked your plans against the new ones."
    : `We re-checked your plan${i.gas ? "s" : ""} against today's prices${i.activityCount ? `, including ${i.activityCount} offers that changed on your network` : ""}.`;
  const html = `
    ${greet(i.customerName)}
    <p>${intro}</p>
    ${box}
    ${foundLine}
    ${f ? summaryGlance(i, f, 3) : ""}
    ${button("Open my dashboard", `${i.origin}/account#compare`)}
    ${unsubscribe(i.unsubscribeUrl, f ? "You're getting this monthly summary as a Utilo member. You can also turn it off on the Plus tab. This won't cancel Utilo Plus." : "You're getting this as a Utilo member. This won't cancel Utilo Plus.")}`;
  return {
    subject: `${name ? `${name}, ` : ""}${i.isJuly ? `${name ? "p" : "P"}rices changed on 1 July: your re-check` : worth ? `${name ? "y" : "Y"}our ${i.monthName} check: about ${money(i.yearly)} a year to save` : `${name ? "y" : "Y"}our ${i.monthName} check: you're on a good deal`}`,
    title: i.isJuly ? "Your 1 July re-check" : `Your ${esc(i.monthName)} check`,
    html,
  };
}

/* ---------- Monthly summary sections ---------- */
const shortDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });
type MonthlyInput = Parameters<typeof monthlyCheck>[0];

const INK = { you: "#e8590c", best: "#16a34a", vdo: "#b8bfcf", navy: "#22306e", light: "#c7cde0", amber: "#f5a623", teal: "#14b8a6", free: "#16a34a", soak: "#5eead4", peak: "#f87171", off: "#c7cde0" };

/** "At a glance": one line per topic with a small chart and a link to the full chart on the dashboard. */
function summaryGlance(i: MonthlyInput, f: SummaryFacts, max = 99): string {
  const open = (what: string) => `${i.origin}/account?open=${what}#home`;
  const rows: string[] = [];
  const y = f.charts.year;

  // The short monthly email (max 3) leaves out the year row: the "This month" box already has the saving.
  if (y.vsBill && max >= 99) {
    rows.push(glanceRow({
      dot: INK.you,
      // A bill cheaper than every plan on sale (an old deal, a concession): say so, don't imply the "cheapest" costs more.
      title: y.best >= y.you ? `Your year: about ${money(y.you)}. No plan on sale beats it` : `Your year: ${money(y.you)} now, ${money(y.best)} on the cheapest`,
      line: y.best >= y.you ? `The cheapest plan on sale would be about ${money(y.best)}, the default offer ${money(y.vdo)}. Hold on to your deal while it lasts.` : `The default offer would be ${money(y.vdo)}.`,
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
  return rows.length ? heading("At a glance") + glance(rows.slice(0, max)) : "";
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
  /** Our tracked Google review link, when one is set up. */
  reviewLink?: string | null;
  /** 5 Nov 2026: the running total of money found on their bills, as one sentence. */
  found?: string | null;
}): Email {
  const saved = i.switched && i.savedSoFar >= 1;
  const html = `
    ${greet(i.name)}
    <p>Your membership renews soon, so here's what Utilo did for you this year.</p>
    ${heroPanel({ pill: "Your year with Utilo Plus", headline: `We checked your plan every morning for ${i.daysWatched.toLocaleString("en-AU")} days.`, body: `Every plan${i.network ? ` on the ${esc(i.network)} network` : ""} re-priced against your own bill, so you didn't have to keep an eye on the market.` })}
    ${statRow([
      { big: i.daysWatched.toLocaleString("en-AU"), small: "days watched", tone: "navy" },
      { big: i.marketChanges > 0 ? i.marketChanges.toLocaleString("en-AU") : "Daily", small: i.marketChanges > 0 ? "offer changes checked" : "price checks", tone: "amber" },
      saved ? { big: money(i.savedSoFar), small: "saved since you switched", tone: "green" } : { big: i.availableYear && i.availableYear >= WORTH_SWITCHING_PER_YEAR ? money(i.availableYear) : "On track", small: i.availableYear && i.availableYear >= WORTH_SWITCHING_PER_YEAR ? "a year, there to save now" : "no move needed right now", tone: "green" },
    ])}
    ${!i.switched && i.availableYear && i.availableYear >= WORTH_SWITCHING_PER_YEAR && i.nowYear && i.bestYear
      ? `${heading("Still there to save")}${versus({ before: { label: "Your plan now", value: i.nowYear }, after: { label: i.bestRetailer ? esc(i.bestRetailer) : "The cheapest plan", value: i.bestYear }, gapLabel: "You could save" })}${button("See my options", `${i.origin}/account#compare`)}`
      : ""}
    ${i.found ? statusBox({ kicker: "Money we found on your bills", headline: esc(i.found), body: "Fees to ask back, discounts you missed, concessions and cheaper plans with your own retailer: each one on your dashboard with exactly what to ask for.", tone: "green" }) : ""}
    ${heading("Coming up in your next year")}
    ${tiles([
      { sym: "!", title: "Never miss a price jump", text: "A month's warning before your discount or fixed price ends.", tint: "amber" },
      { sym: "&#8635;", title: "1 July re-check", text: "Retailers change their prices; we re-run everything for you.", tint: "teal" },
      { sym: "&#9993;", title: "Only emails that pay", text: `One email when switching saves ${money(WORTH_SWITCHING_PER_YEAR)}+ a year.`, tint: "green" },
      { sym: "&#9638;", title: "Your bills in one place", text: "Snap each bill, power and gas, and see your year build up.", tint: "navy" },
    ])}
    ${statusBox({ kicker: "Your renewal", headline: `${esc(i.priceLabel)} on ${esc(i.renewsOn)}`, body: `${i.founding ? `Your ${SPECIAL_NAME} price stays the same. ` : ""}Nothing to do to keep going. To change or cancel, it's on your dashboard under Plus, any time before then.`, tone: "teal" })}
    ${button("Open my dashboard", `${i.origin}/account#membership`)}
    ${i.reviewLink ? `${stars().replace("24px", "16px").replace("margin:0 0 6px", "margin:8px 0 4px")}<p style="margin:0 0 8px;font-size:14px;">A year in: how are we doing? <a href="${i.reviewLink}">Leave us a Google review</a>. It takes a minute and helps other Victorians decide.</p>` : ""}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because your Utilo Plus membership renews soon.")}`;
  return {
    subject: saved ? `Your year with Utilo: ${money(i.savedSoFar)} saved` : `Your year with Utilo: renewing ${i.renewsOn}`,
    title: saved ? `${money(i.savedSoFar)} saved this year.` : "Your year with Utilo Plus.",
    html,
  };
}

/* ---------- Google review request (2 Nov 2026) ----------
   Same ask for everyone at the same point (no gating), nothing offered for it.
   "switched": 3 weeks after they switched; "member": 45 days in, not switched;
   "reminder": once, a week later, if they didn't click. */
export function reviewAsk(i: {
  origin: string;
  name?: string | null;
  kind: "switched" | "member" | "reminder";
  /** Our tracked link (lib/reviews.ts), which goes on to Google. */
  url: string;
  switchedTo?: string | null;
  daysWatched?: number | null;
  unsubscribeUrl: string;
}): Email {
  const lead = i.kind === "switched"
    ? `It's been a few weeks since you switched${i.switchedTo ? ` to ${esc(i.switchedTo)}` : ""}. We hope the new plan is treating you well.`
    : i.kind === "member"
      ? `You've had Utilo Plus watching your plan for ${i.daysWatched && i.daysWatched > 0 ? `${i.daysWatched} days` : "a while now"}.`
      : "Just a quick follow-up to last week's note.";
  const html = `
    ${greet(i.name)}
    <p>${lead} Could you tell other Victorians what Utilo is like? A Google review takes about a minute.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
      <tr><td align="center" style="padding:24px 20px;border-radius:16px;background:${C.amberTint};">
        ${stars()}
        <div style="font:800 21px/1.3 Arial,Helvetica,sans-serif;color:${C.navy};margin:6px 0 4px;">How did we do?</div>
        <div style="font:14.5px/1.5 Arial,Helvetica,sans-serif;color:${C.ink};margin:0 0 16px;">Good, bad or somewhere in between, an honest review helps people decide, and tells us what to fix.</div>
        <table role="presentation" cellspacing="0" cellpadding="0" align="center"><tr><td style="border-radius:999px;background:${C.amber};"><a href="${i.url}" style="display:inline-block;padding:13px 26px;font:800 15px Arial,Helvetica,sans-serif;color:${C.amberInk};text-decoration:none;border-radius:999px;">Leave a Google review &rarr;</a></td></tr></table>
      </td></tr>
    </table>
    ${i.kind !== "reminder" ? steps([
      step(1, "Tap the button", "It opens Utilo's page on Google, signed in with your Google account."),
      step(2, "Pick your stars", "One to five, whatever feels right."),
      step(3, "Add a line or two (optional)", "What did Utilo do for you? What could be better?"),
    ]) : ""}
    <p style="margin:0 0 8px;font-size:13px;color:#5f6b82;">${i.kind === "reminder" ? "This is the last time we'll ask." : "We'll ask once more at most."} Thanks for being a member.</p>
    ${unsubscribe(i.unsubscribeUrl, "You're getting this as a Utilo member. This won't cancel Utilo Plus.")}`;
  return {
    subject: i.kind === "reminder" ? "One minute for a quick review?" : i.kind === "switched" ? `${firstNameOf(i.name) ? `${firstNameOf(i.name)}, how` : "How"} did the switch go?` : `${firstNameOf(i.name) ? `${firstNameOf(i.name)}, how` : "How"} are we doing?`,
    title: i.kind === "switched" ? "How did the switch go?" : "How are we doing?",
    html,
  };
}

/* ---------- Cancelled (2 Nov 2026) ----------
   Sent once when a member cancels. "scheduled": it runs to the end of what
   they've paid for. "ended": it stopped straight away (cancelled now, or
   payments failed). No guilt trip: the date, no more charges, what stops,
   and the price they'd come back at. */
export function membershipCancelled(i: {
  origin: string;
  name?: string | null;
  kind: "scheduled" | "ended";
  /** "16 November 2026" — the last day, for "scheduled". */
  endsOn?: string | null;
  /** Their locked price, e.g. "$39 a year", when they're on the New Year special price. */
  lockedPrice?: string | null;
  /** The regular price they'd rejoin at, e.g. "$45 a year". */
  regularPrice?: string | null;
}): Email {
  const scheduled = i.kind === "scheduled" && !!i.endsOn;
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "Australia/Melbourne" });
  const priceNote = i.lockedPrice && i.regularPrice
    ? tip(`<strong>About your price.</strong> Your ${esc(i.lockedPrice)} ${SPECIAL_NAME} price stays only while you're a member. ${FOUNDING_OFFER ? `Rejoin before ${SPECIAL_ENDS_LABEL} and you'll get it again; after that it's ${esc(i.regularPrice)}.` : `If you rejoin later, it's ${esc(i.regularPrice)}.`}`)
    : "";
  const html = `
    ${greet(i.name)}
    <p>${scheduled ? "We've cancelled your Utilo Plus membership, as you asked. You won't be charged again." : "Your Utilo Plus membership has ended, and you won't be charged again."}</p>
    ${scheduled
      ? endTimeline({ leftTitle: "Today", leftSmall: `Cancelled ${esc(today)}`, rightTitle: esc(i.endsOn!), rightSmall: "Last day of Plus. No more charges." })
      : bigFigure({ figure: "&#10003; Ended", label: "Utilo Plus", body: "No more charges. Your free checks are still there whenever you want one.", tone: "teal" })}
    ${heading(scheduled ? `Until ${esc(i.endsOn!)}, everything keeps working` : "What stops now")}
    ${tiles([
      { sym: "&#8635;", title: "Daily re-checks", text: "Every plan re-priced against your bill each morning.", tint: "teal" },
      { sym: "!", title: "Price-jump warnings", text: "A month's notice before a discount or fixed price ends.", tint: "amber" },
      { sym: "&#9993;", title: "Cheaper-plan alerts", text: `One email when switching saves ${money(WORTH_SWITCHING_PER_YEAR)}+ a year.`, tint: "green" },
      { sym: "&#9638;", title: "Your dashboard", text: "Your bills, savings and year ahead in one place.", tint: "navy" },
    ])}
    ${priceNote}
    ${scheduled
      ? `${heading("Changed your mind?")}<p style="margin:0 0 12px;">You can keep your membership any time before ${esc(i.endsOn!)}: open your dashboard, go to Plus and tap <strong>Manage billing</strong>, then <strong>Renew</strong>. Nothing changes and your price stays the same.</p>${button("Keep my membership", `${i.origin}/account#membership`)}`
      : `${button("Rejoin Utilo Plus", `${i.origin}/pricing`)}<p style="margin:0 0 12px;">Or <a href="${i.origin}/check">run a free check</a> any time.</p>`}
    ${note(`Want your details gone? Sign in and use <strong>Privacy and your data</strong> at the bottom of your dashboard to delete them. Thanks for trying Utilo.`)}`;
  return {
    subject: scheduled ? `Your Utilo Plus ends on ${i.endsOn}` : "Your Utilo Plus membership has ended",
    title: scheduled ? "Your membership is cancelled." : "Your membership has ended.",
    html,
  };
}

/* ---------- Referral: a friend joined with the member's link ----------
   No friend's name or email: just that someone joined and the credit. */
export function referralCreditEmail(i: { origin: string; name?: string | null }): Email {
  const credit = referralDollars(REFERRAL_CREDIT_CENTS);
  const html = `
    ${greet(i.name)}
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
export function duplicatePaymentEmail(i: { origin: string; name?: string | null }): Email {
  const html = `
    ${greet(i.name)}
    <p>You were already a Utilo member under this email, so we've cancelled the second membership and refunded that payment in full. Your original membership carries on as normal.</p>
    ${bigFigure({ figure: "&#10003; Refunded", label: "Second payment", body: "On its way back to your card. Refunds usually show within 5 to 10 business days, depending on your bank.", tone: "green" })}
    ${button("Open my dashboard", `${i.origin}/account#membership`)}`;
  return { subject: "You were already a member: we've refunded the second payment", title: "Second payment refunded", html };
}

/* ---------- Member login: the sign-in link ----------
   One button. Works once, for about an hour. */
export function signInEmail(i: { origin: string; url: string; name?: string | null }): Email {
  const html = `
    ${greet(i.name)}
    ${heroPanel({ pill: "Sign in", headline: "Your dashboard is one tap away", body: "No password needed. This link works once, for about an hour, on the device you open it on.", button: { label: "Sign in to Utilo", url: i.url } })}
    ${note("Didn't ask for this? You can ignore it; nobody can sign in without this email. Need a fresh link later? Go to Log in and enter this address again.")}
    <p style="margin:16px 0 0;font-size:13px;color:#5f6b82;">Sent from Utilo, ${esc(i.origin.replace(/^https?:\/\//, ""))}.</p>`;
  return { subject: "Your Utilo sign-in link", title: "Sign in to Utilo", html };
}

export { signOff };

/* ---------- Switch reminder (member asked for it on the dashboard) ----------
   2 Nov 2026: "Remind me" by email. A one-off they set themselves: sent the
   morning of the day they picked, then forgotten. */
export function switchReminderEmail(i: {
  origin: string;
  name?: string | null;
  retailer: string;
  planName: string;
  savingYear: number;
  same: boolean;
  nmi?: string | null;
}): Email {
  const link = RETAILER_LINKS[i.retailer];
  const r = esc(i.retailer);
  const html = `
    ${greet(i.name)}
    <p>You asked us to remind you today${i.same ? ` to change your plan with ${r}` : ` to switch to ${r}`}. Here's everything you need, in one place.</p>
    ${moneyHero({
      pill: i.same ? "Same retailer, better plan" : "Your reminder",
      amount: i.savingYear,
      after: i.same ? `a year less, staying with ${r}` : "a year less (what we found when you set this)",
      retailer: r,
      planName: esc(i.planName),
      toLabel: i.same ? "Ask them to move you to" : "Switch to",
      button: link ? { label: `Go to ${r}`, url: link } : null,
    })}
    ${i.same ? sameRetailerBonus({ retailer: i.retailer, planName: i.planName }) : ""}
    ${heading("Before you start")}
    ${steps([
      step(1, "Check it's still the cheapest", `Prices change. Your dashboard re-checks every morning: <a href="${i.origin}/account#compare">see today's pick</a>.`),
      step(2, "Have these handy", `Your latest bill${i.nmi ? ` and your NMI: <strong>${esc(i.nmi)}</strong>` : " and your NMI (on the bill)"}.`),
      step(3, i.same ? `Ask ${r} for the plan` : `Sign up with ${r}`, i.same ? `Call them or open their app and ask to move to <strong>${esc(i.planName)}</strong>. Same account, no switching.` : `Search for <strong>${esc(i.planName)}</strong> on ${r}'s site. Your power stays on and there's a 10-day cooling-off period.`),
      step(4, "Tell us when it's done", `<a href="${i.origin}/account#savings">Add the date on your dashboard</a> so your savings count from the right day.`),
    ])}
    ${note(`You set this one-off reminder on your dashboard. We won't send it again. ${esc(PRICE_CHANGE_CLAUSE)}`)}`;
  return {
    subject: i.same ? `Reminder: ask ${i.retailer} for ${i.planName} today` : `Reminder: switch to ${i.retailer} today`,
    title: i.same ? "Today's the day: change your plan." : "Today's the day to switch.",
    html,
  };
}

/* ---------- First check (8 Nov 2026) ----------
   Sent once, the first time a member's bill is read (uploaded or forwarded):
   their result, what Plus does from here, and "keep the bills coming". After
   this, the only emails are the morning alert when a plan beats theirs by their
   alert amount, the discount-ending warning and the monthly summary. */
export interface FirstCheckFuel {
  retailer: string;          // the cheapest plan's retailer
  planName: string;
  nowYear: number;           // their bill, a year
  bestYear: number;          // the cheapest plan, a year
  currentRetailer?: string | null;
}
export function firstCheckEmail(i: {
  origin: string;
  name?: string | null;
  elec: FirstCheckFuel | null;
  gas: FirstCheckFuel | null;
  alertMin: number;          // $ a year before we email
  inboxAddress: string | null;
  reelUrl: string | null;    // the "how it works" reel on the site, when the file is there
  unsubscribeUrl: string;
  lessons?: string[];        // 8 Nov 2026: one line per fuel from their own bill
}): Email {
  const saving = (f: FirstCheckFuel | null) => (f ? Math.max(0, f.nowYear - f.bestYear) : 0);
  const sE = saving(i.elec), sG = saving(i.gas);
  const total = sE + sG;
  const anyWorth = sE >= WORTH_SWITCHING_PER_YEAR || sG >= WORTH_SWITCHING_PER_YEAR;
  const subject = anyWorth ? `Your first check: about ${money(total)} a year on the table` : "Your first check: you're on a good deal";
  const title = anyWorth ? "First check done. Here's where you stand." : "First check done. You're on a good deal.";
  const dash = `${i.origin}/account`;

  const fuelBlock = (f: FirstCheckFuel | null, label: string, icon: string, first: boolean) => {
    if (!f) return "";
    const sv = saving(f);
    const worth = sv >= WORTH_SWITCHING_PER_YEAR;
    const same = worth && sameRetailer(f.currentRetailer ?? null, f.retailer);
    return fuelRow({
      icon, fuel: label, first,
      status: worth ? `${money(sv)} a year less` : "Stay put",
      statusColor: worth ? C.green : C.teal,
      line: worth
        ? `<strong>${esc(f.retailer)}</strong>&rsquo;s ${esc(f.planName)} comes out about ${money(f.bestYear)} a year on your usage, against ${money(f.nowYear)} on your bill.${same ? " Same retailer: ask them to move you, no switch needed." : ""}`
        : `Your plan is about ${money(f.nowYear)} a year on your usage. The cheapest we found (${esc(f.retailer)}, ${money(f.bestYear)}) doesn&rsquo;t beat it by ${money(WORTH_SWITCHING_PER_YEAR)}, so there&rsquo;s nothing to do.`,
      link: worth ? { label: "See it on my dashboard", url: dash } : null,
    });
  };
  const mainFuel = i.elec ?? i.gas;
  const bars = mainFuel ? billVsBest({ origin: i.origin, nowLabel: "Your bill", now: mainFuel.nowYear, best: mainFuel.bestYear, money }) : "";

  const html = `
    ${greet(i.name)}
    <p>We&rsquo;ve read your bill and priced every plan on your network against it. ${anyWorth ? `About <strong>${money(total)} a year</strong> is on the table.` : "Nothing beats your plan by enough to bother, which is good news."} Here&rsquo;s your result, and what happens from here.</p>
    ${bars}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border:1px solid #e3e7f0;border-radius:16px;border-collapse:separate;padding:0 18px;">
      ${fuelBlock(i.elec, "Electricity", "&#9889;", true)}
      ${fuelBlock(i.gas, "Gas", "&#128293;", !i.elec)}
    </table>
    ${(i.lessons ?? []).map((t) => lessonLine(esc(t))).join("")}
    ${button("Open my dashboard", dash)}

    ${heading("What happens now")}
    ${iconRows([
      iconRow("", "Every morning", "we re-price every plan against this bill. New offers, price rises, discounts ending: all of it."),
      iconRow("", `Only when it matters`, `you get one email, the day a plan beats yours by ${money(i.alertMin)} a year or more. <b>Quiet means you&rsquo;re fine.</b> Change the amount on your dashboard.`),
      iconRow("", "On the 1st of each month", "a short summary: your bill, what you&rsquo;ve saved, what moved in the market."),
      iconRow("", "A month before a discount ends", "a heads-up, if you&rsquo;ve told us the date."),
    ])}
    ${plusMorning(i.origin, dash)}
    ${i.reelUrl ? `<p style="margin:0 0 20px;"><a href="${i.reelUrl}" style="font:700 15px ${F};color:${C.teal};text-decoration:underline;">Watch how it works (16 seconds) &rarr;</a></p>` : ""}

    ${heading("Keep the bills coming")}
    <p>Each new bill updates your numbers and re-checks every plan the same day. ${i.inboxAddress
      ? `The easy way: forward every bill to your private address, <strong>${esc(i.inboxAddress)}</strong>, or set your email to do it for you. Two minutes, once.`
      : "The easy way: set up bill forwarding on your dashboard (two minutes, once) and every bill your retailer sends comes straight to us."}</p>
    ${button(i.inboxAddress ? "Set up automatic forwarding" : "Set up bill forwarding", `${i.origin}/account#bill-inbox`, "4px 0 20px")}
    ${note(`We never call you and we never switch you. Switching is always your call, on the retailer&rsquo;s own site. ${esc(PRICE_CHANGE_CLAUSE)}`)}
    ${signOff}
    ${unsubscribe(i.unsubscribeUrl, "You're getting this because your first bill was read as a Utilo Plus member. Your daily checks keep running while you're a member; this link stops the extra emails.")}`;
  return { subject, title, html };
}

// The welcome email a new member gets straight after paying.
// Edit the wording here. Keep it table-based with inline styles: that is what
// survives Gmail, Outlook and phone mail apps. Everything a customer supplied
// goes through esc() before it is put in the HTML.

import { esc } from "./email";
import { RETAILER_LINKS } from "./retailerLinks";
import { WORTH_SWITCHING_PER_YEAR } from "./dataPolicy";
import { REFERRAL_CREDIT_CENTS, REFERRAL_FRIEND_CENTS, referralDollars } from "./referralOffer";
import { greet, keepBg, keepWhite } from "./emailParts";

export interface WelcomeEmailInput {
  origin: string;
  customerName: string | null;
  planName: string;          // "Yearly"
  priceLabel: string;        // "$39 a year"
  bestRetailer: string | null;
  bestPlanName: string | null;
  /** What they'd save a year on the best plan vs their own bill; null if we don't know their bill. */
  yearlySaving: number | null;
  /** They already gave us a bill photo at the check. */
  fromBill?: boolean;
  /** A one-time sign-in link, so this one email both welcomes them and signs
   *  them in (no separate "your sign-in link" email). Null: they get the
   *  sign-in link separately, and the email says so. */
  signInUrl?: string | null;
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

function firstName(full: string | null): string | null {
  const f = (full ?? "").trim().split(/\s+/)[0];
  if (!f || f.length > 30) return null;
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}

const F = "Arial,Helvetica,sans-serif";
const NAVY = "#131c57";
const GREY = "#5f6b82";
const TEAL = "#0d6f78";
const AMBER = "#f5a623";

/** One numbered step: amber circle, bold line, quiet line. */
function step(n: number, title: string, body: string): string {
  return `<tr>
    <td valign="top" style="width:30px;padding:0 12px 16px 0;">
      <div style="width:28px;height:28px;border-radius:14px;background:${AMBER};color:#171305;font:800 14px/28px ${F};text-align:center;">${n}</div>
    </td>
    <td valign="top" style="padding:0 0 16px;font:15px/1.45 ${F};color:#1a1a1a;">
      <strong>${title}</strong><br><span style="color:${GREY};font-size:14px;">${body}</span>
    </td>
  </tr>`;
}

/** One row of the "your first weeks" timeline: when (left), what (right), joined by a line. */
function when(label: string, what: string, last = false): string {
  return `<tr>
    <td valign="top" style="width:14px;padding:0 12px 0 2px;">
      <div style="width:12px;height:12px;border-radius:6px;background:#0ea5a0;margin-top:4px;"></div>
      ${last ? "" : `<div style="width:2px;height:30px;background:#cfe9e7;margin:4px 0 0 5px;"></div>`}
    </td>
    <td valign="top" style="padding:0 0 ${last ? 4 : 12}px;font:14px/1.45 ${F};color:#1a1a1a;">
      <strong style="color:${NAVY};">${label}</strong><br><span style="color:${GREY};">${what}</span>
    </td>
  </tr>`;
}

export function welcomeEmail(i: WelcomeEmailInput): { subject: string; title: string; html: string } {
  const name = firstName(i.customerName);
  const worth = i.yearlySaving !== null && i.yearlySaving >= WORTH_SWITCHING_PER_YEAR;
  const dash = `${i.origin}/account`;

  const subject = worth
    ? `Welcome to Utilo Plus${name ? `, ${name}` : ""}. Let's get that ${money(i.yearlySaving as number)} a year`
    : `Welcome to Utilo Plus${name ? `, ${name}` : ""}. We're watching your plan now`;
  const title = "Welcome aboard."; // the "Hi Sam," line right under it carries the name

  // The hero: what just happened, and the one thing to do now.
  const hero = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
    <tr><td style="padding:22px 22px 20px;border-radius:16px;${keepBg(NAVY)}">
      <div style="display:inline-block;padding:3px 10px;border-radius:999px;background:${AMBER};color:#171305;font:800 11px ${F};letter-spacing:0.6px;text-transform:uppercase;">Utilo Plus &middot; ${esc(i.planName)}</div>
      ${keepWhite(`<div style="margin:12px 0 6px;font:800 24px/1.2 ${F};color:#ffffff;">You're in. We'll take it from here.</div>
      <div style="font:15px/1.55 ${F};color:#ffffff;opacity:0.82;">From tomorrow morning we re-price every plan against your home, every day, and email you only when switching saves ${money(WORTH_SWITCHING_PER_YEAR)} or more a year.</div>`)}
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0 0;"><tr><td style="border-radius:999px;background:${AMBER};">
        <a href="${i.signInUrl ?? dash}" style="display:inline-block;padding:13px 24px;font:800 15px ${F};color:#171305;text-decoration:none;border-radius:999px;">${i.signInUrl ? "Sign in to my dashboard" : "Open my dashboard"} &rarr;</a>
      </td></tr></table>
      ${keepWhite(i.signInUrl ? `<div style="margin-top:10px;font:12.5px/1.5 ${F};color:#ffffff;opacity:0.65;">The button signs you in on this device. It works once, for about an hour. After that, use Log in on the site with this email address.</div>` : `<div style="margin-top:10px;font:12.5px/1.5 ${F};color:#ffffff;opacity:0.65;">We've sent your sign-in link in a separate email.</div>`)}
    </td></tr>
  </table>`;

  const retailerLink = i.bestRetailer ? RETAILER_LINKS[i.bestRetailer] : undefined;
  const matchBox = i.bestRetailer
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:2px solid #0ea5a0;border-radius:14px;">
        <tr><td style="padding:16px 18px;font-family:${F};">
          <div style="font:700 11px ${F};letter-spacing:1.2px;color:${TEAL};text-transform:uppercase;">Your best match today</div>
          <div style="font:800 20px/1.3 ${F};color:${NAVY};margin-top:6px;">${esc(i.bestRetailer)}</div>
          ${i.bestPlanName ? `<div style="font:14px ${F};color:${GREY};margin-top:2px;">${esc(i.bestPlanName)}</div>` : ""}
          ${worth ? `<div style="margin-top:12px;font:15px ${F};color:#1a1a1a;">About <strong style="font-size:24px;color:#15803d;">${money(i.yearlySaving as number)}</strong> a year less than your current bill.</div>` : `<div style="margin-top:10px;font:14px ${F};color:${GREY};">You're already close to the cheapest. We'll tell you the day that changes.</div>`}
          ${retailerLink && worth ? `<div style="margin-top:12px;"><a href="${retailerLink}" style="font:700 14px ${F};color:${TEAL};">See the plan on ${esc(i.bestRetailer)}'s site &rarr;</a></div>` : ""}
        </td></tr>
      </table>`
    : "";

  const html = `
    ${greet(i.customerName)}
    ${hero}
    ${matchBox}
    <p style="font:800 17px ${F};color:${NAVY};margin:4px 0 14px;">Your first weeks</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
      ${when("Today", "Your dashboard is ready, set up from your check: your plan, your usage and every plan ranked.")}
      ${when("Tomorrow, 6am", "Your first daily re-check. If a plan beats yours by enough, you'll hear from us.")}
      ${when("Once a month", "A short summary: where you stand, your next bill and what changed in the market.")}
      ${when("30 days before your deal ends", "A warning, with your options, while there's time to move.", true)}
    </table>

    <p style="font:800 17px ${F};color:${NAVY};margin:4px 0 14px;">Get the most from it</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 10px;">
      ${i.fromBill
        ? step(1, "Snap each new bill", "We've read this one. Snap the next one when it arrives, so your checks follow your real usage through the seasons.")
        : step(1, "Snap your latest bill", "So every check uses your real usage and the rates you actually pay. About 30 seconds.")}
      ${step(2, "Add your discount end date", "It's on your welcome pack or in your retailer's app. We'll warn you a month before.")}
      ${step(3, "Switched? Tell us the date", "Your savings tally counts from that day. Gas too: snap a gas bill and we'll watch both.")}
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px 0 20px;border-collapse:separate;">
      <tr><td style="padding:16px 18px;border-radius:14px;background:#fff6e5;border:1px solid #f3e2b8;font:14px/1.5 ${F};color:#1a1a1a;">
        <strong style="font-size:15px;color:${NAVY};">Give ${referralDollars(REFERRAL_FRIEND_CENTS)}, get ${referralDollars(REFERRAL_CREDIT_CENTS)}</strong><br>
        <span style="color:${GREY};">Your own share link is on your dashboard, under Plus. A friend who joins gets ${referralDollars(REFERRAL_FRIEND_CENTS)} off, and you get ${referralDollars(REFERRAL_CREDIT_CENTS)} off your next payment.</span>
      </td></tr>
    </table>

    <p style="margin:0;padding:12px 14px;border-radius:10px;background:#f4f6fb;font:13px/1.5 ${F};color:${GREY};">
      Your plan: <strong style="color:#1a1a1a;">${esc(i.planName)}, ${esc(i.priceLabel)}</strong>. No lock-in: change or cancel any time from your dashboard.
    </p>
    <p style="margin:18px 0 0;font:15px/1.5 ${F};">Questions? Just reply to this email.<br>The Utilo team</p>
  `;

  return { subject, title, html };
}

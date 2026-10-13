// The welcome email a new member gets straight after paying.
// Edit the wording here. Keep it table-based with inline styles: that is what
// survives Gmail, Outlook and phone mail apps. Everything a customer supplied
// goes through esc() before it is put in the HTML.

import { esc } from "./email";
import { RETAILER_LINKS } from "./retailerLinks";
import { WORTH_SWITCHING_PER_YEAR } from "./dataPolicy";

export interface WelcomeEmailInput {
  origin: string;
  customerName: string | null;
  planName: string;          // "Yearly"
  priceLabel: string;        // "$39 a year"
  bestRetailer: string | null;
  bestPlanName: string | null;
  /** What they'd save a year on the best plan vs their own bill; null if we don't know their bill. */
  yearlySaving: number | null;
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

function firstName(full: string | null): string | null {
  const f = (full ?? "").trim().split(/\s+/)[0];
  if (!f || f.length > 30) return null;
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}

/** One numbered step: amber circle, bold line, quiet line. */
function step(n: number, title: string, body: string): string {
  return `<tr>
    <td valign="top" style="width:30px;padding:0 12px 14px 0;">
      <div style="width:28px;height:28px;border-radius:14px;background:#f5a623;color:#171305;font:800 14px/28px Arial,Helvetica,sans-serif;text-align:center;">${n}</div>
    </td>
    <td valign="top" style="padding:0 0 14px;font:15px/1.45 Arial,Helvetica,sans-serif;color:#1a1a1a;">
      <strong>${title}</strong><br><span style="color:#5f6b82;font-size:14px;">${body}</span>
    </td>
  </tr>`;
}

/** One "what we watch" row: small icon tile, when, what. */
function watch(icon: string, when: string, what: string): string {
  return `<tr>
    <td valign="top" style="width:34px;padding:0 10px 10px 0;">
      <div style="width:30px;height:30px;border-radius:9px;background:#e6f6f5;font:16px/30px Arial;text-align:center;">${icon}</div>
    </td>
    <td valign="top" style="padding:3px 0 10px;font:14px/1.45 Arial,Helvetica,sans-serif;color:#1a1a1a;">
      <strong>${when}</strong> <span style="color:#5f6b82;">${what}</span>
    </td>
  </tr>`;
}

export function welcomeEmail(i: WelcomeEmailInput): { subject: string; title: string; html: string } {
  const name = firstName(i.customerName);
  const worth = i.yearlySaving !== null && i.yearlySaving >= WORTH_SWITCHING_PER_YEAR;
  const dash = `${i.origin}/account`;

  const subject = worth
    ? `Welcome to Utilo. Let's get that ${money(i.yearlySaving as number)} a year`
    : "Welcome to Utilo. We're watching your plan now";
  const title = name ? `Welcome, ${esc(name)}. You're all set.` : "Welcome. You're all set.";

  const retailerLink = i.bestRetailer ? RETAILER_LINKS[i.bestRetailer] : undefined;
  const matchBox = i.bestRetailer
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 22px;border:2px solid #0ea5a0;border-radius:14px;">
        <tr><td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;">
          <div style="font:700 11px Arial;letter-spacing:1.2px;color:#0d6f78;text-transform:uppercase;">Your best match at sign-up</div>
          <div style="font:800 20px/1.3 Arial,Helvetica,sans-serif;color:#131c57;margin-top:6px;">${esc(i.bestRetailer)}</div>
          ${i.bestPlanName ? `<div style="font:14px Arial;color:#5f6b82;margin-top:2px;">${esc(i.bestPlanName)}</div>` : ""}
          ${worth ? `<div style="margin-top:12px;font:15px Arial;color:#1a1a1a;">About <strong style="font-size:22px;color:#0d6f78;">${money(i.yearlySaving as number)}</strong> a year less than your current bill.</div>` : ""}
          ${retailerLink ? `<div style="margin-top:12px;"><a href="${retailerLink}" style="font:700 14px Arial;color:#0d6f78;">See the plan on ${esc(i.bestRetailer)}'s site &rarr;</a></div>` : ""}
        </td></tr>
      </table>`
    : "";

  const html = `
    <p>Your membership is active. From tomorrow morning we re-price your plan against every plan we track, and email you only when switching is worth ${money(WORTH_SWITCHING_PER_YEAR)} or more a year.</p>
    ${matchBox}
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;"><tr><td style="border-radius:999px;background:#f5a623;">
      <a href="${dash}" style="display:inline-block;padding:13px 26px;font:700 15px Arial,Helvetica,sans-serif;color:#171305;text-decoration:none;border-radius:999px;">Open my dashboard &rarr;</a>
    </td></tr></table>
    <p style="font:800 16px Arial,Helvetica,sans-serif;color:#131c57;margin:4px 0 12px;">Three quick things</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">
      ${step(1, "Sign in", "We've sent you a separate sign-in link. Use that, or enter this email address on the sign-in page.")}
      ${step(2, "Snap your latest bill", "So every check uses your real usage and the rates you actually pay.")}
      ${step(3, "Switched? Add the date", "Your savings tally counts from that day. Add any discount or fixed-price end date too.")}
    </table>
    <p style="font:800 16px Arial,Helvetica,sans-serif;color:#131c57;margin:8px 0 12px;">What we watch for you</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 10px;">
      ${watch("&#128260;", "Every morning:", "your plan re-priced against today's prices.")}
      ${watch("&#128276;", "30 days before:", "your discount or fixed price ends.")}
      ${watch("&#128197;", "1 July:", "a re-check when retailers change their prices.")}
      ${watch("&#128200;", "1st of each month:", "a short summary of where you stand.")}
    </table>
    <p style="margin:16px 0 0;padding:12px 14px;border-radius:10px;background:#f4f6fb;font-size:13px;color:#5f6b82;">
      Your plan: <strong style="color:#1a1a1a;">${esc(i.planName)}, ${esc(i.priceLabel)}</strong>. Change or cancel any time from your dashboard.
    </p>
    <p style="margin:16px 0 0;">Questions? Just reply to this email.<br>The Utilo team</p>
  `;

  return { subject, title, html };
}

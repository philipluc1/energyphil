// Building blocks shared by every Utilo email (see lib/emailTemplates.ts and
// lib/welcomeEmail.ts). Table-based with inline styles, because that is what
// Gmail, Outlook and phone mail apps render reliably. Pass any text a customer
// supplied through esc() before it goes in.

import { esc } from "./email";

export const C = {
  navy: "#131c57",
  teal: "#0d6f78",
  tealBright: "#0ea5a0",
  tealTint: "#e6f6f5",
  amber: "#f5a623",
  amberTint: "#fff6e5",
  amberInk: "#171305",
  green: "#15803d",
  greenTint: "#ecfdf3",
  grey: "#5f6b82",
  greyTint: "#f4f6fb",
  ink: "#1a1a1a",
};
const F = "Arial,Helvetica,sans-serif";

export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

/** Amber pill button. */
export function button(label: string, url: string, margin = "4px 0 24px"): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:${margin};"><tr><td style="border-radius:999px;background:${C.amber};">
    <a href="${url}" style="display:inline-block;padding:13px 26px;font:700 15px ${F};color:${C.amberInk};text-decoration:none;border-radius:999px;">${label} &rarr;</a>
  </td></tr></table>`;
}

/** Bold section heading inside the body. */
export function heading(text: string): string {
  return `<p style="font:800 16px ${F};color:${C.navy};margin:8px 0 12px;">${text}</p>`;
}

/** The plan card: kicker, retailer, plan name, optional big figure, optional link. */
export function planCard(o: {
  kicker: string;
  retailer: string;
  planName?: string | null;
  figure?: { amount: number; before?: string; after: string } | null;
  link?: { label: string; url: string } | null;
  tone?: "teal" | "green" | "amber";
}): string {
  const tone = o.tone ?? "teal";
  const border = tone === "green" ? C.green : tone === "amber" ? C.amber : C.tealBright;
  const kick = tone === "green" ? C.green : tone === "amber" ? "#9a6400" : C.teal;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px;border:2px solid ${border};border-radius:14px;">
    <tr><td style="padding:16px 18px;font-family:${F};">
      <div style="font:700 11px ${F};letter-spacing:1.2px;color:${kick};text-transform:uppercase;">${o.kicker}</div>
      <div style="font:800 20px/1.3 ${F};color:${C.navy};margin-top:6px;">${esc(o.retailer)}</div>
      ${o.planName ? `<div style="font:14px ${F};color:${C.grey};margin-top:2px;">${esc(o.planName)}</div>` : ""}
      ${o.figure ? `<div style="margin-top:12px;font:15px/1.4 ${F};color:${C.ink};">${o.figure.before ?? "About"} <strong style="font-size:22px;color:${kick};">${money(o.figure.amount)}</strong> ${o.figure.after}</div>` : ""}
      ${o.link ? `<div style="margin-top:12px;"><a href="${o.link.url}" style="font:700 14px ${F};color:${C.teal};">${o.link.label} &rarr;</a></div>` : ""}
    </td></tr>
  </table>`;
}

/** A big status box with no plan: "You're on a good deal". */
export function statusBox(o: { kicker: string; headline: string; body: string; tone: "green" | "amber" | "teal" }): string {
  const bg = o.tone === "green" ? C.greenTint : o.tone === "amber" ? C.amberTint : C.tealTint;
  const fg = o.tone === "green" ? C.green : o.tone === "amber" ? "#9a6400" : C.teal;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px;background:${bg};border-radius:14px;">
    <tr><td style="padding:16px 18px;font-family:${F};">
      <div style="font:700 11px ${F};letter-spacing:1.2px;color:${fg};text-transform:uppercase;">${o.kicker}</div>
      <div style="font:800 20px/1.3 ${F};color:${C.navy};margin-top:6px;">${o.headline}</div>
      <div style="font:14px/1.5 ${F};color:${C.grey};margin-top:6px;">${o.body}</div>
    </td></tr>
  </table>`;
}

/** Amber date banner: "Your fixed price ends 12 November · in 28 days". */
export function dateBanner(big: string, small: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:${C.amberTint};border-left:4px solid ${C.amber};border-radius:10px;">
    <tr><td style="padding:14px 16px;font-family:${F};">
      <div style="font:800 18px/1.3 ${F};color:${C.navy};">${big}</div>
      <div style="font:14px ${F};color:#9a6400;margin-top:3px;">${small}</div>
    </td></tr>
  </table>`;
}

/** Numbered step with an amber circle. */
export function step(n: number, title: string, body: string): string {
  return `<tr>
    <td valign="top" style="width:30px;padding:0 12px 14px 0;">
      <div style="width:28px;height:28px;border-radius:14px;background:${C.amber};color:${C.amberInk};font:800 14px/28px ${F};text-align:center;">${n}</div>
    </td>
    <td valign="top" style="padding:0 0 14px;font:15px/1.45 ${F};color:${C.ink};">
      <strong>${title}</strong><br><span style="color:${C.grey};font-size:14px;">${body}</span>
    </td>
  </tr>`;
}
export const steps = (rows: string[]) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">${rows.join("")}</table>`;

/** Icon row: small tinted tile, bold lead-in, quiet text. Icons are HTML entities. */
export function iconRow(_icon: string, lead: string, text: string): string {
  // A small teal marker instead of an emoji: renders the same in every mail app.
  return `<tr>
    <td valign="top" style="width:18px;padding:9px 10px 10px 0;">
      <div style="width:8px;height:8px;border-radius:4px;background:${C.tealBright};"></div>
    </td>
    <td valign="top" style="padding:3px 0 10px;font:14px/1.45 ${F};color:${C.ink};">
      <strong>${lead}</strong> <span style="color:${C.grey};">${text}</span>
    </td>
  </tr>`;
}
export const iconRows = (rows: string[]) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 10px;">${rows.join("")}</table>`;

/** Three small facts side by side (stack fine on phones as they're short). */
export function chips(items: string[]): string {
  return `<div style="margin:0 0 18px;line-height:2.2;">${items
    .map((t) => `<span style="display:inline-block;margin:0 6px 0 0;padding:4px 10px;line-height:1.4;border-radius:999px;background:${C.greyTint};font:12.5px ${F};color:${C.grey};">${t}</span>`)
    .join("")}</div>`;
}

/** Quiet grey note box. */
export function note(html: string): string {
  return `<p style="margin:16px 0 0;padding:12px 14px;border-radius:10px;background:${C.greyTint};font-size:13px;line-height:1.5;color:${C.grey};">${html}</p>`;
}

/** Highlighted tip box (amber tint). */
export function tip(html: string): string {
  return `<p style="margin:0 0 18px;padding:12px 14px;border-radius:10px;background:${C.amberTint};font-size:14px;line-height:1.5;color:${C.ink};">${html}</p>`;
}

/** Unsubscribe line at the very end of the body. */
export function unsubscribe(url: string, why: string): string {
  return `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#888;">${why} <a href="${url}" style="color:#888;">Unsubscribe from these emails</a>.</p>`;
}

export const signOff = `<p style="margin:16px 0 0;">Questions? Just reply to this email.<br>The Utilo team</p>`;

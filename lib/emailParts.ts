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
/** Where email images are served from (the live site). */
const EMAIL_ASSETS = (process.env.SITE_URL || "https://www.utilo.com.au").replace(/\/+$/, "");

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

/** 8 Nov 2026: one plain sentence from the person's own bill (lib/billLesson). */
export function lessonLine(text: string): string {
  return `<p style="margin:0 0 18px;padding:10px 14px;border-left:3px solid ${C.teal};background:${C.tealTint};border-radius:0 10px 10px 0;font-size:14px;line-height:1.5;color:${C.ink};"><b style="color:${C.teal};">From your bill:</b> ${text}</p>`;
}

/**
 * 8 Nov 2026: "Why this bill is different": the change in one line, a bar per
 * reason (red pushed it up, green brought it down) and the notes underneath.
 */
export function billChangeBlock(i: { title: string; headline: string; sentence: string; steps: { label: string; dollars: number }[]; notes: string[] }): string {
  const max = Math.max(1, ...i.steps.map((x) => Math.abs(x.dollars)));
  const rows = i.steps.slice(0, 5).map((x) => {
    const up = x.dollars > 0;
    const w = Math.max(4, Math.round((Math.abs(x.dollars) / max) * 100));
    return `<tr>
      <td style="padding:5px 10px 5px 0;font-size:13.5px;color:${C.ink};width:44%;">${x.label}</td>
      <td width="40%" style="padding:5px 0;width:40%;"><table role="presentation" width="${w}%" cellspacing="0" cellpadding="0" style="width:${w}%;border-collapse:collapse;"><tr><td height="12" style="height:12px;line-height:12px;font-size:0;border-radius:6px;background:${up ? "#e8590c" : C.green};">&nbsp;</td></tr></table></td>
      <td style="padding:5px 0 5px 10px;font:700 13.5px ${F};color:${up ? "#c2410c" : C.green};white-space:nowrap;text-align:right;">${up ? "+" : "&minus;"}${money(Math.abs(x.dollars))}</td>
    </tr>`;
  }).join("");
  return `<div style="margin:0 0 20px;padding:16px 18px;border:1px solid #e3e7f0;border-radius:16px;">
    <p style="margin:0 0 4px;font:700 12px ${F};letter-spacing:.06em;text-transform:uppercase;color:${C.grey};">${i.title}</p>
    <p style="margin:0 0 6px;font:700 18px ${F};color:${C.navy};">${i.headline}</p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:${C.ink};">${i.sentence}</p>
    ${rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${rows}</table>` : ""}
    ${i.notes.length ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:${C.grey};">${i.notes.join("<br>")}</p>` : ""}
  </div>`;
}

/** Unsubscribe line at the very end of the body. */
export function unsubscribe(url: string, why: string): string {
  return `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#888;">${why} <a href="${url}" style="color:#888;">Unsubscribe from these emails</a>.</p>`;
}

export const signOff = `<p style="margin:16px 0 0;">Questions? Just reply to this email.<br>The Utilo team</p>`;

/** Two or three numbers side by side: a big figure and a short label under it.
 *  Table cells, so it holds together in Gmail and Outlook; short enough for phones. */
export function statRow(items: { big: string; small: string; tone?: "green" | "navy" | "amber" }[]): string {
  const w = Math.floor(100 / Math.max(1, items.length));
  const color = (t?: string) => (t === "green" ? C.green : t === "amber" ? "#9a6400" : C.navy);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;border-spacing:6px 0;">
    <tr>${items
      .map(
        (it) => `<td valign="top" width="${w}%" style="padding:12px 10px;background:${C.greyTint};border-radius:12px;font-family:${F};">
        <div style="font:800 20px/1.15 ${F};color:${color(it.tone)};">${it.big}</div>
        <div style="font:12px/1.35 ${F};color:${C.grey};margin-top:4px;">${it.small}</div>
      </td>`,
      )
      .join("")}</tr>
  </table>`;
}

/* ---------- Charts (31 Oct 2026) ----------
   Email apps strip SVG and scripts, and many block images, so every chart is
   coloured table cells: they render in Gmail, Outlook and phone mail apps with
   nothing to download. Heights and widths are whole pixels and percentages. */

const bar = (color: string, h: number, radius = "3px") =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td height="${h}" bgcolor="${color}" style="height:${h}px;background:${color};border-radius:${radius};font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr></table>`;

/** Horizontal bars: a label, a bar scaled to the biggest value, and the value. */
export function hBars(rows: { label: string; value: number; color: string; text: string; strong?: boolean }[]): string {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">${rows
    .map((r) => {
      const pct = Math.max(3, Math.round((r.value / max) * 100));
      return `<tr>
        <td style="width:34%;padding:5px 10px 5px 0;font:${r.strong ? "700" : "400"} 13px/1.3 ${F};color:${C.ink};">${r.label}</td>
        <td style="padding:5px 0;"><table role="presentation" width="${pct}%" cellspacing="0" cellpadding="0"><tr><td height="14" bgcolor="${r.color}" style="height:14px;background:${r.color};border-radius:7px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
        <td align="right" style="width:74px;padding:5px 0 5px 10px;font:700 13px ${F};color:${C.ink};white-space:nowrap;">${r.text}</td>
      </tr>`;
    })
    .join("")}</table>`;
}

/** Columns along the bottom: each is one or more stacked segments (bottom first), with an optional label under it. */
export function columns(cols: { parts: { value: number; color: string }[]; label?: string }[], o: { height: number; max?: number; gap?: number }): string {
  const max = o.max ?? Math.max(...cols.map((c) => c.parts.reduce((a, p) => a + p.value, 0)), 1);
  const gap = o.gap ?? 3;
  const anyLabel = cols.some((c) => c.label);
  const cells = cols
    .map((c) => {
      const segs = [...c.parts].reverse().filter((p) => p.value > 0);
      const inner = segs.length
        ? segs.map((p, i) => bar(p.color, Math.max(2, Math.round((p.value / max) * o.height)), i === 0 ? "3px 3px 0 0" : "0")).join("")
        : bar("#e3e7ef", 2, "1px");
      return `<td valign="bottom" style="height:${o.height}px;vertical-align:bottom;">${inner}</td>`;
    })
    .join("");
  const labels = anyLabel
    ? `<tr>${cols.map((c) => `<td align="center" style="padding-top:5px;font:700 11px ${F};color:${C.grey};">${c.label ?? ""}</td>`).join("")}</tr>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 6px;border-collapse:separate;border-spacing:${gap}px 0;table-layout:fixed;"><tr>${cells}</tr>${labels}</table>`;
}

/** A row of colour keys under a chart. */
export function legend(items: { color: string; label: string }[]): string {
  return `<p style="margin:2px 0 16px;font:12px/1.6 ${F};color:${C.grey};">${items
    .map((i) => `<span style="white-space:nowrap;margin-right:14px;"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${i.color};vertical-align:-1px;margin-right:5px;"></span>${i.label}</span>`)
    .join("")}</p>`;
}

/** A progress bar (0..1) with a label on each side. */
export function progress(frac: number, color: string, left: string, right: string): string {
  const pct = Math.max(2, Math.min(100, Math.round(frac * 100)));
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:-8px 0 20px;">
    <tr><td colspan="2" style="padding:0 0 6px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eceff5;border-radius:6px;"><tr><td>
      <table role="presentation" width="${pct}%" cellspacing="0" cellpadding="0"><tr><td height="10" bgcolor="${color}" style="height:10px;background:${color};border-radius:6px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    </td></tr></table></td></tr>
    <tr><td style="font:12px ${F};color:${C.grey};">${left}</td><td align="right" style="font:12px ${F};color:${C.grey};">${right}</td></tr>
  </table>`;
}

/** A short caption under a chart. */
export function caption(html: string): string {
  return `<p style="margin:0 0 20px;font:13px/1.5 ${F};color:${C.grey};">${html}</p>`;
}

/* ---------- At a glance (31 Oct 2026) ----------
   One line per topic: a bold title, one figure line, a "Details" link to the
   full chart on the dashboard, and a small chart on the right. */

/** Thin bars, one above the other, scaled to the biggest. */
export function miniBars(rows: { value: number; color: string }[]): string {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows
    .map((r) => `<tr><td style="padding:3px 0;"><table role="presentation" width="${Math.max(4, Math.round((r.value / max) * 100))}%" cellspacing="0" cellpadding="0"><tr><td height="8" bgcolor="${r.color}" style="height:8px;background:${r.color};border-radius:4px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`)
    .join("")}</table>`;
}

/** A row of the summary: text on the left, a small chart on the right. */
export function glanceRow(o: { dot: string; title: string; line: string; link?: { label: string; url: string } | null; chart?: string }): string {
  return `<tr><td style="padding:12px 0;border-top:1px solid #eceff5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td valign="top" style="width:14px;padding:5px 10px 0 0;"><div style="width:10px;height:10px;border-radius:5px;background:${o.dot};"></div></td>
      <td valign="top" style="font-family:${F};">
        <div style="font:700 14.5px/1.35 ${F};color:${C.ink};">${o.title}</div>
        <div style="font:13px/1.45 ${F};color:${C.grey};margin-top:2px;">${o.line}</div>
        ${o.link ? `<div style="margin-top:5px;"><a href="${o.link.url}" style="font:700 13px ${F};color:${C.teal};text-decoration:none;">${o.link.label} &rarr;</a></div>` : ""}
      </td>
      ${o.chart ? `<td valign="middle" style="width:128px;padding-left:14px;">${o.chart}</td>` : ""}
    </tr></table>
  </td></tr>`;
}
export const glance = (rows: string[]) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border-bottom:1px solid #eceff5;">${rows.join("")}</table>`;

/* ---------- More visuals (1 Nov 2026) ----------
   Still tables and colour only: no images, no SVG. Symbols are plain text
   characters that every mail app's fonts carry. */

/** A navy panel with a pill, a headline, a line and an optional button: the top of an email. */
export function heroPanel(o: { pill: string; headline: string; body: string; button?: { label: string; url: string } | null; small?: string | null }): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
    <tr><td style="padding:22px 22px 20px;border-radius:16px;${keepBg(C.navy)}">
      <div style="display:inline-block;padding:3px 10px;border-radius:999px;background:${C.amber};color:${C.amberInk};font:800 11px ${F};letter-spacing:0.6px;text-transform:uppercase;">${o.pill}</div>
      ${keepWhite(`<div style="margin:12px 0 6px;font:800 23px/1.22 ${F};color:#ffffff;">${o.headline}</div>
      <div style="font:15px/1.55 ${F};color:#ffffff;opacity:0.82;">${o.body}</div>`)}
      ${o.button ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0 0;"><tr><td style="border-radius:999px;background:${C.amber};"><a href="${o.button.url}" style="display:inline-block;padding:13px 24px;font:800 15px ${F};color:${C.amberInk};text-decoration:none;border-radius:999px;">${o.button.label} &rarr;</a></td></tr></table>` : ""}
      ${o.small ? keepWhite(`<div style="margin-top:10px;font:12.5px/1.5 ${F};color:#ffffff;opacity:0.65;">${o.small}</div>`) : ""}
    </td></tr>
  </table>`;
}

/** The money, as the hero (2 Nov 2026): who to move to, and how much a year, big, on navy. */
export function moneyHero(o: {
  pill: string;
  retailer: string;
  planName: string;
  amount: number;
  after: string;
  button?: { label: string; url: string } | null;
  small?: string | null;
  /** The label over the retailer: "Switch to" unless said otherwise (e.g. "Ask them for", same retailer). */
  toLabel?: string;
}): string {
  const amt = "$" + Math.round(o.amount).toLocaleString("en-AU");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
    <tr><td style="padding:22px 22px 22px;border-radius:16px;${keepBg(C.navy)}">
      <div style="display:inline-block;padding:3px 10px;border-radius:999px;background:${C.amber};color:${C.amberInk};font:800 11px ${F};letter-spacing:0.6px;text-transform:uppercase;">${o.pill}</div>
      <div style="margin:14px 0 0;font:800 50px/1 ${F};color:${C.amber};letter-spacing:-1px;">${amt}</div>
      ${keepWhite(`<div style="margin:4px 0 16px;font:700 16px/1.4 ${F};color:#ffffff;">${o.after}</div>`)}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;"><tr><td style="padding:12px 14px;border-radius:12px;${keepBg("#232d72")}">
        ${keepWhite(`<div style="font:700 11px ${F};letter-spacing:0.6px;text-transform:uppercase;color:#ffffff;opacity:0.7;">${o.toLabel ?? "Switch to"}</div>
        <div style="margin-top:3px;font:800 24px/1.2 ${F};color:#ffffff;">${o.retailer}</div>
        <div style="margin-top:2px;font:14px/1.45 ${F};color:#ffffff;opacity:0.78;">${o.planName}</div>`)}
      </td></tr></table>
      ${o.button ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0 0;"><tr><td style="border-radius:999px;background:${C.amber};"><a href="${o.button.url}" style="display:inline-block;padding:13px 24px;font:800 15px ${F};color:${C.amberInk};text-decoration:none;border-radius:999px;">${o.button.label} &rarr;</a></td></tr></table>` : ""}
      ${o.small ? keepWhite(`<div style="margin-top:12px;font:12.5px/1.5 ${F};color:#ffffff;opacity:0.65;">${o.small}</div>`) : ""}
    </td></tr>
  </table>`;
}

/** "Philip" from "PHILIP LUC" or "Mr P. Luc"; null when there's no usable first name. */
/** Every email opens with this (2 Nov 2026): "Hi Sam," or, without a usable name, "Hi there,". */
export function greet(name: string | null | undefined): string {
  const first = firstNameOf(name);
  return `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;">Hi ${first ? esc(first) : "there"},</p>`;
}

export function firstNameOf(full: string | null | undefined): string | null {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts.find((w) => !/^(mr|mrs|ms|miss|mx|dr)\.?$/i.test(w));
  if (!first || first.replace(/\./g, "").length < 2 || first.length > 30 || !/^[A-Za-z][A-Za-z'-]+$/.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

const TILE_TINTS = {
  teal: { bg: "#e6f6f5", fg: "#0d6f78" },
  amber: { bg: "#fff3d6", fg: "#9a6400" },
  green: { bg: "#ecfdf3", fg: "#15803d" },
  navy: { bg: "#e8ebf8", fg: "#131c57" },
} as const;

/** Feature tiles, two to a row: a coloured square with a symbol, a bold title, a quiet line. */
export function tiles(items: { sym: string; title: string; text: string; tint?: keyof typeof TILE_TINTS }[]): string {
  const rows: string[] = [];
  for (let r = 0; r < items.length; r += 2) {
    const pair = items.slice(r, r + 2);
    rows.push(`<tr>${pair
      .map((it) => {
        const t = TILE_TINTS[it.tint ?? "teal"];
        return `<td valign="top" width="50%" style="padding:12px;background:${C.greyTint};border-radius:14px;font-family:${F};">
          <div style="width:36px;height:36px;border-radius:10px;background:${t.bg};color:${t.fg};font:800 18px/36px ${F};text-align:center;">${it.sym}</div>
          <div style="margin-top:10px;font:800 14.5px/1.3 ${F};color:${C.navy};">${it.title}</div>
          <div style="margin-top:3px;font:13px/1.45 ${F};color:${C.grey};">${it.text}</div>
        </td>`;
      })
      .join("")}${pair.length === 1 ? `<td width="50%"></td>` : ""}</tr>`);
  }
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:separate;border-spacing:8px;table-layout:fixed;">${rows.join("")}</table>`;
}

/** Before and after, a year: two bars to scale and the gap as a pill. */
export function versus(o: { before: { label: string; value: number }; after: { label: string; value: number }; gapLabel?: string }): string {
  const max = Math.max(o.before.value, o.after.value, 1);
  const w = (v: number) => Math.max(8, Math.round((v / max) * 100));
  const row = (label: string, value: number, color: string, strong: boolean) => `<tr>
      <td style="padding:6px 0 2px;font:${strong ? "800" : "600"} 13px/1.3 ${F};color:${C.ink};">${label}</td>
      <td align="right" style="padding:6px 0 2px;font:800 15px ${F};color:${strong ? C.green : C.ink};white-space:nowrap;">${money(value)}<span style="font:600 11px ${F};color:${C.grey};"> /yr</span></td>
    </tr>
    <tr><td colspan="2" style="padding:0 0 6px;"><table role="presentation" width="${w(value)}%" cellspacing="0" cellpadding="0"><tr><td height="16" bgcolor="${color}" style="height:16px;background:${color};border-radius:8px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`;
  const gap = Math.max(0, o.before.value - o.after.value);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:separate;">
    <tr><td style="padding:16px 18px 12px;border-radius:14px;background:${C.greyTint};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${row(o.before.label, o.before.value, "#e8590c", false)}
        ${row(o.after.label, o.after.value, C.green, true)}
      </table>
      ${gap >= 1 ? `<div style="margin-top:6px;"><span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${C.greenTint};color:${C.green};font:800 13px ${F};">${o.gapLabel ?? "Difference"}: ${money(gap)} a year</span></div>` : ""}
    </td></tr>
  </table>`;
}

/** A big countdown: the number of days, and what happens then. */
export function countdown(days: number, what: string, when: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:separate;">
    <tr>
      <td width="112" valign="middle" align="center" style="padding:14px 8px;border-radius:14px 0 0 14px;background:${C.amber};font-family:${F};">
        <div style="font:900 40px/1 ${F};color:${C.amberInk};">${days}</div>
        <div style="margin-top:4px;font:800 11px ${F};letter-spacing:0.8px;text-transform:uppercase;color:${C.amberInk};">day${days === 1 ? "" : "s"} left</div>
      </td>
      <td valign="middle" style="padding:14px 18px;border-radius:0 14px 14px 0;background:${C.amberTint};font-family:${F};">
        <div style="font:800 17px/1.3 ${F};color:${C.navy};">${what}</div>
        <div style="margin-top:4px;font:14px/1.45 ${F};color:${C.grey};">${when}</div>
      </td>
    </tr>
  </table>`;
}

/** One big figure on a tinted block, with a line under it: for credits, refunds and the like. */
export function bigFigure(o: { figure: string; label: string; body: string; tone?: "green" | "amber" | "teal" }): string {
  const t = o.tone === "amber" ? { bg: C.amberTint, fg: "#9a6400" } : o.tone === "teal" ? { bg: C.tealTint, fg: C.teal } : { bg: C.greenTint, fg: C.green };
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:separate;">
    <tr><td align="center" style="padding:22px 18px;border-radius:16px;background:${t.bg};font-family:${F};">
      <div style="font:700 11px ${F};letter-spacing:1.2px;text-transform:uppercase;color:${t.fg};">${o.label}</div>
      <div style="margin:8px 0 6px;font:900 44px/1 ${F};color:${t.fg};">${o.figure}</div>
      <div style="font:14px/1.5 ${F};color:${C.grey};">${o.body}</div>
    </td></tr>
  </table>`;
}

/** A background colour that Gmail's dark mode leaves alone (it doesn't recolour background images). */
export const keepBg = (c: string) => `background-color:${c};background-image:linear-gradient(${c},${c});`;
/** White text that stays white in Gmail's dark mode, on a keepBg() panel. Harmless everywhere else. */
export const keepWhite = (html: string) => `<div class="gm-s"><div class="gm-d">${html}</div></div>`;

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** "Your year with Utilo Plus" (2 Nov 2026): the next 12 months as a strip, every
 *  month checked daily, July marked for the 1 July price changes. */
export function yearStrip(startMonth: number): string {
  const cells = Array.from({ length: 12 }, (_, k) => (startMonth + k) % 12);
  const cell = (m: number, k: number) => {
    const july = m === 6;
    const bg = july ? C.amber : k === 0 ? C.navy : C.tealTint;
    const fg = july ? C.amberInk : k === 0 ? "#ffffff" : C.teal;
    return `<td width="8.33%" align="center" style="padding:0 2px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" height="46" bgcolor="${bg}" style="height:46px;${k === 0 ? keepBg(C.navy) : `background:${bg};`}border-radius:8px;font:800 13px ${F};color:${fg};">${k === 0 ? keepWhite(`Now<br><span style="font:700 11px ${F};">&#10003;</span>`) : `${MONTH_INITIALS[m]}<br><span style="font:700 11px ${F};">&#10003;</span>`}</td></tr></table>
    </td>`;
  };
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 10px;table-layout:fixed;"><tr>${cells.map(cell).join("")}</tr></table>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
    <tr><td valign="top" style="width:16px;padding:4px 8px 6px 0;"><div style="width:10px;height:10px;border-radius:3px;background:${C.tealBright};"></div></td><td style="padding:0 0 6px;font:13.5px/1.45 ${F};color:${C.ink};"><strong>Every morning</strong>: every plan on your network re-priced against your own bill.</td></tr>
    <tr><td valign="top" style="width:16px;padding:4px 8px 6px 0;"><div style="width:10px;height:10px;border-radius:3px;background:${C.amber};"></div></td><td style="padding:0 0 6px;font:13.5px/1.45 ${F};color:${C.ink};"><strong>1 July</strong>: retailers reset their prices. We re-run everything for you.</td></tr>
    <tr><td valign="top" style="width:16px;padding:4px 8px 6px 0;"><div style="width:10px;height:10px;border-radius:3px;background:${C.green};"></div></td><td style="padding:0 0 6px;font:13.5px/1.45 ${F};color:${C.ink};"><strong>Cheaper by ${money(50)}+ a year, or your discount about to end?</strong> One email, a month ahead where we can.</td></tr>
  </table>`;
}

/** A phone-style alert, to show what a Utilo alert looks like. Always labelled as an example. */
export function alertPreview(o: { title: string; body: string; label?: string }): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
    <tr><td style="padding:18px;border-radius:18px;background:${C.greyTint};">
      <div style="font:800 11px ${F};letter-spacing:0.6px;text-transform:uppercase;color:${C.grey};margin:0 0 10px;">${o.label ?? "What an alert looks like (example)"}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;background:#ffffff;border:1px solid #e3e7f0;border-radius:16px;box-shadow:0 6px 18px rgba(19,28,87,0.08);">
        <tr>
          <td valign="top" style="width:44px;padding:14px 0 14px 14px;">
            <img src="${EMAIL_ASSETS}/email/app-icon.png" width="36" height="36" alt="Utilo" style="display:block;width:36px;height:36px;border:0;border-radius:9px;background:#1E2A4A;font:900 14px ${F};color:#ffffff;">
          </td>
          <td style="padding:14px 14px 14px 10px;font-family:${F};">
            <div style="font:700 11.5px ${F};color:${C.grey};">UTILO &middot; now</div>
            <div style="font:800 15px/1.3 ${F};color:${C.ink};margin-top:2px;">${o.title}</div>
            <div style="font:14px/1.45 ${F};color:${C.ink};margin-top:2px;">${o.body}</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>`;
}

/** Cancellation (2 Nov 2026): today, then the day it ends, on one line. */
export function endTimeline(o: { leftTitle: string; leftSmall: string; rightTitle: string; rightSmall: string }): string {
  const dot = (bg: string) => `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="16" height="16" bgcolor="${bg}" style="width:16px;height:16px;border-radius:8px;background:${bg};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
    <tr><td style="padding:18px 18px 16px;border-radius:14px;background:${C.greyTint};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="width:16px;">${dot(C.green)}</td>
          <td style="padding:0 6px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td height="4" bgcolor="${C.tealBright}" style="height:4px;background:${C.tealBright};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
          <td style="width:16px;">${dot(C.navy)}</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;">
        <tr>
          <td valign="top" style="font-family:${F};"><div style="font:800 14px ${F};color:${C.ink};">${o.leftTitle}</div><div style="font:12.5px/1.4 ${F};color:${C.grey};">${o.leftSmall}</div></td>
          <td valign="top" align="right" style="font-family:${F};"><div style="font:800 14px ${F};color:${C.ink};">${o.rightTitle}</div><div style="font:12.5px/1.4 ${F};color:${C.grey};">${o.rightSmall}</div></td>
        </tr>
      </table>
    </td></tr>
  </table>`;
}

/** Five gold stars, decoration only (not links: every review goes to the same Google page). */
export function stars(): string {
  return `<div style="margin:0 0 6px;font:24px/1 ${F};letter-spacing:4px;color:${C.amber};">&#9733;&#9733;&#9733;&#9733;&#9733;</div>`;
}

/** "Bonus: you don't need to change retailer" (2 Nov 2026). The cheapest plan is
 *  with the company they already pay, so it's a plan change, not a switch.
 *  Takes plain text (escaped here). */
export function sameRetailerBonus(o: { retailer: string; planName: string; amount?: number | null }): string {
  const save = o.amount && o.amount >= 1 ? ` and save about <strong>${money(o.amount)} a year</strong>` : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
    <tr><td style="padding:18px 18px 16px;border-radius:14px;background:${C.greenTint};border:1.5px solid #86efac;">
      <div style="display:inline-block;padding:3px 10px;border-radius:999px;background:${C.green};color:#ffffff;font:800 11px ${F};letter-spacing:0.6px;text-transform:uppercase;">Bonus</div>
      <div style="margin:10px 0 6px;font:800 19px/1.3 ${F};color:${C.ink};">You don&rsquo;t need to change retailer</div>
      <div style="font:15px/1.55 ${F};color:${C.ink};">Just ask ${esc(o.retailer)} to move you to <strong>${esc(o.planName)}</strong>${save}. It&rsquo;s the best offer we found for you, and it&rsquo;s with the company you&rsquo;re already with: same account, no switching. Usually a quick call or a few taps in their app.</div>
    </td></tr>
  </table>`;
}

/** Four big promises in a 2x2 grid, each with a coloured number or word on top (3 Nov 2026, the invite). */
export function pillars(items: { big: string; title: string; text: string; tint: keyof typeof TILE_TINTS }[]): string {
  const rows: string[] = [];
  for (let r = 0; r < items.length; r += 2) {
    rows.push(`<tr>${items.slice(r, r + 2).map((it) => {
      const t = TILE_TINTS[it.tint];
      return `<td valign="top" width="50%" style="padding:14px 14px 13px;background:${t.bg};border-radius:14px;font-family:${F};">
        <div style="font:900 24px/1.05 ${F};color:${t.fg};letter-spacing:-0.5px;">${it.big}</div>
        <div style="margin-top:7px;font:800 14.5px/1.3 ${F};color:${C.navy};">${it.title}</div>
        <div style="margin-top:3px;font:13px/1.45 ${F};color:${C.grey};">${it.text}</div>
      </td>`;
    }).join("")}</tr>`);
  }
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:separate;border-spacing:8px;table-layout:fixed;">${rows.join("")}</table>`;
}

/** "On your own" vs "With Utilo Plus", row by row (3 Nov 2026, the invite). */
export function youVsUs(rows: { what: string; you: string; us: string }[]): string {
  const head = `<tr>
      <td style="padding:10px 10px 8px 14px;font:800 11px ${F};letter-spacing:0.6px;text-transform:uppercase;color:${C.grey};"></td>
      <td width="36%" style="padding:10px 8px 8px;font:800 11px ${F};letter-spacing:0.6px;text-transform:uppercase;color:#b4441b;">On your own</td>
      <td width="36%" style="padding:10px 14px 8px 8px;font:800 11px ${F};letter-spacing:0.6px;text-transform:uppercase;color:${C.green};">With Utilo Plus</td>
    </tr>`;
  const body = rows.map((r, n) => `<tr>
      <td valign="top" style="padding:10px 10px 10px 14px;border-top:1px solid #e3e7f0;font:800 13.5px/1.35 ${F};color:${C.navy};">${r.what}</td>
      <td valign="top" style="padding:10px 8px;border-top:1px solid #e3e7f0;font:13.5px/1.4 ${F};color:${C.grey};"><span style="color:#b4441b;font-weight:800;">&#10007;</span> ${r.you}</td>
      <td valign="top" style="padding:10px 14px 10px 8px;border-top:1px solid #e3e7f0;font:700 13.5px/1.4 ${F};color:${C.ink};${n % 2 === 0 ? `background:${C.greenTint};` : ""}"><span style="color:${C.green};font-weight:900;">&#10003;</span> ${r.us}</td>
    </tr>`).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;border:1px solid #e3e7f0;border-radius:14px;overflow:hidden;">${head}${body}</table>`;
}

/** A dashboard "screen" in an email (3 Nov 2026): a window bar naming the tab, then the content. */
export function screen(tab: string, inner: string, caption?: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 ${caption ? "6" : "20"}px;border-collapse:separate;border:1px solid #dfe4ef;border-radius:16px;overflow:hidden;box-shadow:0 8px 22px rgba(19,28,87,0.07);">
    <tr><td style="padding:9px 14px;background:#eef1f8;border-bottom:1px solid #dfe4ef;font:800 11px ${F};letter-spacing:0.5px;text-transform:uppercase;color:${C.grey};">
      <span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:#f87171;"></span>
      <span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${C.amber};margin-left:3px;"></span>
      <span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:#4ade80;margin:0 10px 0 3px;"></span>
      Utilo Plus &middot; ${tab}
    </td></tr>
    <tr><td style="padding:16px;background:#ffffff;">${inner}</td></tr>
  </table>${caption ? `<p style="margin:0 0 22px;font:12.5px/1.45 ${F};color:${C.grey};">${caption}</p>` : ""}`;
}

/** Three small tiles in a row: label, big figure (the dashboard's verdict, in miniature). */
export function miniVerdict(o: { headline: string; tiles: { label: string; name: string; value: string; tone: "plain" | "best" | "save" }[] }): string {
  const cell = (t: (typeof o.tiles)[number]) => {
    const bg = t.tone === "save" ? "#fde047" : t.tone === "best" ? "#232d72" : "#1c2565";
    const fg = t.tone === "save" ? "#1c1917" : "#ffffff";
    const inner = `<div style="font:700 11px ${F};color:${fg};opacity:0.8;">${t.label}</div>
      <div style="font:800 13px/1.3 ${F};color:${fg};margin-top:2px;">${t.name}</div>
      <div style="font:900 20px ${F};color:${fg};margin-top:6px;">${t.value}</div>`;
    return `<td valign="top" width="33%" style="padding:10px 10px 11px;border-radius:12px;${t.tone === "save" ? `background:${bg};` : keepBg(bg)}${t.tone === "best" ? "border:1.5px solid #ffd166;" : ""}">${t.tone === "save" ? inner : keepWhite(inner)}</td>`;
  };
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;"><tr><td style="padding:16px;border-radius:14px;${keepBg("#155e75")}">
    ${keepWhite(`<div style="font:900 21px/1.2 ${F};color:#ffffff;margin:0 0 12px;">${o.headline}</div>`)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:6px 0;table-layout:fixed;"><tr>${o.tiles.map(cell).join("")}</tr></table>
  </td></tr></table>`;
}

/** The Utilo Plus animation (3 Nov 2026): a looping GIF, linked. Its first frame
 *  says it all, because Outlook on Windows shows only that frame.
 *  Evergreen on purpose (no price), so it never goes out of date. */
export function plusAnimation(origin: string, url: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;"><tr><td>
    <a href="${url}" style="display:block;text-decoration:none;"><img src="${origin}/email/plus-watch.gif" width="504" alt="Your free check was one day. Prices change all year: Utilo Plus re-checks every plan against your bill every morning, and emails you only when switching pays." style="display:block;width:100%;max-width:504px;height:auto;border:0;border-radius:16px;font:700 15px Arial,Helvetica,sans-serif;color:${C.navy};"></a>
  </td></tr></table>`;
}

/* ---------- Your bill vs the cheapest, animated (6 Nov 2026) ----------
   Two bars that grow when the email opens: what they pay, then the cheapest
   plan, with the gap (the saving) sweeping in. The bars are pre-made GIFs
   (public/email/bars, from scripts/make-email-bars.py), one for every 2%, so
   nothing is generated per email and no numbers go in an image address. The
   figures are text beside the bars, so they read with images off. Outlook on
   Windows (which shows only a GIF's first frame) gets the same bars as table cells. */
export function billVsBest(o: { origin: string; nowLabel: string; now: number; best: number; money: (n: number) => string }): string {
  if (!(o.now > 0) || !(o.best > 0)) return "";
  const share = Math.min(1, o.best / o.now);
  const pct = Math.max(30, Math.min(100, Math.round(share * 50) * 2));
  const save = Math.max(0, o.now - o.best);
  const GAP = "#f4b183";
  const img = (file: string) =>
    `<!--[if !mso]><!--><img src="${o.origin}/email/bars/${file}" width="520" height="28" alt="" style="display:block;width:100%;max-width:520px;height:auto;border:0;"><!--<![endif]-->`;
  const cell = (color: string, w: number, radius: string) =>
    `<td width="${w}%" height="18" bgcolor="${color}" style="height:18px;background:${color};border-radius:${radius};font-size:0;line-height:0;">&nbsp;</td>`;
  const mso = (cells: string) => `<!--[if mso]><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${cells}</tr></table><![endif]-->`;
  // Label and figure on one line, the bar full width under them, so it's big enough to see on a phone.
  const row = (label: string, bar: string, value: string, color: string) => `<tr>
      <td style="padding:6px 0 5px;font:700 14px/1.3 ${F};color:${C.ink};">${label}</td>
      <td align="right" style="padding:6px 0 5px 10px;font:800 17px ${F};color:${color};white-space:nowrap;">${value}</td>
    </tr>
    <tr><td colspan="2" style="padding:0 0 8px;">${bar}</td></tr>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
    <tr><td style="padding:14px 16px 12px;background:${C.greyTint};border-radius:14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${row(`${o.nowLabel}, a year`, `${img("bill.gif")}${mso(cell("#e8590c", 100, "7px"))}`, o.money(o.now), "#c2410c")}
        ${row("Cheapest plan, a year", `${img(`best-${pct}.gif`)}${mso(`${cell(C.green, pct, "7px 0 0 7px")}${pct < 100 ? cell(GAP, 100 - pct, "0 7px 7px 0") : ""}`)}`, o.money(o.best), C.green)}
      </table>
      ${save > 0 ? `<div style="margin-top:6px;font:13px/1.4 ${F};color:${C.grey};"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${GAP};vertical-align:middle;margin-right:6px;"></span>The gap: <strong style="font:800 15px ${F};color:#9a6400;">${o.money(save)} a year</strong> you'd save</div>` : ""}
    </td></tr>
  </table>`;
}

/* ---------- "Sound familiar?" (6 Nov 2026) ----------
   Three things people say about energy bills, each with what Plus does about it.
   A big figure on the left, the complaint, then the answer in green. */
export function pains(items: { n: string; label: string; fix: string }[]): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border:1px solid #e3e7f0;border-radius:16px;border-collapse:separate;">
    ${items.map((it, k) => `<tr><td style="padding:14px 18px;${k ? "border-top:1px solid #e3e7f0;" : ""}">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        <td style="width:86px;vertical-align:top;font:900 24px/1.1 ${F};color:#c2410c;white-space:nowrap;padding-right:12px;">${it.n}</td>
        <td style="vertical-align:top;">
          <div style="font:700 14.5px/1.4 ${F};color:${C.ink};">${it.label}</div>
          <div style="margin-top:5px;font:14px/1.5 ${F};color:${C.green};"><strong>Plus:</strong> ${it.fix}</div>
        </td>
      </tr></table>
    </td></tr>`).join("")}
  </table>`;
}

/* What Plus does every morning, as a 9-second animation: the daily check, the bill
   in plain English, then the one email when a plan beats theirs. 150 KB; the first
   frame stands on its own where animation doesn't play. */
export function plusMorning(origin: string, url: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;"><tr><td>
    <a href="${url}" style="display:block;text-decoration:none;"><img src="${origin}/email/plus-morning.gif" width="504" height="320" alt="Utilo Plus: every plan re-checked against your bill every morning, your bill explained in plain English, and one email the day a plan beats yours." style="display:block;width:100%;max-width:504px;height:auto;border:0;border-radius:16px;font:700 15px ${F};color:${C.navy};"></a>
  </td></tr></table>`;
}

/* ---------- The join card (6 Nov 2026) ----------
   One navy card: the price big with the regular price struck through, how many
   times their saving covers it, three ticks, and the button. Bulletproof-ish
   button (a table cell with a background) so it stays a button in Outlook. */
export function joinCard(o: {
  url: string; special?: string | null; regular?: string | null; annual: string; perWeek: string; monthly?: string;
  times?: string | null; saving?: number | null; ticks: string[]; button?: string;
}): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
    <tr><td style="padding:24px 22px 22px;border-radius:18px;${keepBg(C.navy)}">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        <td><span style="display:inline-block;padding:4px 11px;border-radius:999px;background:${C.amber};color:${C.amberInk};font:800 11px ${F};letter-spacing:0.6px;text-transform:uppercase;">Utilo Plus</span></td>
        ${o.special ? `<td align="right"><span style="display:inline-block;padding:4px 11px;border-radius:999px;background:#e11d48;color:#ffffff;font:800 11px ${F};letter-spacing:0.5px;text-transform:uppercase;">${o.special}</span></td>` : ""}
      </tr></table>
      ${keepWhite(`
      <div style="margin:16px 0 2px;font:900 40px/1 ${F};color:#ffffff;letter-spacing:-1px;">${o.regular ? `<span style="font:700 22px ${F};color:#9aa3c7;text-decoration:line-through;vertical-align:middle;margin-right:8px;">${o.regular}</span>` : ""}${o.annual}<span style="font:700 16px ${F};color:#c7cde0;letter-spacing:0;"> a year</span></div>
      <div style="font:14px/1.5 ${F};color:#c7cde0;">That's ${o.perWeek} a week. No lock-in: cancel any time.</div>
      ${o.times && o.saving ? `<div style="margin:14px 0 0;padding:10px 14px;border-radius:12px;background:#1f2a66;font:700 14px/1.4 ${F};color:#ffffff;"><span style="color:#8ef0b0;">&#10003;</span> Your ${money(o.saving)} a year saving covers it <span style="color:#f5c15c;">${o.times} times over</span>.</div>` : ""}
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:14px 0 0;">
        ${o.ticks.map((t) => `<tr><td style="padding:3px 0;font:14px/1.5 ${F};color:#e9ecf7;"><span style="color:#8ef0b0;font-weight:900;">&#10003;</span>&nbsp; ${t}</td></tr>`).join("")}
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 0;"><tr>
        <td align="center" bgcolor="${C.amber}" style="border-radius:999px;background:${C.amber};">
          <a href="${o.url}" style="display:block;padding:15px 22px;font:900 17px ${F};color:${C.amberInk};text-decoration:none;border-radius:999px;">${o.button ?? "Start Utilo Plus"} &rarr;</a>
        </td>
      </tr></table>
      <div style="margin:10px 0 0;text-align:center;font:12.5px ${F};color:#9aa3c7;">Takes a minute. Your dashboard is set up from this check.</div>`)}
    </td></tr>
  </table>`;
}

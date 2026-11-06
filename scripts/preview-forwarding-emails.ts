// 5 Nov 2026: previews of the replies a member gets after forwarding a bill (app/api/inbound-bill).
// Same wording as the route, with sample figures. Run: npx tsx --conditions=react-server scripts/preview-forwarding-emails.ts [outDir]
import fs from "node:fs";
import path from "node:path";
import { renderEmail, esc } from "../lib/email";
import { findMoney } from "../lib/moneyFinder";

const out = process.argv[2] || "email-previews";
fs.mkdirSync(out, { recursive: true });
const dash = "https://utilo.com.au/account#savings";
const fm = findMoney({
  retailer: "Tango Energy", worthPerYear: 50, flagged: new Set(["discount"]), readingType: "estimated",
  concessionApplied: false, hasCard: true, fees: [{ kind: "late_payment", amount: 12 }], billTotal: 412.37, days: 91, fuel: "electricity",
} as Parameters<typeof findMoney>[0]);
const worthOf = fm.perYear > 0 ? ` worth about $${Math.round(fm.perYear)} a year` : fm.oneOff > 0 ? ` worth $${Math.round(fm.oneOff)} back` : "";
const alsoFound = `<p style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;"><b>We also found ${fm.findings.length} things on this bill${worthOf}:</b><br>${fm.findings.map((f) => `• ${esc(f.ask)}`).join("<br>")}<br>Your dashboard has exactly what to say.</p>`;
const list = [
  { id: "20-forward-bill-in", subject: "Your Tango Energy bill is in", title: "You could save about $426 a year",
    html: `<p>We read the bill you forwarded and re-checked every plan. <b>OVO Energy</b>'s The One Plan comes out about <b>$426 a year</b> less on your usage.</p>${alsoFound}`, cta: { label: "See the plan", url: dash } },
  { id: "21-forward-gmail", subject: "One step left: confirm Gmail forwarding", title: "Confirm Gmail forwarding",
    html: `<p>Gmail wants to check it's you before it forwards bills to Utilo.</p><p>Your confirmation code: <b style="font-size:20px;letter-spacing:2px;">592837461</b></p><p>Enter it in Gmail: Settings → Forwarding and POP/IMAP.</p><p>Or confirm in one tap with the button below. It opens Gmail's own page.</p><p>Then add the filter from your dashboard so only bills are forwarded.</p>`,
    cta: { label: "Confirm forwarding in Gmail", url: "https://mail-settings.google.com/" } },
  { id: "22-forward-no-bill", subject: "That email had no bill attached", title: "No bill in that email",
    html: `<p>We got an email from hello@agl.com.au (“Your bill is ready to view”), but there was no bill attached.</p><p>Some retailers only send a link. In your retailer's app or account, look for <b>“Email me my bill as a PDF”</b> and turn it on. Until then, you can upload the bill on your dashboard.</p>`,
    cta: { label: "Upload my bill", url: dash } },
  { id: "23-forward-check", subject: "Your forwarded bill needs a quick look", title: "A quick check, please",
    html: `<p>We read the Tango Energy bill you forwarded, but it's for a different meter (NMI) from the one on your account. It takes a few seconds to check the numbers on your dashboard, then we'll re-check every plan.</p>`,
    cta: { label: "Check my bill", url: dash } },
];
for (const e of list) fs.writeFileSync(path.join(out, `${e.id}.html`), renderEmail({ title: e.title, bodyHtml: e.html, cta: e.cta }));
console.log(list.map((e) => e.id).join(" "), "| found:", fm.findings.map((f) => f.id).join(","));

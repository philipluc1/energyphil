import "server-only";

// Thin wrapper around Resend's HTTP API — a plain fetch with a bearer token,
// no SDK dependency needed. Sign up free at https://resend.com, create an API
// key (Settings > API Keys), and set RESEND_API_KEY in Vercel.
//
// To send to addresses other than your own Resend account email, Resend
// requires a verified sending domain (Domains > Add Domain — a few DNS
// records at wherever you bought the domain). Until you've verified one,
// RESEND_FROM_ADDRESS can stay as the default "onboarding@resend.dev" and
// test sends will only actually land in the inbox of the email you signed up
// to Resend with — that's a Resend sandbox restriction, not a bug here.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "Utilo <onboarding@resend.dev>";

export const emailConfigured = Boolean(RESEND_API_KEY);

/** Escape text before putting it into email HTML (names, plan names, anything
 *  that came from a form, a bill or a database row). */
export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Branded shell every email is sent in: navy header with the wordmark, a
 *  white card for the body, an optional amber button, and a quiet footer.
 *  Table-based with inline styles so it survives Gmail and Outlook. */
export function renderEmail(opts: { title: string; bodyHtml: string; cta?: { label: string; url: string }; preheader?: string }): string {
  const site = process.env.SITE_URL || "https://utilo.com.au";
  const button = opts.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 6px;"><tr><td style="border-radius:999px;background:#f5a623;">
         <a href="${opts.cta.url}" style="display:inline-block;padding:13px 26px;font:700 15px Arial,Helvetica,sans-serif;color:#171305;text-decoration:none;border-radius:999px;">${opts.cta.label} &rarr;</a>
       </td></tr></table>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${opts.title}</title>
<style>p{margin:0 0 14px;line-height:1.55} a{color:#0d6f78} ol,ul{margin:0 0 14px;padding-left:20px;line-height:1.6}</style></head>
<body style="margin:0;padding:0;background:#eef0f8;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;color:#eef0f8;">${opts.preheader}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef0f8;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
  <tr><td style="background:#131c57;background-image:linear-gradient(135deg,#131c57,#0d6f78);border-radius:18px 18px 0 0;padding:22px 28px;">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="width:38px;height:38px;border-radius:11px;background:#f5a623;text-align:center;vertical-align:middle;font:900 22px Arial;color:#131c57;">&#9889;</td>
      <td style="padding-left:12px;font:900 26px Arial,Helvetica,sans-serif;color:#fff;letter-spacing:-0.5px;">Util<span style="color:#f5a623;">o</span>
        <div style="font:700 10px Arial;letter-spacing:2px;color:#f5a623;margin-top:2px;">PAY LESS. POWER ON.</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#ffffff;padding:28px 28px 22px;font-size:15px;">
    <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;letter-spacing:-0.3px;">${opts.title}</h1>
    ${opts.bodyHtml}
    ${button}
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:0 0 18px 18px;border-top:1px solid #e6e9f2;padding:16px 28px;font-size:12px;color:#777;line-height:1.5;">
    Utilo is an independent comparison service for Victorian households, not affiliated with the Victorian Government or any retailer. Estimates only; confirm prices with the retailer before switching.
    <br><a href="${site}" style="color:#777;">${site.replace(/^https?:\/\//, "")}</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmail(opts: { to: string; subject: string; html: string; title?: string; cta?: { label: string; url: string } }): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  // Wrap plain body HTML in the branded shell unless the caller built a full document.
  const html = opts.html.trimStart().startsWith("<!doctype") ? opts.html : renderEmail({ title: opts.title ?? opts.subject, bodyHtml: opts.html, cta: opts.cta });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: opts.to,
        subject: opts.subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Resend send failed", res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend send threw", err);
    return false;
  }
}

/** A short status note to the site owner after a scheduled job runs. Set
 *  ADMIN_EMAIL in Vercel to receive these; silently skipped otherwise. */
export async function sendHealthEmail(job: string, stats: Record<string, number | string>): Promise<void> {
  const to = process.env.ADMIN_EMAIL;
  if (!to || !RESEND_API_KEY) return;
  const errors = Number(stats.errors ?? 0);
  const rows = Object.entries(stats)
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;">${k}</td><td style="padding:6px 0;font-weight:700;">${v}</td></tr>`)
    .join("");
  await sendEmail({
    to,
    subject: `${errors > 0 ? "⚠️ " : "✅ "}Utilo ${job}: ${errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : "all good"}`,
    title: `${job} ran ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium", timeStyle: "short" })}`,
    html: `<table role="presentation" cellspacing="0" cellpadding="0" style="font-size:15px;">${rows}</table>
      ${errors > 0 ? `<p style="margin-top:14px;color:#b45309;">Check the Vercel logs for this job to see what failed.</p>` : ""}`,
  }).catch(() => undefined);
}

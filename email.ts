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
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "VIC Energy Check <onboarding@resend.dev>";

export const emailConfigured = Boolean(RESEND_API_KEY);

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

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
        html: opts.html,
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

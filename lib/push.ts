import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "./supabaseAdmin";
import { SITE_URL } from "./site";

// Phone notifications for the home-screen app (31 Oct 2026). Uses the Web
// Push standard: Apple, Google and Mozilla run the push services, so there's
// nothing to pay for. Needs two keys in Vercel (see docs in the zip):
//   VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY  (npx web-push generate-vapid-keys)
// Without them everything else works and the app just doesn't offer alerts.

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
// Who to contact about these messages: a mailto: or the site.
const SUBJECT = process.env.VAPID_SUBJECT || SITE_URL;

export const pushConfigured = Boolean(PUBLIC_KEY && PRIVATE_KEY && supabaseAdmin);
export const pushPublicKey = PUBLIC_KEY;

let ready = false;
function setup(): boolean {
  if (!pushConfigured) return false;
  if (!ready) {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    ready = true;
  }
  return true;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping it goes, e.g. "/account?open=year#home". */
  url?: string;
  /** Same tag replaces an older notification instead of stacking. */
  tag?: string;
}

/** Keep notification text short: phones cut it off anyway. */
export const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Send to every phone the member turned notifications on for. Phones that have
 * gone away (uninstalled, notifications off) are removed. Never throws: a
 * notification failing must not stop the email or the rest of the job.
 * Returns how many phones it reached.
 */
export async function sendPush(email: string, msg: PushMessage): Promise<number> {
  if (!setup() || !supabaseAdmin) return 0;
  try {
    const { data } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth").ilike("email", email);
    const subs = (data ?? []) as { id: number; endpoint: string; p256dh: string; auth: string }[];
    let reached = 0;
    const payload = JSON.stringify({ title: clip(msg.title, 60), body: clip(msg.body), url: msg.url ?? "/account", tag: msg.tag });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "normal" });
        reached++;
        await supabaseAdmin.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", s.id);
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push: send failed", code ?? err);
      }
    }
    return reached;
  } catch (err) {
    console.error("push: lookup failed", err);
    return 0;
  }
}

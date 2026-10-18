import "server-only";
import { randomInt } from "node:crypto";
import { stripe } from "./stripeClient";
import { supabaseAdmin } from "./supabaseAdmin";
import { sendEmail } from "./email";
import { REFERRAL_ALPHABET, cleanReferralCode } from "./attribution";
import { REFERRAL_COUPON_ID, REFERRAL_CREDIT_CENTS, REFERRAL_FRIEND_CENTS } from "./referralOffer";
import { referralCreditEmail } from "./emailTemplates";

// Member referrals. Each membership row gets a 6-character code; the member's
// link is /r/<CODE>. A friend who arrives through it gets money off their first
// payment (a Stripe coupon), and once the friend has paid, the member gets the
// same amount as a credit on their Stripe customer balance, which Stripe takes
// off their next invoice automatically.

export function newReferralCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += REFERRAL_ALPHABET[randomInt(REFERRAL_ALPHABET.length)];
  return s;
}

/** The active member who owns a referral code, or null. */
export async function referrerFor(code: string | null | undefined): Promise<{ id: string; email: string; stripe_customer_id: string | null } | null> {
  const c = cleanReferralCode(code);
  if (!c || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .select("id, email, stripe_customer_id")
    .eq("referral_code", c)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error) {
    if (!/column|schema cache/i.test(error.message)) console.error("referrerFor", error.message);
    return null;
  }
  return data ?? null;
}

/** The friend's discount coupon, created on first use. Null if Stripe isn't set up. */
export async function ensureFriendCoupon(): Promise<string | null> {
  if (!stripe) return null;
  try {
    await stripe.coupons.retrieve(REFERRAL_COUPON_ID);
    return REFERRAL_COUPON_ID;
  } catch {
    try {
      await stripe.coupons.create({
        id: REFERRAL_COUPON_ID,
        amount_off: REFERRAL_FRIEND_CENTS,
        currency: "aud",
        duration: "once",
        name: "A friend's referral",
      });
      return REFERRAL_COUPON_ID;
    } catch (e) {
      console.error("referral coupon not available", e);
      return null;
    }
  }
}

/** Credits the member who referred a new, paid membership. Safe to call twice:
 *  Stripe's idempotency key stops a second credit for the same checkout. */
export async function creditReferrer(o: { code: string; checkoutSessionId: string; friendEmail: string; origin: string }): Promise<boolean> {
  if (!stripe || !supabaseAdmin) return false;
  const ref = await referrerFor(o.code);
  if (!ref || !ref.stripe_customer_id || ref.email.toLowerCase() === o.friendEmail.toLowerCase()) return false;
  try {
    await stripe.customers.createBalanceTransaction(
      ref.stripe_customer_id,
      { amount: -REFERRAL_CREDIT_CENTS, currency: "aud", description: "Referral credit: a friend joined Utilo" },
      { idempotencyKey: `utilo-referral-credit-${o.checkoutSessionId}` },
    );
  } catch (e) {
    console.error("referral credit failed", e);
    return false;
  }
  await supabaseAdmin.from("subscribers").update({ referral_credited: true }).eq("stripe_checkout_session_id", o.checkoutSessionId);
  const e = referralCreditEmail({ origin: o.origin });
  await sendEmail({ to: ref.email, subject: e.subject, title: e.title, html: e.html }).catch((err) => console.error("referral email failed", err));
  return true;
}

export interface ReferralSummary {
  code: string;
  joined: number;
  credited: number;
}

/** The member's referral code (made on first request) and how it's going. */
export async function referralSummary(email: string): Promise<ReferralSummary | null> {
  if (!supabaseAdmin) return null;
  const { data: sub, error } = await supabaseAdmin
    .from("subscribers")
    .select("id, referral_code")
    .eq("email", email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !sub) return null;
  let code = cleanReferralCode(sub.referral_code);
  for (let tries = 0; !code && tries < 5; tries++) {
    const next = newReferralCode();
    const { error: upErr } = await supabaseAdmin.from("subscribers").update({ referral_code: next }).eq("id", sub.id);
    if (!upErr) code = next;
    else if (!/duplicate|23505/i.test(`${upErr.code} ${upErr.message}`)) return null;
  }
  if (!code) return null;
  const { data: friends } = await supabaseAdmin.from("subscribers").select("referral_credited").eq("referred_by", code);
  const rows = (friends ?? []) as { referral_credited: boolean | null }[];
  return { code, joined: rows.length, credited: rows.filter((r) => r.referral_credited).length };
}

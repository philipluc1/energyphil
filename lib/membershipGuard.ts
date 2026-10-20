import "server-only";
import type Stripe from "stripe";
import { stripe } from "./stripeClient";
import { supabaseAdmin } from "./supabaseAdmin";
import { sendEmail } from "./email";
import { duplicatePaymentEmail } from "./emailTemplates";
import { normalEmail } from "./emailIdentity";

// One membership per email address.
//  1. Before checkout: if the email already has a live membership (in our
//     database or in Stripe), don't start a new checkout; send them to log in.
//     If Stripe already knows the email (e.g. a past member), reuse that
//     Stripe customer so their history stays in one place.
//  2. After payment: if two checkouts slipped through at once (two tabs), the
//     second is a duplicate: cancel it, refund it in full and tell them.

const LIVE_SUB = new Set(["active", "trialing", "past_due", "unpaid"]);

export interface CheckoutGuard {
  /** Already has a live membership under this email. */
  active: boolean;
  /** Has ever had a membership under this email (for "new members only" offers). */
  everMember: boolean;
  /** An existing Stripe customer to reuse, if any. */
  customerId: string | null;
}

export async function checkoutGuard(emailTyped: string): Promise<CheckoutGuard> {
  const lower = normalEmail(emailTyped);
  const emails = Array.from(new Set([lower, emailTyped.trim()]));
  let active = false;
  let everMember = false;
  let customerId: string | null = null;

  if (supabaseAdmin) {
    const { data } = await supabaseAdmin.from("subscribers").select("status").in("email", emails).limit(20);
    const rows = (data ?? []) as { status: string }[];
    everMember = rows.length > 0;
    active = rows.some((r) => r.status === "active" || r.status === "past_due");
  }
  if (stripe) {
    try {
      for (const e of emails) {
        const customers = await stripe.customers.list({ email: e, limit: 5 });
        for (const c of customers.data) {
          if (c.deleted) continue;
          customerId ??= c.id;
          const subs = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 10 });
          if (subs.data.length) everMember = true;
          if (subs.data.some((s) => LIVE_SUB.has(s.status))) {
            active = true;
            customerId = c.id;
          }
        }
      }
    } catch (e) {
      // Stripe lookups are a second check; the database check above still applies.
      console.error("checkoutGuard: Stripe lookup failed", e);
    }
  }
  return { active, everMember, customerId };
}

/** The payment behind a Checkout session: direct for one-off payments, via the first invoice for subscriptions. */
async function paymentIntentOf(session: Stripe.Checkout.Session): Promise<string | null> {
  if (!stripe) return null;
  const direct = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  if (direct) return direct;
  const invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null;
  if (!invoiceId) return null;
  const pays = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 5 });
  const paid = pays.data.find((p) => p.status === "paid") ?? pays.data[0];
  const ref = paid?.payment?.payment_intent;
  return typeof ref === "string" ? ref : ref?.id ?? null;
}

/** A second payment for an email that's already a member: cancel and refund it, once. */
export async function refundDuplicate(session: Stripe.Checkout.Session, email: string, origin: string): Promise<boolean> {
  if (!stripe) return false;
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  try {
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId).catch(() => null);
      if (sub && sub.status !== "canceled") await stripe.subscriptions.cancel(subId);
    }
    const pi = await paymentIntentOf(session);
    if (!pi) {
      console.error(`Duplicate membership payment for ${email} (session ${session.id}): no payment found to refund. Refund it by hand in Stripe.`);
      return false;
    }
    // The webhook and the dashboard's sync can both get here: refund once, email once.
    const already = await stripe.refunds.list({ payment_intent: pi, limit: 1 });
    if (already.data.length) return true;
    await stripe.refunds.create({ payment_intent: pi, reason: "duplicate" }, { idempotencyKey: `utilo-duplicate-${session.id}` });
    const e = duplicatePaymentEmail({ origin });
    await sendEmail({ to: email, subject: e.subject, title: e.title, html: e.html }).catch((err) => console.error("duplicate email failed", err));
    return true;
  } catch (err) {
    console.error(`Duplicate membership payment for ${email} (session ${session.id}) not refunded automatically. Refund it by hand in Stripe.`, err);
    return false;
  }
}

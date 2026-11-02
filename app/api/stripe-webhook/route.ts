import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createMembershipFromSession } from "@/lib/membership";
import { decideCancelEmail, endsOnLabel } from "@/lib/cancelEmail";
import { membershipCancelled } from "@/lib/emailTemplates";
import { sendEmail } from "@/lib/email";
import { REGULAR_PRICES, fmtPrice, isFoundingAmount, type PlanId } from "@/lib/pricingPlans";

export const maxDuration = 30;


// Stripe's API has, over past versions, located a subscription's current
// billing-period end either directly on the subscription or on its first
// item — check both rather than assume one shape.
function getPeriodEnd(sub: Stripe.Subscription): number | null {
  const direct = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof direct === "number") return direct;
  const itemLevel = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  return typeof itemLevel?.current_period_end === "number" ? itemLevel.current_period_end : null;
}


export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    // Not configured: answer with an error so Stripe keeps retrying (for up to
    // 3 days) and the event isn't lost once the secret is added.
    console.error("Stripe webhook: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing");
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    if (!sig) throw new Error("missing stripe-signature header");
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    console.error("Stripe webhook received but SUPABASE_SECRET_KEY isn't configured:", event.type);
    return NextResponse.json({ error: "database not configured" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const origin = process.env.SITE_URL || new URL(req.url).origin;
        const r = await createMembershipFromSession(session, origin);
        // A failed save must be retried, or a paying customer is never recognised.
        if (!r.ok) throw new Error(`membership not saved: ${r.message ?? "unknown"}`);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // Events can arrive out of order, so read the subscription's current
        // state from Stripe rather than trusting this (possibly stale) copy.
        const stale = event.data.object as Stripe.Subscription;
        let sub: Stripe.Subscription = stale;
        try {
          sub = await stripe.subscriptions.retrieve(stale.id);
        } catch {
          /* deleted subscriptions may not be retrievable; fall back to the event */
        }
        const status =
          sub.status === "canceled" || sub.status === "incomplete_expired" || (event.type === "customer.subscription.deleted" && sub === stale)
            ? "canceled"
            : sub.status === "active" || sub.status === "trialing"
              ? "active"
              : "past_due";
        const periodEnd = getPeriodEnd(sub);

        const base = {
          status,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        };
        // For the owner dashboard's churn report (2 Nov 2026): when they
        // cancelled, when it ends, and the reason they picked in Stripe's portal.
        const iso = (t: number | null | undefined) => (t ? new Date(t * 1000).toISOString() : null);
        const details = sub.cancellation_details;
        const extra = {
          canceled_at: iso(sub.canceled_at) ?? (status === "canceled" ? new Date().toISOString() : null),
          cancel_at: sub.cancel_at_period_end ? iso(sub.cancel_at ?? periodEnd) : iso(sub.cancel_at),
          cancel_reason: details?.feedback ?? (details?.comment ? "other" : null),
          cancel_comment: details?.comment ? details.comment.slice(0, 500) : null,
        };
        let { error } = await supabaseAdmin.from("subscribers").update({ ...base, ...extra }).eq("stripe_subscription_id", sub.id);
        // An older database without the new columns: keep the status right.
        if (error && /column|schema cache/i.test(error.message)) ({ error } = await supabaseAdmin.from("subscribers").update(base).eq("stripe_subscription_id", sub.id));
        if (error) throw error;
        // The cancellation email (2 Nov 2026). Never fails the webhook: the membership is already saved.
        await cancelEmail(sub.id, status, extra.cancel_at, process.env.SITE_URL || new URL(req.url).origin).catch((e) => console.error("cancel email failed", e));
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Tell Stripe it failed so it retries; a lost "cancelled" or "paid" event
    // would leave the membership wrong indefinitely.
    console.error("Stripe webhook handler error", event.type, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Tells a member their membership is cancelled (or has ended), once. */
async function cancelEmail(subscriptionId: string, status: string, cancelAt: string | null, origin: string) {
  if (!supabaseAdmin) return;
  const { data: row, error } = await supabaseAdmin
    .from("subscribers")
    .select("id, email, customer_name, plan, amount_cents, cancel_email_for")
    .eq("stripe_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle();
  if (error || !row) return; // older database without the column, or no such membership
  const { data: others } = await supabaseAdmin.from("subscribers").select("id").ilike("email", row.email).eq("status", "active").neq("id", row.id).limit(1);
  const d = decideCancelEmail({ status, cancelAt, sentFor: row.cancel_email_for ?? null, otherActive: (others ?? []).length > 0 });
  if (d.reset) await supabaseAdmin.from("subscribers").update({ cancel_email_for: null }).eq("id", row.id);
  if (!d.send) return;
  const plan = row.plan as PlanId;
  const per = plan === "monthly" ? "a month" : "a year";
  const regular = REGULAR_PRICES[plan];
  const founding = isFoundingAmount(plan, row.amount_cents) && regular !== undefined && regular > (row.amount_cents ?? 0);
  const e = membershipCancelled({
    origin,
    name: row.customer_name,
    kind: d.send,
    endsOn: cancelAt ? endsOnLabel(cancelAt) : null,
    lockedPrice: founding ? `${fmtPrice(row.amount_cents!)} ${per}` : null,
    regularPrice: founding ? `${fmtPrice(regular!)} ${per}` : null,
  });
  if (await sendEmail({ to: row.email, subject: e.subject, title: e.title, html: e.html })) {
    await supabaseAdmin.from("subscribers").update({ cancel_email_for: d.key }).eq("id", row.id);
  }
}

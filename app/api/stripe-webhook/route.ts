import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createMembershipFromSession } from "@/lib/membership";

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
    // Not configured yet — acknowledge so Stripe doesn't retry forever, but
    // do nothing; there's nowhere to write the result.
    return NextResponse.json({ received: true, note: "webhook not configured" }, { status: 200 });
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
    console.error("Stripe webhook received but SUPABASE_SECRET_KEY isn't configured — nothing saved:", event.type);
    return NextResponse.json({ received: true, note: "supabase not configured" }, { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const origin = process.env.SITE_URL || new URL(req.url).origin;
        await createMembershipFromSession(session, origin);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const status =
          event.type === "customer.subscription.deleted" ? "canceled" : sub.status === "active" ? "active" : "past_due";
        const periodEnd = getPeriodEnd(sub);

        const { error } = await supabaseAdmin
          .from("subscribers")
          .update({
            status,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          })
          .eq("stripe_subscription_id", sub.id);
        if (error) console.error("Failed to update subscriber status", error);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Log and still acknowledge receipt — returning an error here makes
    // Stripe retry the same event indefinitely, which won't fix a code bug.
    console.error("Stripe webhook handler error", err);
  }

  return NextResponse.json({ received: true });
}

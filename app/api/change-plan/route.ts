import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveMember } from "@/lib/memberAccess";
import { findPlan, type PlanId } from "@/lib/pricingPlans";

export const maxDuration = 30;

// Moves a member between the recurring plans (monthly / quarterly /
// half-yearly). Stripe prorates the difference on the next invoice. The
// once-off plan isn't a subscription, so it can't be switched here.
export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!stripe || !supabaseAdmin) return NextResponse.json({ ok: false, message: "Billing isn't switched on yet." });

  const b = await req.json().catch(() => null);
  const plan = findPlan(String(b?.planId ?? "") as PlanId);
  if (!plan || plan.mode !== "subscription") return NextResponse.json({ ok: false, message: "Pick a monthly, quarterly or half-yearly plan." });

  const { data: sub } = await supabaseAdmin
    .from("subscribers")
    .select("id, plan, stripe_subscription_id")
    .eq("email", member.email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ ok: false, message: "Your plan is a once-off payment, so there's nothing to switch. Email us if you'd like to move to a subscription." });
  }
  if (sub.plan === plan.id) return NextResponse.json({ ok: true, message: "You're already on that plan." });

  try {
    const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const item = current.items.data[0];
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [
        {
          id: item.id,
          price_data: {
            currency: plan.currency,
            unit_amount: plan.priceCents,
            product: typeof item.price.product === "string" ? item.price.product : item.price.product.id,
            recurring: { interval: plan.interval!, interval_count: plan.intervalCount! },
          },
        },
      ],
      proration_behavior: "create_prorations",
      metadata: { planId: plan.id },
    });
    const periodEnd = updated.items.data[0]?.current_period_end;
    await supabaseAdmin
      .from("subscribers")
      .update({
        plan: plan.id,
        amount_cents: plan.priceCents,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      })
      .eq("id", sub.id);
    return NextResponse.json({ ok: true, message: `Switched to ${plan.name}. The difference is prorated on your next invoice.` });
  } catch (err) {
    console.error("change-plan failed", err);
    return NextResponse.json({ ok: false, message: "Couldn't change the plan. Try again, or use Manage billing." });
  }
}

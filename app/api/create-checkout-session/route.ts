import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripeClient";
import { findPlan } from "@/lib/pricingPlans";

export const maxDuration = 30;

interface CheckoutBody {
  planId?: string;
  email?: string;
  profile?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { ok: false, message: "Payments aren't switched on yet — please check back soon." },
      { status: 200 },
    );
  }

  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const plan = findPlan(body.planId ?? "");
  if (!plan) {
    return NextResponse.json({ ok: false, message: "Unknown plan." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, message: "Please enter a valid email." }, { status: 400 });
  }

  const profile = body.profile ?? {};
  // Stripe metadata values must be strings. This is the comparison the
  // customer subscribed from — stored so the (future) monitoring job knows
  // what to re-check and what to compare against.
  const metadata: Record<string, string> = {
    planId: plan.id,
    distributor: String(profile.distributor ?? ""),
    billingDays: String(profile.billingDays ?? ""),
    usageMode: String(profile.usageMode ?? ""),
    peak: String(profile.peak ?? ""),
    shoulder: String(profile.shoulder ?? ""),
    offpeak: String(profile.offpeak ?? ""),
    anytime: String(profile.anytime ?? ""),
    cl: String(profile.cl ?? ""),
    baselineTotal: String(profile.baselineTotal ?? ""),
    baselineRetailer: String(profile.baselineRetailer ?? "").slice(0, 200),
    baselinePlanName: String(profile.baselinePlanName ?? "").slice(0, 200),
  };

  const origin = req.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan.mode,
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency,
            unit_amount: plan.priceCents,
            product_data: {
              name: `VIC Energy Check — ${plan.name} monitoring`,
              description:
                "Ongoing monitoring of Victorian electricity plans, with an alert whenever a cheaper deal appears.",
            },
            ...(plan.mode === "subscription"
              ? { recurring: { interval: plan.interval!, interval_count: plan.intervalCount! } }
              : {}),
          },
        },
      ],
      metadata,
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
    });

    if (!session.url) {
      return NextResponse.json({ ok: false, message: "Couldn't start checkout — please try again." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("Stripe checkout session error", err);
    return NextResponse.json(
      { ok: false, message: "Couldn't start checkout — please try again shortly." },
      { status: 502 },
    );
  }
}

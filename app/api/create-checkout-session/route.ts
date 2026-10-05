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
    referenceTotal: String(profile.referenceTotal ?? ""),
    customerName: String(profile.customerName ?? "").slice(0, 120),
    address: String(profile.address ?? "").slice(0, 200),
    suburb: String(profile.suburb ?? "").slice(0, 80),
    postcode: String(profile.postcode ?? "").slice(0, 4),
    hasSolar: profile.hasSolar ? "true" : "false",
    solarExportKwh: String(profile.solarExportKwh ?? ""),
    // Compact JSON of the household profile (people, heating, EV, ...). Stripe
    // allows 500 chars per metadata value; the profile is well under that.
    homeProfile: profile.homeProfile ? JSON.stringify(profile.homeProfile).slice(0, 480) : "",
  };

  const origin = req.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan.mode,
      customer_email: email,
      // Stripe's "Managed Payments" (merchant-of-record) feature is on by
      // default for newer accounts and requires every product to carry a
      // tax code, which this app doesn't set up. Turning it off restores
      // the standard Checkout behaviour this app was built against.
      managed_payments: { enabled: false },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency,
            unit_amount: plan.priceCents,
            product_data: {
              name: `Utilo — ${plan.name} monitoring`,
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
      // Goes via /api/welcome-link, which signs the new member in and lands them on /welcome.
      success_url: `${origin}/api/welcome-link?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/check#pricing`,
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

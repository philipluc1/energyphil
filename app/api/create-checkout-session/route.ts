import { NextRequest, NextResponse } from "next/server";
import { cleanBillCheck } from "@/lib/billCheck";
import { stripe } from "@/lib/stripeClient";
import { findPlan } from "@/lib/pricingPlans";
import { SRC_COOKIE, parseSource, sourceValue } from "@/lib/attribution";
import { ensureFriendCoupon, referrerFor } from "@/lib/referrals";
import { checkoutGuard } from "@/lib/membershipGuard";
import { canonicalEmail } from "@/lib/emailIdentity";

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
  if (!plan || !plan.onSale) {
    return NextResponse.json({ ok: false, message: "Unknown plan." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, message: "Please enter a valid email." }, { status: 400 });
  }

  // One membership per email: an existing member is sent to log in instead,
  // and a past member's Stripe customer is reused.
  const guard = await checkoutGuard(email);
  if (guard.active) {
    return NextResponse.json(
      { ok: false, alreadyMember: true, message: "That email already has a Utilo membership. Log in to your dashboard to see it, change plan or cancel." },
      { status: 409 },
    );
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
    currentRetailer: String(profile.currentRetailer ?? "").slice(0, 80),
    solarExportKwh: String(profile.solarExportKwh ?? ""),
    demandKw: String(profile.demandKw ?? ""),
    // Compact JSON of the household profile (people, heating, EV, ...). Stripe
    // allows 500 chars per metadata value; the profile is well under that.
    homeProfile: profile.homeProfile ? JSON.stringify(profile.homeProfile).slice(0, 480) : "",
    // Current plan pricing and deal end dates (for "your discount ends" alerts).
    currentRates: profile.currentRates ? JSON.stringify(profile.currentRates).slice(0, 480) : "",
    billCheck: (() => { const c = cleanBillCheck(profile.billCheck); const j = c ? JSON.stringify(c) : ""; return j.length <= 490 ? j : ""; })(),
    priceType: profile.priceType === "fixed" || profile.priceType === "variable" ? profile.priceType : "",
    priceFixedUntil: /^\d{4}-\d{2}-\d{2}$/.test(String(profile.priceFixedUntil ?? "")) ? String(profile.priceFixedUntil) : "",
    discountEndsAt: /^\d{4}-\d{2}-\d{2}$/.test(String(profile.discountEndsAt ?? "")) ? String(profile.discountEndsAt) : "",
    currentPlanName: String(profile.currentPlanName ?? "").slice(0, 120),
    // The meter number off their bill, so the dashboard doesn't ask for it again.
    nmi: /^[0-9A-Z]{10,11}$/.test(String(profile.nmi ?? "")) ? String(profile.nmi) : "",
  };

  // Where they came from (partner, a member's referral, an ad), from the
  // first-party cookie set by /p/<code>, /r/<CODE> or a campaign link.
  const sourceRaw = sourceValue(req.cookies.get(SRC_COOKIE)?.value);
  if (sourceRaw) metadata.source = sourceRaw;
  // A friend's referral: money off the first payment, unless it's their own link.
  let discounts: { coupon: string }[] | undefined;
  const src = parseSource(sourceRaw);
  if (src?.kind === "referral") {
    const ref = await referrerFor(src.code);
    // New members only, and not your own link (however the address is written).
    if (ref && !guard.everMember && canonicalEmail(ref.email) !== canonicalEmail(email)) {
      const coupon = await ensureFriendCoupon();
      if (coupon) {
        discounts = [{ coupon }];
        metadata.referredBy = src.code;
      }
    }
  }

  const origin = req.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan.mode,
      ...(guard.customerId ? { customer: guard.customerId } : { customer_email: email }),
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
      ...(discounts ? { discounts } : {}),
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

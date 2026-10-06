import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findPlan } from "@/lib/pricingPlans";
import { sendEmail } from "@/lib/email";

export const maxDuration = 30;

function toNum(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Stripe's API has, over past versions, located a subscription's current
// billing-period end either directly on the subscription or on its first
// item — check both rather than assume one shape.
function getPeriodEnd(sub: Stripe.Subscription): number | null {
  const direct = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof direct === "number") return direct;
  const itemLevel = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  return typeof itemLevel?.current_period_end === "number" ? itemLevel.current_period_end : null;
}

function parseJson(v: string | undefined): unknown {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
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
        const md = session.metadata ?? {};
        const plan = findPlan(md.planId ?? "");
        if (!plan) {
          console.error("Checkout completed with unrecognized planId metadata:", md.planId);
          break;
        }

        const email = session.customer_email ?? session.customer_details?.email ?? "";
        const billingDays = toNum(md.billingDays);
        const baselineTotal = toNum(md.baselineTotal);
        const referenceTotal = toNum(md.referenceTotal);

        const { data: inserted, error } = await supabaseAdmin
          .from("subscribers")
          .insert({
            email,
            plan: plan.id,
            status: "active",
            amount_cents: session.amount_total ?? plan.priceCents,
            currency: (session.currency ?? plan.currency).toLowerCase(),
            stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
            stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
            stripe_checkout_session_id: session.id,
            distributor: md.distributor || null,
            billing_days: billingDays,
            usage_mode: md.usageMode || null,
            peak_kwh: toNum(md.peak),
            shoulder_kwh: toNum(md.shoulder),
            offpeak_kwh: toNum(md.offpeak),
            anytime_kwh: toNum(md.anytime),
            controlled_load_kwh: toNum(md.cl),
            baseline_total: baselineTotal,
            baseline_retailer: md.baselineRetailer || null,
            baseline_plan_name: md.baselinePlanName || null,
            reference_total: referenceTotal,
            customer_name: md.customerName || null,
            address: md.address || null,
            suburb: md.suburb || null,
            postcode: md.postcode || null,
            has_solar: md.hasSolar === "true",
            solar_export_kwh: toNum(md.solarExportKwh),
            home_profile: parseJson(md.homeProfile),
          })
          .select("id")
          .single();
        if (error) console.error("Failed to save subscriber", error);

        // Welcome email: what they get, and the two things to do first.
        if (email) {
          const origin = process.env.SITE_URL || new URL(req.url).origin;
          await sendEmail({
            to: email,
            subject: "Welcome to Utilo. Here's what happens next",
            cta: { label: "Open My Dashboard", url: `${origin}/account` },
            html: `
              <p>Thanks for joining. From now on we re-check your plan every morning and email you only when switching is worth it. On the 1st of each month you'll get a short summary.</p>
              <p style="font-size:16px;font-weight:700;margin:18px 0 6px;">Two things to do now</p>
              <ol style="margin:0 0 16px;padding-left:20px;line-height:1.6;">
                <li><a href="${origin}/account">Read your latest bill</a> (photo or PDF) so your checks use real numbers.</li>
                <li>Once you've switched, tell us the date on your dashboard so your savings count from the right day.</li>
              </ol>
              ${md.baselineRetailer ? `<p>Your best match at sign-up was <strong>${md.baselineRetailer}${md.baselinePlanName ? ` — ${md.baselinePlanName}` : ""}</strong>.</p>` : ""}
              <p>Questions? Just reply to this email.</p>
            `,
          }).catch((e) => console.error("welcome email failed", e));
        }

        // Open the first savings episode, if we have everything needed to
        // price it — the real starting bill (referenceTotal), the plan we're
        // matching them to now (baselineTotal), and how many days that spans.
        // Older/incomplete signups just won't have savings history, which is
        // fine — the account page only shows it when there's something to show.
        if (inserted && referenceTotal !== null && baselineTotal !== null && billingDays && billingDays > 0) {
          const dailyRate = (referenceTotal - baselineTotal) / billingDays;
          const { error: episodeErr } = await supabaseAdmin.from("savings_episodes").insert({
            subscriber_id: inserted.id,
            email,
            daily_rate: dailyRate,
            best_retailer: md.baselineRetailer || null,
            best_plan_name: md.baselinePlanName || null,
            best_total: baselineTotal,
          });
          if (episodeErr) console.error("Failed to open savings episode", episodeErr);
        }
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

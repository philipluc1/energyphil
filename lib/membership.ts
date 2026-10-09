import "server-only";
import type Stripe from "stripe";
import { supabaseAdmin } from "./supabaseAdmin";
import { findPlan } from "./pricingPlans";
import { sendEmail } from "./email";

function toNum(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
function parseJson(v: string | undefined): unknown {
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

/** Creates the membership row for a paid Checkout session. Used by the Stripe
 *  webhook and by the dashboard's "sync" fallback, so a missed webhook never
 *  leaves someone paid but unrecognised. Idempotent on the session id. */
export async function createMembershipFromSession(session: Stripe.Checkout.Session, origin: string, opts: { sendWelcome?: boolean } = {}): Promise<{ ok: boolean; created: boolean; message?: string }> {
  if (!supabaseAdmin) return { ok: false, created: false, message: "Supabase not configured" };
  const md = session.metadata ?? {};
  const plan = findPlan(md.planId ?? "");
  if (!plan) return { ok: false, created: false, message: `Unrecognised planId ${md.planId}` };
  const email = (session.customer_email ?? session.customer_details?.email ?? "").toLowerCase();
  if (!email) return { ok: false, created: false, message: "No email on session" };

  const { data: existing } = await supabaseAdmin.from("subscribers").select("id").eq("stripe_checkout_session_id", session.id).limit(1).maybeSingle();
  if (existing) return { ok: true, created: false };

  const billingDays = toNum(md.billingDays);
  const baselineTotal = toNum(md.baselineTotal);
  const referenceTotal = toNum(md.referenceTotal);
  const core = {
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
  };
  const extras = {
    customer_name: md.customerName || null,
    address: md.address || null,
    suburb: md.suburb || null,
    postcode: md.postcode || null,
    has_solar: md.hasSolar === "true",
    solar_export_kwh: toNum(md.solarExportKwh),
    home_profile: parseJson(md.homeProfile),
    current_retailer: md.currentRetailer || null,
  };
  let { data: inserted, error } = await supabaseAdmin.from("subscribers").insert({ ...core, ...extras }).select("id").single();
  // If the database is missing a newer optional column (schema.sql not re-run),
  // still create the membership with the core fields rather than fail.
  if (error && /column|schema cache/i.test(error.message)) {
    console.error("subscriber insert: retrying without optional columns", error.message);
    ({ data: inserted, error } = await supabaseAdmin.from("subscribers").insert(core).select("id").single());
  }
  if (error) {
    console.error("Failed to save subscriber", error);
    return { ok: false, created: false, message: error.message };
  }

  if (opts.sendWelcome !== false) {
    await sendEmail({
      to: email,
      subject: "Welcome to Utilo. Let's start saving",
      cta: { label: "Upload my bill and see my dashboard", url: `${origin}/account` },
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
  return { ok: true, created: true };
}

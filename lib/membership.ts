import "server-only";
import type Stripe from "stripe";
import { supabaseAdmin } from "./supabaseAdmin";
import { findPlan } from "./pricingPlans";
import { esc, sendEmail } from "./email";
import { PLANS } from "./plans";

const KNOWN_RETAILERS = new Set(PLANS.map((p) => p[0]));

function toNum(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
function parseJson(v: string | undefined): unknown {
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

/** True only when Stripe confirms the money arrived (a completed checkout
 *  can still be "unpaid" for delayed methods like direct debit). */
export function isPaidSession(s: Stripe.Checkout.Session): boolean {
  return s.status === "complete" && (s.payment_status === "paid" || s.payment_status === "no_payment_required");
}

/** Creates the membership row for a paid Checkout session. Used by the Stripe
 *  webhook and by the dashboard's "sync" fallback, so a missed webhook never
 *  leaves someone paid but unrecognised. Idempotent on the session id. */
export async function createMembershipFromSession(session: Stripe.Checkout.Session, origin: string, opts: { sendWelcome?: boolean } = {}): Promise<{ ok: boolean; created: boolean; message?: string }> {
  if (!supabaseAdmin) return { ok: false, created: false, message: "Supabase not configured" };
  if (!isPaidSession(session)) return { ok: true, created: false, message: "Payment not confirmed yet" };
  const md = session.metadata ?? {};
  const plan = findPlan(md.planId ?? "");
  if (!plan) return { ok: false, created: false, message: `Unrecognised planId ${md.planId}` };
  const email = (session.customer_email ?? session.customer_details?.email ?? "").toLowerCase();
  if (!email) return { ok: false, created: false, message: "No email on session" };

  const { data: existing } = await supabaseAdmin.from("subscribers").select("id").eq("stripe_checkout_session_id", session.id).limit(1).maybeSingle();
  if (existing) return { ok: true, created: false };

  const billingDays = toNum(md.billingDays);
  // These come from the browser via checkout metadata: keep only plausible values.
  const plausible = (n: number | null) => (n !== null && n > 0 && n < 20000 ? n : null);
  const baselineTotal = plausible(toNum(md.baselineTotal));
  const referenceTotal = plausible(toNum(md.referenceTotal));
  const baselineRetailer = KNOWN_RETAILERS.has(md.baselineRetailer ?? "") ? (md.baselineRetailer as string) : null;
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
    baseline_retailer: baselineRetailer,
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
    current_plan_name: md.currentPlanName || null,
    current_rates: cleanRates(parseJson(md.currentRates)),
    current_price_type: md.priceType === "fixed" || md.priceType === "variable" ? md.priceType : null,
    current_price_fixed_until: /^\d{4}-\d{2}-\d{2}$/.test(md.priceFixedUntil ?? "") ? md.priceFixedUntil : null,
    discount_ends_at: /^\d{4}-\d{2}-\d{2}$/.test(md.discountEndsAt ?? "") ? md.discountEndsAt : null,
  };
  let { data: inserted, error } = await supabaseAdmin.from("subscribers").insert({ ...core, ...extras }).select("id").single();
  // If the database is missing a newer optional column (schema.sql not re-run),
  // still create the membership with the core fields rather than fail.
  if (error && /column|schema cache/i.test(error.message)) {
    console.error("subscriber insert: retrying without optional columns", error.message);
    ({ data: inserted, error } = await supabaseAdmin.from("subscribers").insert(core).select("id").single());
  }
  // The webhook and the dashboard's sync can race; the unique index on
  // stripe_checkout_session_id makes the second insert fail harmlessly.
  if (error && (error.code === "23505" || /duplicate key/i.test(error.message))) return { ok: true, created: false };
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
        ${baselineRetailer ? `<p>Your best match at sign-up was <strong>${esc(baselineRetailer)}${md.baselinePlanName ? ` (${esc(md.baselinePlanName)})` : ""}</strong>.</p>` : ""}
        <p>Questions? Just reply to this email.</p>
      `,
    }).catch((e) => console.error("welcome email failed", e));
  }

  if (inserted && referenceTotal !== null && baselineTotal !== null && billingDays && billingDays > 0) {
    const dailyRate = Math.max(0, (referenceTotal - baselineTotal) / billingDays);
    const { error: episodeErr } = await supabaseAdmin.from("savings_episodes").insert({
      subscriber_id: inserted.id,
      email,
      daily_rate: dailyRate,
      best_retailer: baselineRetailer,
      best_plan_name: md.baselinePlanName || null,
      best_total: baselineTotal,
    });
    if (episodeErr) console.error("Failed to open savings episode", episodeErr);
  }
  return { ok: true, created: true };
}

/** Rates from checkout metadata are untrusted: keep known keys as plausible numbers. */
function cleanRates(v: unknown): Record<string, number | null> | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const out: Record<string, number | null> = {};
  let any = false;
  for (const k of ["supply", "anytime", "peak", "shoulder", "offpeak", "cl", "solarFit"]) {
    const n = typeof r[k] === "number" && Number.isFinite(r[k]) && (r[k] as number) >= 0 && (r[k] as number) < 6 ? (r[k] as number) : null;
    out[k] = n;
    if (n !== null) any = true;
  }
  return any ? out : null;
}

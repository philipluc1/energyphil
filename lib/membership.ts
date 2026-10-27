import "server-only";
import { cleanBillCheck } from "./billCheck";
import type Stripe from "stripe";
import { supabaseAdmin } from "./supabaseAdmin";
import { findPlan } from "./pricingPlans";
import { sendEmail } from "./email";
import { welcomeEmail, type WelcomeEmailInput } from "./welcomeEmail";
import { PLANS, VDO, type Distributor } from "./plans";
import { vdoBillForUsage } from "./profileUsage";
import { cleanReferralCode, sourceValue } from "./attribution";
import { creditReferrer, newReferralCode } from "./referrals";
import { stripe } from "./stripeClient";
import { refundDuplicate } from "./membershipGuard";

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

  // A subscription that has since ended (e.g. an old checkout found by the
  // dashboard's sync) doesn't make anyone a member today.
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  if (stripe && subId) {
    const sub = await stripe.subscriptions.retrieve(subId).catch(() => null);
    if (sub && (sub.status === "canceled" || sub.status === "incomplete_expired")) return { ok: true, created: false, message: "That subscription has ended" };
  }

  // One membership per email: a second payment in the last 30 days for an
  // email that's already a member (two tabs, a double click) is cancelled and
  // refunded rather than made into a second membership.
  const { data: live } = await supabaseAdmin.from("subscribers").select("id").eq("email", email).in("status", ["active", "past_due"]).limit(1).maybeSingle();
  if (live && Date.now() / 1000 - session.created < 30 * 86400) {
    await refundDuplicate(session, email, origin);
    return { ok: true, created: false, message: "Already a member: second payment refunded" };
  }

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
    demand_kw: toNum(md.demandKw),
    home_profile: parseJson(md.homeProfile),
    current_retailer: md.currentRetailer || null,
    current_plan_name: md.currentPlanName || null,
    current_rates: cleanRates(parseJson(md.currentRates)),
    current_price_type: md.priceType === "fixed" || md.priceType === "variable" ? md.priceType : null,
    current_price_fixed_until: /^\d{4}-\d{2}-\d{2}$/.test(md.priceFixedUntil ?? "") ? md.priceFixedUntil : null,
    discount_ends_at: /^\d{4}-\d{2}-\d{2}$/.test(md.discountEndsAt ?? "") ? md.discountEndsAt : null,
    bill_check: cleanBillCheck(parseJson(md.billCheck)),
    nmi: /^[0-9A-Z]{10,11}$/.test(md.nmi ?? "") ? md.nmi : null,
    // Where they came from, who referred them, and their own code to share.
    source: sourceValue(md.source),
    referred_by: cleanReferralCode(md.referredBy),
    referral_code: newReferralCode(),
  };
  // The free check rides along in full: if the database is missing a newer
  // optional column (schema.sql not re-run), drop just that column and keep
  // everything else, so the member never has to type their check in again.
  const row: Record<string, unknown> = { ...core, ...extras };
  const insertRow = () => supabaseAdmin!.from("subscribers").insert(row).select("id").single();
  let { data: inserted, error } = await insertRow();
  for (let tries = 0; tries < 12 && error; tries++) {
    if (/duplicate key.*referral_code/i.test(error.message)) {
      // Two members drawing the same referral code is very unlikely; draw again.
      row.referral_code = newReferralCode();
    } else {
      const missing = missingColumn(error.message);
      if (!missing || !(missing in row) || missing in core) break;
      console.error(`subscriber insert: the database has no "${missing}" column yet (re-run supabase/schema.sql); saving without it`);
      delete row[missing];
    }
    ({ data: inserted, error } = await insertRow());
  }
  // Last resort: an unrecognised schema problem. Save the core fields rather than fail.
  if (error && /column|schema cache/i.test(error.message)) {
    console.error("subscriber insert: retrying with core fields only", error.message);
    ({ data: inserted, error } = await supabaseAdmin.from("subscribers").insert(core).select("id").single());
  }
  // The webhook and the dashboard's sync can race; the unique index on
  // stripe_checkout_session_id makes the second insert fail harmlessly.
  if (error && (error.code === "23505" || /duplicate key/i.test(error.message))) return { ok: true, created: false };
  if (error) {
    console.error("Failed to save subscriber", error);
    return { ok: false, created: false, message: error.message };
  }

  // A friend's referral: credit the member who sent them (once per checkout).
  const referredBy = cleanReferralCode(md.referredBy);
  if (referredBy) {
    await creditReferrer({ code: referredBy, checkoutSessionId: session.id, friendEmail: email, origin }).catch((e) => console.error("referral credit", e));
  }

  if (opts.sendWelcome) {
    // Normally the welcome goes from /api/welcome-link (with the sign-in link
    // in it) the moment they land back from Stripe. This is only for callers
    // that ask for it. Wording and layout live in lib/welcomeEmail.ts.
    const w = welcomeEmail(welcomeInputFromSession(session, origin, null));
    await sendEmail({ to: email, subject: w.subject, title: w.title, html: w.html }).catch((e) => console.error("welcome email failed", e));
  }

  // The free check becomes this month's saved check, so the dashboard opens
  // with a result on file. Against their bill when they gave one, otherwise
  // against the default offer for the same usage (as the check showed it).
  if (inserted && baselineTotal !== null && billingDays && billingDays > 0 && md.distributor && md.distributor in VDO) {
    const usage = { days: billingDays, peak: toNum(md.peak) ?? 0, shoulder: toNum(md.shoulder) ?? 0, offpeak: toNum(md.offpeak) ?? 0, anytime: toNum(md.anytime) ?? 0, cl: toNum(md.cl) ?? 0 };
    const reference = referenceTotal ?? Math.round(vdoBillForUsage(md.distributor as Distributor, usage) * 100) / 100;
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const { error: checkErr } = await supabaseAdmin.from("bill_checks").upsert(
      {
        email,
        month,
        source: extras.bill_check ? "bill" : "manual",
        billing_days: Math.round(billingDays),
        reference_total: reference,
        best_total: baselineTotal,
        best_retailer: baselineRetailer,
        best_plan_name: md.baselinePlanName || null,
        saving: reference - baselineTotal,
      },
      { onConflict: "email,month,source" },
    );
    if (checkErr) console.error("Failed to save the free check as the first monthly check", checkErr);
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

/**
 * What the welcome email says, from a paid Checkout session's metadata (the
 * free check that came with them). `signInUrl` is the one-time sign-in link
 * when the caller has one, so the welcome and the sign-in are one email.
 */
export function welcomeInputFromSession(session: Stripe.Checkout.Session, origin: string, signInUrl: string | null): WelcomeEmailInput {
  const md = session.metadata ?? {};
  const plan = findPlan(md.planId ?? "");
  const billingDays = toNum(md.billingDays);
  const plausible = (n: number | null) => (n !== null && n > 0 && n < 20000 ? n : null);
  const baselineTotal = plausible(toNum(md.baselineTotal));
  const referenceTotal = plausible(toNum(md.referenceTotal));
  const yearlySaving =
    referenceTotal !== null && baselineTotal !== null && billingDays && billingDays > 0
      ? Math.max(0, ((referenceTotal - baselineTotal) / billingDays) * 365)
      : null;
  return {
    origin,
    customerName: md.customerName || null,
    planName: plan?.name ?? "Membership",
    priceLabel: plan ? `$${(plan.priceCents / 100).toLocaleString("en-AU")} ${plan.cadenceLabel}` : "",
    bestRetailer: KNOWN_RETAILERS.has(md.baselineRetailer ?? "") ? (md.baselineRetailer as string) : null,
    bestPlanName: md.baselinePlanName || null,
    yearlySaving,
    fromBill: !!cleanBillCheck(parseJson(md.billCheck)),
    signInUrl,
  };
}

/** The column a PostgREST "missing column" error names, e.g.
 *  `Could not find the 'source' column of 'subscribers' in the schema cache`
 *  or `column "source" of relation "subscribers" does not exist`. */
export function missingColumn(message: string): string | null {
  const m = /could not find the '([a-z0-9_]+)' column/i.exec(message) ?? /column "([a-z0-9_]+)" of relation/i.exec(message);
  return m ? m[1] : null;
}

/**
 * A member's own details from a check they ran (typed in or read off a bill),
 * ready to update their record so the dashboard shows them: retailer, plan,
 * rates, usage, solar, address. Untrusted (it comes from the browser), so
 * only plausible values are kept, and blanks never wipe what's on file.
 */
export function memberFieldsFromCheck(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const n = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < max ? v : null);
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null);
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

  if (typeof p.distributor === "string" && p.distributor in VDO) out.distributor = p.distributor;
  const days = n(p.billingDays, 367);
  const kwh = ["peak", "shoulder", "offpeak", "anytime", "cl"].map((k) => n(p[k], 20000));
  // Usage only as a set, and only when there's some.
  if (days && days >= 1 && kwh.every((x) => x !== null) && kwh.reduce((a, b) => a + (b ?? 0), 0) > 0) {
    out.billing_days = Math.round(days);
    out.usage_mode = p.usageMode === "simple" || p.usageMode === "detailed" ? p.usageMode : "detailed";
    [out.peak_kwh, out.shoulder_kwh, out.offpeak_kwh, out.anytime_kwh, out.controlled_load_kwh] = kwh;
  }
  const ref = n(p.referenceTotal, 20000);
  if (ref !== null && ref > 0) out.reference_total = ref;
  const retailer = str(p.currentRetailer, 80);
  if (retailer) out.current_retailer = retailer;
  const plan = str(p.currentPlanName, 120);
  if (plan) out.current_plan_name = plan;
  const rates = cleanRates(p.currentRates);
  if (rates) out.current_rates = rates;
  if (p.priceType === "fixed" || p.priceType === "variable") out.current_price_type = p.priceType;
  const fixed = date(p.priceFixedUntil);
  if (fixed) out.current_price_fixed_until = fixed;
  const disc = date(p.discountEndsAt);
  if (disc) out.discount_ends_at = disc;
  if (typeof p.hasSolar === "boolean") out.has_solar = p.hasSolar;
  const exp = n(p.solarExportKwh, 20000);
  if (exp !== null) out.solar_export_kwh = exp;
  const dk = n(p.demandKw, 500);
  out.demand_kw = dk !== null && dk > 0 ? dk : null;
  // Home answers only when the questions were asked: a bill check carries
  // default answers, which mustn't replace real ones (or show as theirs).
  if (p.homeProfile && typeof p.homeProfile === "object" && (p.homeProfile as Record<string, unknown>).answered !== false && JSON.stringify(p.homeProfile).length < 2000) out.home_profile = p.homeProfile;
  if (typeof p.nmi === "string" && /^[0-9A-Z]{10,11}$/.test(p.nmi)) out.nmi = p.nmi;
  const bc = cleanBillCheck(p.billCheck);
  if (bc) out.bill_check = bc;
  for (const [key, col, max] of [["customerName", "customer_name", 120], ["address", "address", 200], ["suburb", "suburb", 80]] as const) {
    const v = str(p[key], max);
    if (v) out[col] = v;
  }
  if (typeof p.postcode === "string" && /^\d{4}$/.test(p.postcode)) out.postcode = p.postcode;
  return out;
}

/** Rates from checkout metadata are untrusted: keep known keys as plausible numbers. */
export function cleanRates(v: unknown): Record<string, number | null> | null {
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

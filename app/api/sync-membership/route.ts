import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createMembershipFromSession, isPaidSession } from "@/lib/membership";

export const maxDuration = 30;

// Fallback when the webhook didn't land: find the signed-in person's paid
// Checkout sessions in Stripe and create any membership that's missing.
export async function POST(req: NextRequest) {
  if (!stripe || !supabaseAdmin) return NextResponse.json({ ok: false, message: "Billing isn't switched on yet." });
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const { data } = token ? await supabaseAdmin.auth.getUser(token) : { data: null };
  const email = data?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ ok: false, message: "Please log in again." }, { status: 401 });

  const { data: existing } = await supabaseAdmin.from("subscribers").select("id").eq("email", email).eq("status", "active").limit(1).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, member: true, created: false });

  const mode = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live") ? "live" : "test";
  let paidFound = 0;
  let lastError = "";
  try {
    const customers = await stripe.customers.list({ email, limit: 10 });
    let created = false;
    for (const c of customers.data) {
      const sessions = await stripe.checkout.sessions.list({ customer: c.id, limit: 10 });
      for (const s of sessions.data) {
        if (!isPaidSession(s)) continue;
        paidFound++;
        const r = await createMembershipFromSession(s, process.env.SITE_URL || req.nextUrl.origin, { sendWelcome: false });
        if (r.created) created = true;
        if (!r.ok && r.message) lastError = r.message;
      }
    }
    // Sessions without a customer object (guest checkouts) can be found by email.
    if (!created) {
      const guest = await stripe.checkout.sessions.list({ customer_details: { email }, limit: 10 });
      for (const s of guest.data) {
        if (!isPaidSession(s)) continue;
        paidFound++;
        const r = await createMembershipFromSession(s, process.env.SITE_URL || req.nextUrl.origin, { sendWelcome: false });
        if (r.created) created = true;
        if (!r.ok && r.message) lastError = r.message;
      }
    }
    // A plain-English reason, shown on the dashboard when nothing was created.
    const reason = created
      ? ""
      : paidFound === 0
        ? `No paid checkout for ${email} found in Stripe (${mode} mode). If you paid with a different email, sign in with that one.`
        : `Found your payment but couldn't save the membership: ${lastError || "unknown error"}. Re-run supabase/schema.sql and try again.`;
    return NextResponse.json({ ok: true, member: created, created, paidFound, mode, reason });
  } catch (err) {
    console.error("sync-membership failed", err);
    return NextResponse.json({ ok: false, message: "Couldn't check Stripe. Try again in a minute." });
  }
}

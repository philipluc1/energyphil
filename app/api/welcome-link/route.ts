import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripeClient";

// Stripe sends people here after paying. We confirm the payment with Stripe,
// then EMAIL a one-click sign-in link to the address they paid with, and show
// /welcome ("check your inbox"). We deliberately don't sign the browser in
// directly: the checkout email isn't verified, so signing in from payment
// alone would let anyone pay with someone else's email and open their
// dashboard. The emailed link proves they own the address.
export async function GET(req: NextRequest) {
  const origin = process.env.SITE_URL || req.nextUrl.origin;
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  const fallback = NextResponse.redirect(`${origin}/welcome`);
  if (!stripe || !sessionId.startsWith("cs_")) return fallback;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
    const fresh = Date.now() / 1000 - session.created < 24 * 3600;
    const email = (session.customer_details?.email ?? session.customer_email ?? "").trim();
    if (!paid || !fresh || !email) return fallback;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return fallback;
    const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await anon.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/welcome`, shouldCreateUser: true } });
    if (error) {
      console.error("welcome-link: sending sign-in email failed", error.message);
      return fallback;
    }
    return NextResponse.redirect(`${origin}/welcome?check_email=1`);
  } catch (err) {
    console.error("welcome-link failed", err);
    return fallback;
  }
}

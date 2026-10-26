import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { emailConfigured, sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/welcomeEmail";
import { welcomeInputFromSession } from "@/lib/membership";

// Stripe sends people here after paying. We confirm the payment with Stripe,
// then send ONE email to the address they paid with: the welcome, with a
// one-click sign-in button in it. Then we show /welcome ("check your inbox").
//
// We deliberately don't sign the browser in directly: the checkout email isn't
// verified, so signing in from payment alone would let anyone pay with someone
// else's email and open their dashboard. The emailed link proves they own the
// address.
//
// If we can't mint a sign-in link ourselves (no service key, or email isn't
// set up), we fall back to Supabase's own sign-in email plus a plain welcome,
// which is two emails but never leaves anyone locked out.
export async function GET(req: NextRequest) {
  const origin = process.env.SITE_URL || req.nextUrl.origin;
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  const fallback = NextResponse.redirect(`${origin}/welcome`);
  if (!stripe || !sessionId.startsWith("cs_")) return fallback;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
    const fresh = Date.now() / 1000 - session.created < 24 * 3600;
    const email = (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
    if (!paid || !fresh || !email) return fallback;

    const redirectTo = `${origin}/welcome`;

    // One email: welcome + sign-in link.
    if (supabaseAdmin && emailConfigured) {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
      const link = data?.properties?.action_link;
      if (!error && link) {
        const w = welcomeEmail(welcomeInputFromSession(session, origin, link));
        const sent = await sendEmail({ to: email, subject: w.subject, title: w.title, html: w.html }).catch((e) => { console.error("welcome email failed", e); return false; });
        if (sent) return NextResponse.redirect(`${origin}/welcome?check_email=1`);
      } else if (error) {
        console.error("welcome-link: generating sign-in link failed", error.message);
      }
    }

    // Fallback: Supabase's own sign-in email, and the welcome without a link.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return fallback;
    const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await anon.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
    if (error) {
      console.error("welcome-link: sending sign-in email failed", error.message);
      return fallback;
    }
    if (emailConfigured) {
      const w = welcomeEmail(welcomeInputFromSession(session, origin, null));
      await sendEmail({ to: email, subject: w.subject, title: w.title, html: w.html }).catch((e) => console.error("welcome email failed", e));
    }
    return NextResponse.redirect(`${origin}/welcome?check_email=1`);
  } catch (err) {
    console.error("welcome-link failed", err);
    return fallback;
  }
}

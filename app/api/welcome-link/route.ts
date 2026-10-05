import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Stripe sends people here after paying. We confirm the payment with Stripe,
// then sign that email in (a one-time Supabase magic link generated on the
// server) and send them on to /welcome. The unguessable Stripe session id in
// the URL is what proves they just paid. If anything fails we fall back to
// the plain thank-you page, so nobody is ever stuck.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  const fallback = NextResponse.redirect(`${origin}/subscribe/success?session_id=${encodeURIComponent(sessionId)}`);
  if (!stripe || !supabaseAdmin || !sessionId.startsWith("cs_")) return fallback;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid" || session.status === "complete";
    const email = session.customer_email ?? session.customer_details?.email ?? "";
    if (!paid || !email) return fallback;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/welcome` },
    });
    const link = data?.properties?.action_link;
    if (error || !link) {
      console.error("welcome-link: generateLink failed", error);
      return fallback;
    }
    return NextResponse.redirect(link);
  } catch (err) {
    console.error("welcome-link failed", err);
    return fallback;
  }
}

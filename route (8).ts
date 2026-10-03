import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 30;

// Lets a signed-in customer manage their own billing (update card, cancel,
// see invoices) through Stripe's own hosted portal — no custom UI needed for
// any of that. The account page calls this with the customer's Supabase
// access token; we verify it server-side (never trust an email the browser
// just hands us) and only then look up their Stripe customer id.
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ ok: false, message: "Billing isn't switched on yet." }, { status: 200 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, message: "Accounts aren't switched on yet." }, { status: 200 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ ok: false, message: "Please log in again." }, { status: 401 });
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const email = userData?.user?.email;
  if (userErr || !email) {
    return NextResponse.json({ ok: false, message: "Please log in again." }, { status: 401 });
  }

  const { data: sub, error: subErr } = await supabaseAdmin
    .from("subscribers")
    .select("stripe_customer_id")
    .eq("email", email)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr) {
    console.error("create-portal-session: lookup failed", subErr);
    return NextResponse.json({ ok: false, message: "Something went wrong — please try again." }, { status: 500 });
  }
  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      { ok: false, message: "We can't find a billing account for that email yet." },
      { status: 200 },
    );
  }

  try {
    const origin = req.nextUrl.origin;
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/account`,
    });
    return NextResponse.json({ ok: true, url: portal.url });
  } catch (err) {
    console.error("create-portal-session: Stripe error", err);
    return NextResponse.json(
      {
        ok: false,
        message:
          "Couldn't open billing management — if this keeps happening, the Stripe Customer Portal may need activating (Stripe Dashboard > Settings > Billing > Customer portal).",
      },
      { status: 502 },
    );
  }
}

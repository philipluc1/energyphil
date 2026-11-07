import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { emailConfigured, sendEmail } from "@/lib/email";
import { signInEmail } from "@/lib/emailTemplates";

// Member login: emails a one-time sign-in link in Utilo's own email (from our
// sender, our branding), instead of Supabase's generic "Supabase Auth" one.
// Only members get a link. For any other address we send nothing and say so
// (7 Nov 2026: Phil's call; a non-member waiting on an email that never comes
// costs more than telling them). The 30s per-address limit still applies.
// If this route can't do the job (no secret key, no Resend), it says so with
// 503 and the page falls back to Supabase's own email.
export const runtime = "nodejs";

const recent = new Map<string, number>(); // email -> last send (per instance; the page also has a cooldown)

export async function POST(req: NextRequest) {
  if (!supabaseAdmin || !emailConfigured) return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return NextResponse.json({ ok: false, message: "Please enter a valid email address." }, { status: 400 });

  const last = recent.get(email) ?? 0;
  if (Date.now() - last < 30_000) return NextResponse.json({ ok: true, sent: true });
  recent.set(email, Date.now());

  const origin = process.env.SITE_URL || req.nextUrl.origin;
  const redirectTo = `${origin}/account`;
  try {
    // A member? (active or past-due; a lapsed member still gets in to see their history and re-join)
    const { data: member } = await supabaseAdmin.from("subscribers").select("id, customer_name").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!member) return NextResponse.json({ ok: true, sent: false, member: false }); // nothing sent

    let { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
    if (error && /not found|does not exist/i.test(error.message)) {
      // Paid, but never signed in: make the auth user, then the link.
      const made = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
      if (made.error && !/already/i.test(made.error.message)) throw made.error;
      ({ data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } }));
    }
    const link = data?.properties?.action_link;
    if (error || !link) throw error ?? new Error("No link");

    const e = signInEmail({ origin, url: link, name: (member as { customer_name?: string | null }).customer_name ?? null });
    const sent = await sendEmail({ to: email, subject: e.subject, title: e.title, html: e.html });
    if (!sent) throw new Error("send failed");
    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    console.error("login-link failed", err);
    recent.delete(email);
    return NextResponse.json({ ok: false, message: "Couldn't send a link just now." }, { status: 503 });
  }
}

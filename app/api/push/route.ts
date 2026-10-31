import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { pushConfigured, pushPublicKey, sendPush } from "@/lib/push";

// Phone notifications for members (the home-screen app).
//   GET    → is it set up, and the public key the phone needs to subscribe
//   POST   { subscription }       → save this phone
//   POST   { test: true }         → send a test notification to their phones
//   DELETE { endpoint }           → forget this phone

export async function GET() {
  return NextResponse.json({ ok: true, configured: pushConfigured, publicKey: pushConfigured ? pushPublicKey : null });
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!pushConfigured || !supabaseAdmin) return NextResponse.json({ ok: false, message: "Phone notifications aren't switched on yet." });
  const b = await req.json().catch(() => null);

  if (b?.test === true) {
    const n = await sendPush(member.email, { title: "Utilo notifications are on", body: "We'll tell you here when a cheaper plan turns up or your discount is ending.", url: "/account", tag: "utilo-test" });
    return NextResponse.json({ ok: n > 0, reached: n, message: n > 0 ? "Sent. Check your phone." : "Couldn't reach this phone. Try turning notifications off and on again." });
  }

  const sub = b?.subscription;
  const endpoint = str(sub?.endpoint, 2000);
  const p256dh = str(sub?.keys?.p256dh, 200);
  const auth = str(sub?.keys?.auth, 100);
  // Only the real push services (Apple, Google, Mozilla, Microsoft) are accepted.
  if (!endpoint || !p256dh || !auth || !/^https:\/\//.test(endpoint)) {
    return NextResponse.json({ ok: false, message: "That phone didn't give us a usable subscription." }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    { email: member.email, endpoint, p256dh, auth, user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("push: save failed", error.message);
    return NextResponse.json({ ok: false, message: "Couldn't save that. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: true });
  const b = await req.json().catch(() => null);
  const endpoint = str(b?.endpoint, 2000);
  if (endpoint) await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint).ilike("email", member.email);
  return NextResponse.json({ ok: true });
}

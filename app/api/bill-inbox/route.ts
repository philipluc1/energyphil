import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { INBOX_DOMAIN, inboxAddress, newInboxLocal } from "@/lib/billInbox";

// 5 Nov 2026: the member's private bill address and what last arrived there.
// GET: status. POST {action}: "create" (first time), "rotate" (a new address; the old one stops),
// "dismiss" (drop a forwarded bill that was waiting for a check).

const COLS = "id, customer_name, bill_inbox, inbox_last_at, inbox_last_status, inbox_gmail_code, inbox_gmail_link, inbox_pending";

async function load(email: string) {
  const { data, error } = await supabaseAdmin!.from("subscribers").select(COLS).eq("email", email).eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { sub: data, missing: !!error && /bill_inbox|inbox_/.test(error.message) };
}

function view(sub: Record<string, unknown> | null) {
  if (!sub) return { ok: true, ready: true, address: null };
  return {
    ok: true,
    ready: true,
    address: sub.bill_inbox ? inboxAddress(String(sub.bill_inbox)) : null,
    domain: INBOX_DOMAIN,
    lastAt: sub.inbox_last_at ?? null,
    lastStatus: sub.inbox_last_status ?? null,
    gmailCode: sub.inbox_last_status === "gmail" ? sub.inbox_gmail_code ?? null : null,
    gmailLink: sub.inbox_last_status === "gmail" ? sub.inbox_gmail_link ?? null : null,
    pending: sub.inbox_pending ?? null,
  };
}

export async function GET(req: NextRequest) {
  const m = await requireActiveMember(req.headers.get("authorization"));
  if (!m.ok) return NextResponse.json({ ok: false, message: m.message }, { status: m.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, ready: false });
  const { sub, missing } = await load(m.email);
  if (missing) return NextResponse.json({ ok: true, ready: false });
  return NextResponse.json(view(sub));
}

export async function POST(req: NextRequest) {
  const m = await requireActiveMember(req.headers.get("authorization"));
  if (!m.ok) return NextResponse.json({ ok: false, message: m.message }, { status: m.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, ready: false });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const { sub, missing } = await load(m.email);
  if (missing) return NextResponse.json({ ok: true, ready: false });
  if (!sub) return NextResponse.json({ ok: false, message: "No active membership." }, { status: 404 });
  if (action === "dismiss") {
    await supabaseAdmin.from("subscribers").update({ inbox_pending: null }).eq("id", sub.id);
    return NextResponse.json(view({ ...sub, inbox_pending: null }));
  }
  if (action === "create" || action === "rotate") {
    if (action === "create" && sub.bill_inbox) return NextResponse.json(view(sub));
    const first = String(sub.customer_name ?? "").trim().split(/\s+/)[0] || null;
    // A fresh random address; try again on the (very unlikely) chance it's taken.
    for (let i = 0; i < 5; i++) {
      const local = newInboxLocal(first);
      const { error } = await supabaseAdmin.from("subscribers").update({ bill_inbox: local, inbox_last_status: null, inbox_gmail_code: null, inbox_gmail_link: null }).eq("id", sub.id);
      if (!error) return NextResponse.json(view({ ...sub, bill_inbox: local, inbox_last_status: null }));
      if (!/duplicate|unique/i.test(error.message)) return NextResponse.json({ ok: false, message: "Couldn't make your address. Try again." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
}

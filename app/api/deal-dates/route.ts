import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// A member sets (or clears) when their discount / benefit period and fixed
// price end, so the daily job can warn them a month before.
// Body: { discountEndsAt: "YYYY-MM-DD" | null, fixedUntil: "YYYY-MM-DD" | null }
const date = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not available yet." });
  const b = await req.json().catch(() => null);
  const discountEndsAt = date(b?.discountEndsAt);
  const fixedUntil = date(b?.fixedUntil);

  const { data: sub } = await supabaseAdmin
    .from("subscribers")
    .select("id")
    .eq("email", member.email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return NextResponse.json({ ok: false, message: "No active membership found." });

  const { error } = await supabaseAdmin
    .from("subscribers")
    .update({
      discount_ends_at: discountEndsAt,
      current_price_fixed_until: fixedUntil,
      ...(fixedUntil ? { current_price_type: "fixed" } : {}),
      // New dates mean a new warning is due.
      deal_alert_sent_for: null,
    })
    .eq("id", sub.id);
  if (error) {
    const missing = /column|schema cache/i.test(error.message);
    return NextResponse.json({ ok: false, message: missing ? "Run supabase/schema.sql in Supabase to switch this on." : "Couldn't save that. Try again." });
  }
  return NextResponse.json({ ok: true, discountEndsAt, fixedUntil });
}

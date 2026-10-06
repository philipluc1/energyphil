import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// A member tells us whether they really switched, and when. Savings are only
// counted from that date. { switched: true, date?: "YYYY-MM-DD" } or { switched: false }.
export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not available yet." });
  const b = await req.json().catch(() => null);
  const switched = b?.switched === true;
  let when: string | null = null;
  if (switched) {
    const d = typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? new Date(b.date + "T00:00:00") : new Date();
    if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000) {
      return NextResponse.json({ ok: false, message: "That date doesn't look right." });
    }
    when = d.toISOString();
  }
  const { data: sub } = await supabaseAdmin
    .from("subscribers")
    .select("id, baseline_retailer, baseline_plan_name")
    .eq("email", member.email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return NextResponse.json({ ok: false, message: "No active membership found." });
  const switchedTo = switched && sub.baseline_retailer ? `${sub.baseline_retailer} — ${sub.baseline_plan_name ?? ""}`.trim() : null;
  const { error } = await supabaseAdmin.from("subscribers").update({ switched_at: when, switched_to: switchedTo }).eq("id", sub.id);
  if (error) return NextResponse.json({ ok: false, message: "Couldn't save that. Try again." });
  return NextResponse.json({ ok: true, switched_at: when, switched_to: switchedTo });
}

import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { billRowFrom } from "@/lib/billRows";

// The bill tracker's writes (reads go straight to the table under RLS).
// POST adds a bill (a photo read, or one typed in for a missed month) to the
// tracker only: it never changes the usage we price the member's plans on.
// DELETE removes one of their own bills.

export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not available yet." });
  const b = await req.json().catch(() => null);
  const rows = billRowFrom(b, member.email);
  if (!rows.length) return NextResponse.json({ ok: false, message: "We need the bill's end date, the days it covers, and the amount or usage." }, { status: 400 });
  const { error } = await supabaseAdmin.from("bills").upsert(rows, { onConflict: "email,fuel,period_end" });
  if (error) {
    const missing = /relation|schema cache|does not exist/i.test(error.message);
    return NextResponse.json({ ok: false, message: missing ? "Run supabase/schema.sql in Supabase to switch on the bill tracker." : "Couldn't save that bill. Try again." });
  }
  return NextResponse.json({ ok: true, saved: rows.length });
}

export async function DELETE(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not available yet." });
  const b = await req.json().catch(() => null);
  const id = typeof b?.id === "string" && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : null;
  if (!id) return NextResponse.json({ ok: false, message: "Which bill?" }, { status: 400 });
  const { error } = await supabaseAdmin.from("bills").delete().eq("id", id).eq("email", member.email);
  if (error) return NextResponse.json({ ok: false, message: "Couldn't remove that bill." });
  return NextResponse.json({ ok: true });
}

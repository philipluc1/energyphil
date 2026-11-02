import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { emailConfigured } from "@/lib/email";
import { cleanNote, cleanRemindDate, remindDayLabel } from "@/lib/switchReminder";
import { sameRetailer } from "@/lib/sameRetailer";

// "Remind me" by email (2 Nov 2026). POST { date, retailer, plan, savingYear }
// sets one reminder (replacing any earlier one); DELETE clears it. The morning
// job (recheck-prices) sends it on the day. Members only.

async function memberRow(email: string) {
  return supabaseAdmin!.from("subscribers").select("id, current_retailer").eq("email", email).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
}

export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!emailConfigured) return NextResponse.json({ ok: false, message: "Email isn't set up on the server yet. Use a calendar for now." });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = cleanRemindDate(b?.date);
  if (!date) return NextResponse.json({ ok: false, message: "Pick a day from today to four months out." }, { status: 400 });
  const { data: row, error } = await memberRow(member.email);
  if (error || !row) return NextResponse.json({ ok: false, message: "Couldn't find your membership." });
  const r = row as { id: string; current_retailer: string | null };
  const note = cleanNote({ retailer: b?.retailer, plan: b?.plan, savingYear: b?.savingYear, same: sameRetailer(r.current_retailer, typeof b?.retailer === "string" ? b.retailer : null) });
  if (!note) return NextResponse.json({ ok: false, message: "Something's missing. Refresh the page and try again." }, { status: 400 });
  const { error: upErr } = await supabaseAdmin!.from("subscribers").update({ switch_remind_on: date, switch_remind_note: note }).eq("id", r.id);
  if (upErr) {
    const missing = /column|schema cache/i.test(upErr.message ?? "");
    return NextResponse.json({ ok: false, message: missing ? "Email reminders aren't switched on yet. Use a calendar for now." : "Couldn't save that just now. Try again in a minute." });
  }
  return NextResponse.json({ ok: true, date, message: `Done. We'll email ${member.email} on ${remindDayLabel(date)}, first thing in the morning.` });
}

export async function DELETE(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  const { data: row } = await memberRow(member.email);
  if (!row) return NextResponse.json({ ok: false, message: "Couldn't find your membership." });
  await supabaseAdmin!.from("subscribers").update({ switch_remind_on: null, switch_remind_note: null }).eq("id", (row as { id: string }).id);
  return NextResponse.json({ ok: true, message: "Email reminder cancelled." });
}

import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyBillForMember } from "@/lib/applyBill";

// After a member's bill has been read, store its figures on their membership
// (so the monthly checks use real numbers) and record this month's check.
// The work is in lib/applyBill.ts, shared with forwarded bills (5 Nov 2026).
export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not available yet." });
  const b = await req.json().catch(() => null);
  return NextResponse.json(await applyBillForMember(member.email, b));
}

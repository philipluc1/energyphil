import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Saves this month's check to a member's dashboard. Members only.
export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not available yet." }, { status: 200 });

  const b = await req.json().catch(() => null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const billingDays = num(b?.billingDays);
  const referenceTotal = num(b?.referenceTotal);
  const bestTotal = num(b?.bestTotal);
  const source = b?.source === "bill" ? "bill" : "manual";
  if (!billingDays || billingDays < 1 || billingDays > 366 || referenceTotal === null || bestTotal === null) {
    return NextResponse.json({ ok: false, message: "That check is missing details." }, { status: 400 });
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const { error } = await supabaseAdmin.from("bill_checks").upsert(
    {
      email: member.email,
      month,
      source,
      billing_days: Math.round(billingDays),
      reference_total: referenceTotal,
      best_total: bestTotal,
      best_retailer: typeof b?.bestRetailer === "string" ? b.bestRetailer.slice(0, 80) : null,
      best_plan_name: typeof b?.bestPlanName === "string" ? b.bestPlanName.slice(0, 120) : null,
      saving: referenceTotal - bestTotal,
    },
    { onConflict: "email,month,source" },
  );
  if (error) {
    console.error("save-check failed", error);
    return NextResponse.json({ ok: false, message: "Couldn't save that — please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

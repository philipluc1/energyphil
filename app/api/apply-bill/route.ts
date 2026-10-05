import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DISTRIBUTORS, rankPlans, type Distributor, type UsageInput } from "@/lib/plans";
import { vdoBillForUsage } from "@/lib/profileUsage";

// After a member's bill has been read, store its figures on their membership
// (so the monthly checks use real numbers) and record this month's check.
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not available yet." });

  const b = await req.json().catch(() => null);
  const distributor = DISTRIBUTORS.includes(b?.distributor) ? (b.distributor as Distributor) : null;
  const days = num(b?.billingDays);
  if (!distributor || !days || days < 1 || days > 366) {
    return NextResponse.json({ ok: false, message: "We couldn't read your network or billing days. Check them on the Check page." });
  }
  const detailed = b?.usageMode === "detailed";
  const usage: UsageInput = {
    days,
    peak: detailed ? num(b?.peakKwh) ?? 0 : 0,
    shoulder: detailed ? num(b?.shoulderKwh) ?? 0 : 0,
    offpeak: detailed ? num(b?.offpeakKwh) ?? 0 : 0,
    anytime: detailed ? 0 : num(b?.anytimeKwh) ?? 0,
    cl: num(b?.controlledLoadKwh) ?? 0,
    solarExportKwh: b?.hasSolar ? num(b?.solarExportKwh) ?? 0 : 0,
  };
  const total = usage.peak + usage.shoulder + usage.offpeak + usage.anytime;
  if (total <= 0) return NextResponse.json({ ok: false, message: "We couldn't find your usage on that bill." });

  const top = rankPlans(distributor, usage)[0];
  if (!top) return NextResponse.json({ ok: false, message: "No comparable plans for that bill." });
  const currentBill = num(b?.currentBill);
  const reference = currentBill ?? vdoBillForUsage(distributor, usage);

  const { data: sub } = await supabaseAdmin
    .from("subscribers")
    .select("id")
    .eq("email", member.email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sub) {
    const { error } = await supabaseAdmin
      .from("subscribers")
      .update({
        distributor,
        billing_days: Math.round(days),
        usage_mode: detailed ? "detailed" : "simple",
        peak_kwh: usage.peak,
        shoulder_kwh: usage.shoulder,
        offpeak_kwh: usage.offpeak,
        anytime_kwh: usage.anytime,
        controlled_load_kwh: usage.cl,
        has_solar: Boolean(b?.hasSolar),
        solar_export_kwh: usage.solarExportKwh,
        reference_total: reference,
        baseline_total: top.total,
        baseline_retailer: top.plan[0],
        baseline_plan_name: top.plan[2],
        customer_name: str(b?.customerName, 120),
        address: str(b?.address, 160),
        suburb: str(b?.suburb, 80),
        postcode: str(b?.postcode, 4),
      })
      .eq("id", sub.id);
    if (error) console.error("apply-bill: update failed", error);
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  await supabaseAdmin.from("bill_checks").upsert(
    {
      email: member.email,
      month,
      source: "bill",
      billing_days: Math.round(days),
      reference_total: reference,
      best_total: top.total,
      best_retailer: top.plan[0],
      best_plan_name: top.plan[2],
      saving: reference - top.total,
    },
    { onConflict: "email,month,source" },
  );

  return NextResponse.json({
    ok: true,
    retailer: top.plan[0],
    plan: top.plan[2],
    bestTotal: top.total,
    reference,
    saving: reference - top.total,
    usedCurrentBill: currentBill !== null,
  });
}

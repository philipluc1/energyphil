import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DISTRIBUTORS, rankPlans, type Distributor, type UsageInput } from "@/lib/plans";
import { vdoBillForUsage } from "@/lib/profileUsage";
import { GAS_ZONES, gasBenchmark, rankGasPlans, type GasZone } from "@/lib/gasPlans";

// After a member's bill has been read, store its figures on their membership
// (so the monthly checks use real numbers) and record this month's check.
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not available yet." });

  const b = await req.json().catch(() => null);
  const memberEmail = member.email;

  // Gas, when the bill has it (gas-only or dual). Saved on the membership and
  // priced against the gas plans we hold. Victoria has no gas default offer,
  // so the reference is the gas charges on the bill itself.
  async function applyGas(): Promise<{ retailer: string; plan: string; saving: number } | null> {
    const zone = GAS_ZONES.includes(b?.gasDistributor) ? (b.gasDistributor as GasZone) : null;
    const gDays = num(b?.gasBillingDays) ?? num(b?.billingDays);
    const mj = num(b?.gasMj);
    const gTotal = num(b?.gasBillTotal);
    if (!zone || !gDays || !mj) return null;
    const ranked = rankGasPlans(zone, { days: gDays, mj });
    const best = ranked[0] ?? null;
    const bench = gasBenchmark(zone, { days: gDays, mj }, gTotal);
    const { data: subG } = await supabaseAdmin!
      .from("subscribers").select("id").eq("email", memberEmail).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (subG) {
      await supabaseAdmin!.from("subscribers").update({
        gas_zone: zone,
        gas_billing_days: Math.round(gDays),
        gas_mj: mj,
        gas_reference_total: gTotal,
        gas_current_plan_name: str(b?.gasPlanName, 120),
        gas_best_retailer: best ? best.plan[0] : null,
        gas_best_plan_name: best ? best.plan[2] : null,
        gas_best_total: best ? best.total : null,
        gas_updated_at: new Date().toISOString(),
      }).eq("id", subG.id);
    }
    if (!best || !bench) return null;
    return { retailer: best.plan[0], plan: best.plan[2], saving: bench.value - best.total };
  }

  if (b?.fuel === "gas") {
    const gas = await applyGas();
    if (!gas) {
      return NextResponse.json({
        ok: true, fuel: "gas", retailer: "", plan: "", saving: 0, usedCurrentBill: true,
        message: "Saved your gas details. Gas plan comparison switches on once our gas price data is loaded.",
      });
    }
    return NextResponse.json({ ok: true, fuel: "gas", retailer: gas.retailer, plan: gas.plan, saving: gas.saving, usedCurrentBill: num(b?.gasBillTotal) !== null });
  }
  const gasResult = b?.fuel === "dual" ? await applyGas() : null;

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
        nmi: str(b?.nmi, 11),
        current_retailer: str(b?.retailerName, 80),
        current_plan_name: str(b?.planName, 120),
        tariff_type: str(b?.tariffType, 20),
        customer_name: str(b?.customerName, 120),
        address: str(b?.address, 160),
        suburb: str(b?.suburb, 80),
        postcode: str(b?.postcode, 4),
      })
      .eq("id", sub.id);
    if (error) console.error("apply-bill: update failed", error);
    // Current plan pricing, saved separately so a database that hasn't had
    // the newest columns added yet still takes the update above.
    const pt = b?.priceType === "fixed" || b?.priceType === "variable" ? b.priceType : null;
    const { error: ratesErr } = await supabaseAdmin
      .from("subscribers")
      .update({
        current_rates: cleanRates(b?.currentRates),
        current_price_type: pt,
        current_price_fixed_until: typeof b?.priceFixedUntil === "string" ? b.priceFixedUntil.slice(0, 10) : null,
      })
      .eq("id", sub.id);
    if (ratesErr) console.warn("apply-bill: pricing columns not saved (run supabase/schema.sql)", ratesErr.message);
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
    fuel: gasResult ? "dual" : "electricity",
    gas: gasResult,
    retailer: top.plan[0],
    plan: top.plan[2],
    bestTotal: top.total,
    reference,
    saving: reference - top.total,
    usedCurrentBill: currentBill !== null,
  });
}

/** Client-sent rates are untrusted: keep only the known keys, as plausible numbers. */
function cleanRates(v: unknown): Record<string, number | null> | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const out: Record<string, number | null> = {};
  let any = false;
  for (const k of ["supply", "anytime", "peak", "shoulder", "offpeak", "cl", "solarFit"]) {
    const n = typeof r[k] === "number" && Number.isFinite(r[k]) && (r[k] as number) > 0 && (r[k] as number) < 6 ? (r[k] as number) : null;
    out[k] = n;
    if (n !== null) any = true;
  }
  return any ? out : null;
}

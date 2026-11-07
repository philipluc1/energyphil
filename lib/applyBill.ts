import "server-only";
import { costFromRates } from "./currentRates";
import { billCheckFromBill, forStorage } from "./billCheck";
import { gasChargesForComparison, type CurrentRates } from "./billExtraction";
import { supabaseAdmin } from "./supabaseAdmin";
import { billRowFrom } from "./billRows";
import { DISTRIBUTORS, bestPlan, type Distributor, type UsageInput } from "./plans";
import { vdoBillForUsage } from "./profileUsage";
import { GAS_ZONES, bestGasPlan, gasBenchmark, type GasZone } from "./gasPlans";
import fs from "node:fs";
import path from "node:path";
import { sendEmail } from "./email";
import { firstNameOf } from "./emailParts";
import { firstCheckEmail, type FirstCheckFuel } from "./emailTemplates";
import { inboxAddress } from "./billInbox";
import { REELS } from "./reels";
import { SITE_URL } from "./site";
import { WORTH_SWITCHING_PER_YEAR } from "./dataPolicy";

// After a member's bill has been read, store its figures on their membership
// (so the monthly checks use real numbers) and record this month's check.
// 5 Nov 2026: shared by the dashboard upload (app/api/apply-bill) and forwarded bills (app/api/inbound-bill).
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reply = (x: Record<string, any>) => x;

/** A forwarded bill waiting for a check is done once any bill is saved (5 Nov 2026). Never blocks. */
async function clearInboxPending(email: string) {
  const { error } = await supabaseAdmin!.from("subscribers").update({ inbox_pending: null }).eq("email", email).eq("status", "active");
  if (error && !/inbox_pending/.test(error.message)) console.warn("applyBill: inbox_pending not cleared", error.message);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyBillForMember(memberEmail: string, b: any): Promise<Record<string, any>> {
  if (!supabaseAdmin) return { ok: false, message: "Not available yet." };

  // Keep the bill in the tracker too (electricity and/or gas). Never blocks
  // the rest: a database without the bills table yet just skips it.
  {
    const rows = billRowFrom(b, memberEmail, new Date().toISOString().slice(0, 10));
    if (rows.length) {
      const { error: tErr } = await supabaseAdmin.from("bills").upsert(rows, { onConflict: "email,fuel,period_end" });
      if (tErr) console.warn("apply-bill: bill tracker not saved (run supabase/schema.sql)", tErr.message);
    }
  }

  // Gas, when the bill has it (gas-only or dual). Saved on the membership and
  // priced against the gas plans we hold. Victoria has no gas default offer,
  // so the reference is the gas charges on the bill itself.
  async function applyGas(): Promise<{ retailer: string; plan: string; saving: number; nowYear: number; bestYear: number; currentRetailer: string | null } | null> {
    const zone = GAS_ZONES.includes(b?.gasDistributor) ? (b.gasDistributor as GasZone) : null;
    const gDays = num(b?.gasBillingDays) ?? num(b?.billingDays);
    const mj = num(b?.gasMj);
    // 7 Nov 2026: rates × usage when the bill shows its rates, so a credit or
    // true-up on the bill can't make a dear plan look cheap.
    const gTotal = gasChargesForComparison({ gasBillTotal: num(b?.gasBillTotal), gasMj: mj, gasBillingDays: gDays, billingDays: gDays, gasSupplyCentsPerDay: num(b?.gasSupplyCentsPerDay), gasUsageCentsPerMj: num(b?.gasUsageCentsPerMj) }).total;
    if (!zone || !gDays || !mj) return null;
    const best = bestGasPlan(zone, { days: gDays, mj }) ?? null;
    const bench = gasBenchmark(zone, { days: gDays, mj }, gTotal);
    const { data: subG } = await supabaseAdmin!
      .from("subscribers").select("id").eq("email", memberEmail).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (subG) {
      // If the database hasn't got the newer gas_current_retailer column yet
      // (schema.sql not re-run), save everything else rather than nothing.
      const gasRow: Record<string, unknown> = {
        gas_zone: zone,
        gas_billing_days: Math.round(gDays),
        gas_mj: mj,
        gas_reference_total: gTotal,
        gas_current_plan_name: str(b?.gasPlanName, 120),
        // 6 Nov 2026: the bill reader calls it retailerName (it was read as b.retailer, so it was never saved).
        gas_current_retailer: str(b?.retailerName ?? b?.retailer, 80),
        gas_best_retailer: best ? best.plan[0] : null,
        gas_best_plan_name: best ? best.plan[2] : null,
        gas_best_total: best ? best.total : null,
        gas_updated_at: new Date().toISOString(),
        // 7 Nov 2026: the rates off the bill (cents), for the gas rates table on the dashboard.
        gas_rates: num(b?.gasSupplyCentsPerDay) || num(b?.gasUsageCentsPerMj)
          ? { supply: num(b?.gasSupplyCentsPerDay), usage: num(b?.gasUsageCentsPerMj) }
          : null,
      };
      let { error: gErr } = await supabaseAdmin!.from("subscribers").update(gasRow).eq("id", subG.id);
      if (gErr && /gas_rates/.test(gErr.message)) {
        console.error("applyBill: subscribers.gas_rates is missing, the gas rates were dropped. Run supabase/schema.sql.");
        delete gasRow.gas_rates;
        ({ error: gErr } = await supabaseAdmin!.from("subscribers").update(gasRow).eq("id", subG.id));
      }
      if (gErr && /gas_current_retailer/.test(gErr.message)) {
        console.error("applyBill: subscribers.gas_current_retailer is missing, the gas retailer was dropped. Run supabase/schema.sql.");
        delete gasRow.gas_current_retailer;
        ({ error: gErr } = await supabaseAdmin!.from("subscribers").update(gasRow).eq("id", subG.id));
      }
      if (gErr) console.error("applyBill: gas update failed", gErr.message);
    }
    if (!best || !bench) return null;
    return { retailer: best.plan[0], plan: best.plan[2], saving: bench.value - best.total, nowYear: (bench.value * 365) / gDays, bestYear: (best.total * 365) / gDays, currentRetailer: str(b?.retailerName, 80) };
  }

  if (b?.fuel === "gas") {
    const gas = await applyGas();
    if (!gas) {
      await clearInboxPending(memberEmail);

      return reply({
        ok: true, fuel: "gas", retailer: "", plan: "", saving: 0, usedCurrentBill: true,
        message: "Saved your gas details. Gas plan comparison switches on once our gas price data is loaded.",
      });
    }
    await clearInboxPending(memberEmail);
    const firstCheck = await maybeSendFirstCheck(memberEmail, { elec: null, gas: { retailer: gas.retailer, planName: gas.plan, nowYear: gas.nowYear, bestYear: gas.bestYear, currentRetailer: gas.currentRetailer } });

    return reply({ ok: true, fuel: "gas", retailer: gas.retailer, plan: gas.plan, saving: gas.saving, usedCurrentBill: num(b?.gasBillTotal) !== null, firstCheck });
  }
  const gasResult = b?.fuel === "dual" ? await applyGas() : null;

  const distributor = DISTRIBUTORS.includes(b?.distributor) ? (b.distributor as Distributor) : null;
  const days = num(b?.billingDays);
  if (!distributor || !days || days < 1 || days > 366) {
    return reply({ ok: false, message: "We couldn't read your network or billing days. Check them on the Check page." });
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
  if (total <= 0) return reply({ ok: false, message: "We couldn't find your usage on that bill." });

  const { data: sub } = await supabaseAdmin
    .from("subscribers")
    .select("id, home_profile")
    .eq("email", memberEmail)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // EV-only plans count only for members who told us they charge an EV.
  const ev = !!sub?.home_profile && (sub.home_profile as { ev?: unknown }).ev === true;
  const top = bestPlan(distributor, usage, { ev, currentRetailer: typeof b?.retailerName === "string" ? b.retailerName : null });
  if (!top) return reply({ ok: false, message: "No comparable plans for that bill." });
  const currentBill = num(b?.currentBill);
  // What they pay now: the bill total, or their own plan priced from the
  // rates on the bill. Never the default offer (that isn't their bill).
  const fromRates = costFromRates(cleanRates(b?.currentRates) as CurrentRates | null, usage);
  const ownTotal = currentBill ?? (fromRates.ok ? Math.round(fromRates.total * 100) / 100 : null);
  const reference = ownTotal ?? vdoBillForUsage(distributor, usage);

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
        ...(ownTotal !== null ? { reference_total: ownTotal } : {}),
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
        current_price_fixed_until: isoDate(b?.priceFixedUntil),
        discount_ends_at: isoDate(b?.discountEndsAt),
      })
      .eq("id", sub.id);
    if (ratesErr) console.warn("apply-bill: pricing columns not saved (run supabase/schema.sql)", ratesErr.message);
    const { error: checkErr } = await supabaseAdmin
      .from("subscribers")
      .update({ bill_check: forStorage(billCheckFromBill(b ?? {})) })
      .eq("id", sub.id);
    if (checkErr) console.warn("apply-bill: bill_check not saved (run supabase/schema.sql)", checkErr.message);
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  await supabaseAdmin.from("bill_checks").upsert(
    {
      email: memberEmail,
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

  await clearInboxPending(memberEmail);
  const firstCheck = await maybeSendFirstCheck(memberEmail, {
    elec: { retailer: top.plan[0], planName: top.plan[2], nowYear: (reference * 365) / days, bestYear: (top.total * 365) / days, currentRetailer: str(b?.retailerName, 80) },
    gas: gasResult ? { retailer: gasResult.retailer, planName: gasResult.plan, nowYear: gasResult.nowYear, bestYear: gasResult.bestYear, currentRetailer: gasResult.currentRetailer } : null,
  });

  return reply({
    ok: true,
    fuel: gasResult ? "dual" : "electricity",
    gas: gasResult,
    firstCheck,
    retailer: top.plan[0],
    plan: top.plan[2],
    bestTotal: top.total,
    reference,
    saving: reference - top.total,
    savingPerYear: ((reference - top.total) * 365) / days,
    usedCurrentBill: ownTotal !== null,
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

/** A YYYY-MM-DD date from the client, or null. */
function isoDate(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/**
 * The one-off "first check" email (8 Nov 2026): the first time a member's
 * bill is read, their result plus what Plus does from here and how to keep
 * the bills coming. Sent once per membership (`first_check_emailed_at`);
 * returns true when it went, so the forwarding reply can stand down.
 */
async function maybeSendFirstCheck(memberEmail: string, r: { elec: FirstCheckFuel | null; gas: FirstCheckFuel | null }): Promise<boolean> {
  if (!supabaseAdmin || (!r.elec && !r.gas)) return false;
  const { data: sub, error } = await supabaseAdmin
    .from("subscribers")
    .select("id, customer_name, first_check_emailed_at, alert_min_saving, bill_inbox, unsubscribed")
    .eq("email", memberEmail).eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (/first_check_emailed_at/.test(error.message)) console.error("applyBill: subscribers.first_check_emailed_at is missing, no first-check email. Run supabase/schema.sql.");
    else console.error("applyBill: first check lookup failed", error.message);
    return false;
  }
  if (!sub || sub.first_check_emailed_at || sub.unsubscribed) return false;
  // Claim it first, so two reads in quick succession can't both send.
  const { data: claimed } = await supabaseAdmin.from("subscribers").update({ first_check_emailed_at: new Date().toISOString() }).eq("id", sub.id).is("first_check_emailed_at", null).select("id");
  if (!claimed || !claimed.length) return false;
  const reelPath = path.join(process.cwd(), "public", REELS[0].src);
  const e = firstCheckEmail({
    origin: SITE_URL,
    name: firstNameOf(sub.customer_name),
    elec: r.elec,
    gas: r.gas,
    alertMin: typeof sub.alert_min_saving === "number" && sub.alert_min_saving > 0 ? sub.alert_min_saving : WORTH_SWITCHING_PER_YEAR,
    inboxAddress: sub.bill_inbox ? inboxAddress(sub.bill_inbox) : null,
    reelUrl: fs.existsSync(reelPath) ? `${SITE_URL}/learn#watch` : null,
    unsubscribeUrl: `${SITE_URL}/api/unsubscribe?type=subscriber&id=${sub.id}`,
  });
  const sent = await sendEmail({ to: memberEmail, subject: e.subject, title: e.title, html: e.html }).catch((err) => { console.error("applyBill: first check email failed", err); return false; });
  if (!sent) console.warn("applyBill: first check email not sent for", sub.id);
  return true;
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail, emailConfigured, sendHealthEmail, esc } from "@/lib/email";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import { computeBest, fmtCurrency } from "@/lib/priceWatch";
import type { Distributor } from "@/lib/plans";
import { rejectUnlessCron } from "@/lib/cronAuth";

// Runs on the 1st of each month (see vercel.json). For every active member it
// re-prices their saved profile against current plan data, records that
// month's check on My Dashboard, and emails a short summary. The summary is
// sent even when nothing changed, so members see the service is working.
export const maxDuration = 60;

interface Row {
  home_profile?: unknown;
  id: string;
  email: string;
  distributor: string | null;
  billing_days: number | null;
  peak_kwh: number | null;
  shoulder_kwh: number | null;
  offpeak_kwh: number | null;
  anytime_kwh: number | null;
  controlled_load_kwh: number | null;
  solar_export_kwh: number | null;
  reference_total: number | null;
  baseline_total: number | null;
  unsubscribed: boolean | null;
}

export async function GET(req: NextRequest) {
  const denied = rejectUnlessCron(req);
  if (denied) return denied;
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Supabase not configured." });

  const origin = process.env.SITE_URL || req.nextUrl.origin;
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .select(
      "id, email, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, solar_export_kwh, reference_total, baseline_total, unsubscribed, home_profile",
    )
    .eq("status", "active")
    .not("distributor", "is", null);
  if (error) {
    console.error("monthly-check: load failed", error);
    return NextResponse.json({ ok: false, message: "Couldn't load members." }, { status: 500 });
  }

  let saved = 0;
  let emailed = 0;
  let errors = 0;
  for (const sub of (data ?? []) as Row[]) {
    try {
      const days = sub.billing_days ?? 91;
      const best = computeBest({
        distributor: sub.distributor as Distributor,
        billingDays: days,
        peak: sub.peak_kwh ?? 0,
        shoulder: sub.shoulder_kwh ?? 0,
        offpeak: sub.offpeak_kwh ?? 0,
        anytime: sub.anytime_kwh ?? 0,
        cl: sub.controlled_load_kwh ?? 0,
        solarExportKwh: sub.solar_export_kwh ?? 0,
        ev: hasEv(sub.home_profile),
      });
      const reference = sub.reference_total ?? sub.baseline_total;
      if (!best || reference === null) continue;

      const saving = reference - best.bestTotal;
      const { error: upErr } = await supabaseAdmin.from("bill_checks").upsert(
        {
          email: sub.email,
          month,
          source: "auto",
          billing_days: days,
          reference_total: reference,
          best_total: best.bestTotal,
          best_retailer: best.bestRetailer,
          best_plan_name: best.bestPlanName,
          saving,
        },
        { onConflict: "email,month,source" },
      );
      if (upErr) throw upErr;
      saved++;

      if (emailConfigured && !sub.unsubscribed) {
        const monthName = now.toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
        const ok = await sendEmail({
          to: sub.email,
          // 1 July is when Victorian retailers usually reprice: say so.
          subject: now.getUTCMonth() === 6 ? "Prices changed on 1 July: your re-check" : `Your ${monthName} electricity check`,
          cta: { label: "Open My Dashboard", url: `${origin}/account#compare` },
          html: `
            <p>${now.getUTCMonth() === 6 ? "Retailers changed their prices on 1 July, so we've re-checked your plan against the new ones." : "We re-checked your plan against today's prices."}</p>
            <p style="margin:0 0 12px;padding:10px 12px;background:#fff7e0;border-radius:8px;">Switched recently? <a href="${origin}/account">Tell us the date on your dashboard</a> so your savings count from the right day.</p>
            <p style="font-size:18px;font-weight:700;margin:16px 0 4px;">Cheapest for you: ${esc(best.bestRetailer)} (${esc(best.bestPlanName)})</p>
            <p style="margin:0 0 16px;">${
              (saving * 365) / days >= WORTH_SWITCHING_PER_YEAR
                ? `Switching could save you about <strong>${fmtCurrency((saving * 365) / days)} a year</strong> compared with your last bill.`
                : "Nothing beats your plan by enough to bother (at least $" + WORTH_SWITCHING_PER_YEAR + " a year). We'll keep watching."
            }</p>
            <p><a href="${origin}/account#compare">See every plan on your dashboard</a></p>
            <p style="margin-top:24px;font-size:12px;color:#888;"><a href="${origin}/api/unsubscribe?type=subscriber&id=${sub.id}">Unsubscribe from these emails</a>. This won't cancel your plan.</p>`,
        });
        if (ok) emailed++;
      }
    } catch (err) {
      console.error("monthly-check: member failed", sub.id, err);
      errors++;
    }
  }
  await sendHealthEmail("monthly check", { "checks saved": saved, "summaries emailed": emailed, errors });
  return NextResponse.json({ ok: true, saved, emailed, errors });
}

/** True when the saved home answers say they charge an EV at home. */
function hasEv(profile: unknown): boolean {
  return !!profile && typeof profile === "object" && (profile as { ev?: unknown }).ev === true;
}

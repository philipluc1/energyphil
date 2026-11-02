import { resultEmail } from "@/lib/emailTemplates";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DISTRIBUTORS, computeBill, rankPlans, topOpen, type Distributor } from "@/lib/plans";
import { currentPricer, forecastYear } from "@/lib/homeInsights";
import { marketActivity } from "@/lib/marketActivity";
import { MONTH_NAMES, type HomeProfile } from "@/lib/profileUsage";
import { usageOrAverage, vdoBillForUsage } from "@/lib/profileUsage";
import { emailConfigured, sendEmail } from "@/lib/email";
import { SRC_COOKIE, sourceValue } from "@/lib/attribution";

// Saves a free check ("email me this result"). Written by the server only:
// the browser can't insert into `leads` directly, so nobody can plant rows
// (or HTML) that our emails would later send. The result is worked out here
// from the usage, never trusted from the browser.
const num = (v: unknown, max: number): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
};
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const EMAIL = /^[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[a-z]{2,}$/i;

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Saving isn't switched on yet." }, { status: 503 });
  const b = await req.json().catch(() => null);
  const email = str(b?.email, 200)?.toLowerCase() ?? "";
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, message: "Please check your email address." }, { status: 400 });
  const distributor = DISTRIBUTORS.includes(b?.distributor) ? (b.distributor as Distributor) : null;
  const days = Math.round(num(b?.days, 366));
  if (!distributor || days < 1) return NextResponse.json({ ok: false, message: "Missing your network or bill length." }, { status: 400 });

  // A few saves per address per hour is plenty; more looks like abuse.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if ((count ?? 0) >= 5) return NextResponse.json({ ok: false, message: "We've already saved this. Check your inbox." }, { status: 429 });

  const hasSolar = b?.hasSolar === true;
  // Not enough usage sent? Use the average Victorian home, as the page does.
  const { usage, average } = usageOrAverage({
    days,
    peak: num(b?.peak, 100000),
    shoulder: num(b?.shoulder, 100000),
    offpeak: num(b?.offpeak, 100000),
    anytime: num(b?.anytime, 100000),
    cl: num(b?.cl, 100000),
    solarExportKwh: hasSolar ? num(b?.solarExportKwh, 100000) : 0,
  });
  const profile = b?.homeProfile && typeof b.homeProfile === "object" ? b.homeProfile : null;
  const ev = (profile as { ev?: unknown } | null)?.ev === true;
  // Ranked the same way as the results page (their retailer counts for "existing customers" offers).
  const currentRetailer = str(b?.currentRetailer, 80);
  const ranked = rankPlans(distributor, usage, { ev, hasSolar, currentRetailer });
  const top = topOpen(ranked) ?? null;
  const bill = num(b?.currentBill, 20000);
  const bench = bill > 0 && !average ? bill : vdoBillForUsage(distributor, usage);
  const save = top ? bench - top.total : null;

  const row = {
    email,
    distributor,
    billing_days: days,
    usage_mode: b?.usageMode === "simple" ? "simple" : "detailed",
    peak_kwh: usage.peak,
    shoulder_kwh: usage.shoulder,
    offpeak_kwh: usage.offpeak,
    anytime_kwh: usage.anytime,
    controlled_load_kwh: usage.cl,
    current_bill: bill > 0 ? bill : null,
    best_retailer: top?.plan[0] ?? null,
    best_plan_name: top?.plan[2] ?? null,
    best_total: top?.total ?? null,
    estimated_saving: save,
    estimated_saving_pct: save !== null && bench > 0 ? save / bench : null,
    wants_price_alerts: b?.wantsAlerts === true,
    customer_name: str(b?.customerName, 120),
    address: str(b?.address, 200),
    suburb: str(b?.suburb, 80),
    postcode: /^\d{4}$/.test(String(b?.postcode ?? "")) ? String(b.postcode) : null,
    has_solar: hasSolar,
    solar_export_kwh: hasSolar ? usage.solarExportKwh : null,
    home_profile: profile,
  };
  // Where they came from (partner, referral or campaign), if we know.
  const source = sourceValue(req.cookies.get(SRC_COOKIE)?.value);
  const withSource: Record<string, unknown> = source ? { ...row, source } : row;
  let { data: inserted, error } = await supabaseAdmin.from("leads").insert(withSource).select("id").single();
  // Database not upgraded yet (schema.sql not re-run): save without the source.
  if (error && source && /source|schema cache/i.test(error.message)) {
    ({ data: inserted, error } = await supabaseAdmin.from("leads").insert(row).select("id").single());
  }
  if (error) {
    console.error("lead insert failed", error.message);
    return NextResponse.json({ ok: false, message: "Couldn't save that. Please try again." }, { status: 500 });
  }
  // Send the result straight away (the follow-ups, if they opted in, come later).
  let emailed = false;
  if (emailConfigured && inserted && top) {
    const origin = process.env.SITE_URL || req.nextUrl.origin;
    const perYear = 365 / days;
    const yearly = save !== null ? save * perYear : 0;
    // The next cheapest retailers (one plan each), for the comparison bars.
    const seen = new Set<string>();
    const runnersUp = ranked
      .filter((m) => !m.restricted && (seen.has(m.plan[0]) ? false : (seen.add(m.plan[0]), true)))
      .slice(0, 4)
      .map((m) => ({ retailer: m.plan[0], year: m.total * perYear }));
    const kwh = usage.peak + usage.shoulder + usage.offpeak + usage.anytime + usage.cl;
    const market = marketActivity({ network: distributor, days: 30 });
    // The year ahead, for the dashboard preview. Never blocks the email.
    let year: { label: string; best: number; now: number }[] | undefined;
    try {
      const f = forecastYear({
        base: usage,
        profile: profile as HomeProfile | null,
        now: currentPricer({ rates: null, network: distributor, you: bench, base: usage }),
        best: (u) => computeBill(top.plan, u) ?? 0,
      });
      year = f?.months.map((m) => ({ label: MONTH_NAMES[m.month].slice(0, 1), best: m.best, now: m.now }));
    } catch { year = undefined; }
    const e = resultEmail({
      origin,
      retailer: top.plan[0],
      planName: top.plan[2],
      yearly,
      vsBill: bill > 0 && !average,
      unsubscribeUrl: `${origin}/api/unsubscribe?type=lead&id=${inserted.id}`,
      name: str(b?.customerName, 60) ?? null,
      nowYear: bench * perYear,
      bestYear: top.total * perYear,
      runnersUp,
      usageLine: average ? null : `${Math.round(kwh).toLocaleString("en-AU")} kWh over ${days} days (${(kwh / days).toFixed(1)} kWh a day)`,
      network: distributor,
      marketChanges: market.ready ? market.newOffers + market.priceChanges : 0,
      year,
      currentRetailer,
    });
    const sent = await sendEmail({ to: email, subject: e.subject, title: e.title, html: e.html }).catch(() => false);
    if (sent) await supabaseAdmin.from("leads").update({ drip_step: 1, drip_sent_at: new Date().toISOString() }).eq("id", inserted.id);
    emailed = sent;
  }
  // `emailed` lets the page say so when the email didn't go, instead of "Sent".
  return NextResponse.json({ ok: true, emailed });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DISTRIBUTORS, rankPlans, type Distributor, type UsageInput } from "@/lib/plans";
import { vdoBillForUsage } from "@/lib/profileUsage";
import { esc, emailConfigured, sendEmail } from "@/lib/email";
import { RETAILER_LINKS } from "@/lib/retailerLinks";

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
  const usage: UsageInput = {
    days,
    peak: num(b?.peak, 100000),
    shoulder: num(b?.shoulder, 100000),
    offpeak: num(b?.offpeak, 100000),
    anytime: num(b?.anytime, 100000),
    cl: num(b?.cl, 100000),
    solarExportKwh: hasSolar ? num(b?.solarExportKwh, 100000) : 0,
  };
  const profile = b?.homeProfile && typeof b.homeProfile === "object" ? b.homeProfile : null;
  const ev = (profile as { ev?: unknown } | null)?.ev === true;
  const top = rankPlans(distributor, usage, { ev })[0] ?? null;
  const bill = num(b?.currentBill, 20000);
  const bench = bill > 0 ? bill : vdoBillForUsage(distributor, usage);
  const save = top ? bench - top.total : null;

  const { data: inserted, error } = await supabaseAdmin.from("leads").insert({
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
  }).select("id").single();
  if (error) {
    console.error("lead insert failed", error.message);
    return NextResponse.json({ ok: false, message: "Couldn't save that. Please try again." }, { status: 500 });
  }
  // Send the result straight away (the follow-ups, if they opted in, come later).
  if (emailConfigured && inserted && top) {
    const origin = process.env.SITE_URL || req.nextUrl.origin;
    const yearly = save !== null ? (save * 365) / days : 0;
    const link = RETAILER_LINKS[top.plan[0]];
    const sent = await sendEmail({
      to: email,
      subject: yearly >= 50 ? `Your result: about $${Math.round(yearly)} a year` : "Your Utilo result",
      cta: { label: "See it again", url: `${origin}/check` },
      html: `
        <p>Here's your result, so it's easy to find later.</p>
        <p style="font-size:18px;font-weight:700;margin:16px 0 4px;">Cheapest for you: ${esc(top.plan[0])} (${esc(top.plan[2])})</p>
        ${yearly >= 50 ? `<p>About <strong>$${Math.round(yearly).toLocaleString("en-AU")} a year</strong> less than ${bill > 0 ? "your bill" : "the Victorian Default Offer (snap your bill for your exact saving)"}.</p>` : `<p>Nothing beats ${bill > 0 ? "your bill" : "the default offer"} by enough to bother right now.</p>`}
        ${link ? `<p><a href="${link}">Go to ${esc(top.plan[0])} →</a></p>` : ""}
        <p style="color:#666;">Switching takes about ten minutes online, your power stays on, and you can change your mind within 10 business days.</p>
        <p style="color:#888;font-size:12px;"><a href="${origin}/api/unsubscribe?type=lead&id=${inserted.id}">Unsubscribe</a></p>`,
    }).catch(() => false);
    if (sent) await supabaseAdmin.from("leads").update({ drip_step: 1, drip_sent_at: new Date().toISOString() }).eq("id", inserted.id);
  }
  return NextResponse.json({ ok: true });
}

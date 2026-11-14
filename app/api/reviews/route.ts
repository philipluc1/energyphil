import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseReviewForm } from "@/lib/testimonials";
import { emailConfigured, sendEmail } from "@/lib/email";

// The review page's form (14 Nov 2026, Phil: our own reviews, not Google).
// Saved hidden; the owner approves it on the dashboard before it shows.
// Every review is kept, good or bad; nothing is offered for one.
export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (b?.website) return NextResponse.json({ ok: true }); // a bot filled the hidden field
  const p = parseReviewForm(b);
  if (!p.ok) return NextResponse.json({ ok: false, message: p.message }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Reviews aren't open just yet. Please try again soon." }, { status: 503 });

  // At most 3 reviews an hour from one email or one network.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null;
  const recent = await supabaseAdmin.from("testimonials").select("id", { count: "exact", head: true }).gte("created_at", since).eq(p.value.email ? "email" : "ip", (p.value.email ?? ip) as string);
  if (!recent.error && (recent.count ?? 0) >= 3) return NextResponse.json({ ok: false, message: "Thanks, we've already got your review." }, { status: 429 });

  // Did they use Utilo? A member or a free check with this email: shown as such once approved.
  let source = "Utilo";
  if (p.value.email) {
    const m = await supabaseAdmin.from("subscribers").select("id").eq("email", p.value.email).limit(1);
    if (!m.error && m.data?.length) source = "Utilo member";
    else {
      const l = await supabaseAdmin.from("leads").select("id").eq("email", p.value.email).limit(1);
      if (!l.error && l.data?.length) source = "Free check";
    }
  }
  const row = { ...p.value, source, shown: false, approved_at: null, ip };
  let { error } = await supabaseAdmin.from("testimonials").insert(row);
  if (error && /column/i.test(error.message)) ({ error } = await supabaseAdmin.from("testimonials").insert({ name: row.name, place: row.place, stars: row.stars, body: row.body, source, review_date: row.review_date, shown: false }));
  if (error) {
    console.error("review not saved", error.message);
    return NextResponse.json({ ok: false, message: /does not exist|schema cache/i.test(error.message) ? "Reviews aren't open just yet. Please try again soon." : "That didn't save. Please try again." }, { status: 500 });
  }

  const owner = process.env.ADMIN_EMAIL;
  if (owner && emailConfigured) {
    const origin = req.nextUrl.origin;
    await sendEmail({
      to: owner,
      subject: `New review: ${"★".repeat(p.value.stars)} from ${p.value.name}`,
      title: "A new review is waiting",
      html: `<p><b>${esc(p.value.name)}</b>${p.value.place ? `, ${esc(p.value.place)}` : ""} (${esc(source)}) gave ${p.value.stars} out of 5:</p><blockquote style="margin:0 0 16px;padding:12px 14px;border-left:4px solid #f5a623;background:#fff8e6;">${esc(p.value.body)}</blockquote><p>Approve it on your dashboard to show it on the home page. Approve every genuine review, good or bad.</p>`,
      cta: { label: "Open the dashboard", url: `${origin}/dashboard#reviews` },
    }).catch(() => false);
  }
  return NextResponse.json({ ok: true });
}

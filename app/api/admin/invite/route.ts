import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";
import { sendEmail } from "@/lib/email";
import { leadInvite } from "@/lib/emailTemplates";
import { firstNameOf } from "@/lib/emailParts";
import { logAdmin } from "@/lib/adminMembers";
import { inviteBlock } from "@/lib/leadInvite";

// Owner dashboard (2 Nov 2026): send one personal "want us to keep watching?"
// email to a lead who got a result but didn't join. Guard rails for the Spam
// Act: never to anyone who unsubscribed, never to a member, at most one invite
// per person every 30 days, and every email carries an unsubscribe link.

type LeadRow = { id: string; created_at: string; email: string; best_retailer: string | null; best_plan_name: string | null; estimated_saving: number | null; unsubscribed: boolean | null; invite_sent_at?: string | null; customer_name?: string | null };

const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

export async function POST(req: NextRequest) {
  if (!(await dashCookieValid(req.cookies.get(DASH_COOKIE)?.value))) return fail("Please log in to the dashboard again.", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return fail("Not allowed.", 403);
  const db = supabaseAdmin;
  if (!db) return fail("The database isn't connected.", 500);

  const b = await req.json().catch(() => null);
  const email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!email) return fail("Which email?");
  const like = email.replace(/[%_\\]/g, "\\$&");

  const cols = "id, created_at, email, best_retailer, best_plan_name, estimated_saving, unsubscribed, invite_sent_at, customer_name";
  let res = await db.from("leads").select(cols).ilike("email", like).order("created_at", { ascending: false }).limit(50);
  if (res.error) return fail("Run the latest SQL first (leads.invite_sent_at), then try again.", 500);
  const leads = (res.data ?? []) as LeadRow[];
  const { data: subs } = await db.from("subscribers").select("id").ilike("email", like).limit(1);

  const block = inviteBlock(leads, (subs ?? []).length > 0, new Date());
  if (block) return fail(block);
  const latest = leads[0];

  const e = leadInvite({
    origin: process.env.SITE_URL || req.nextUrl.origin,
    retailer: latest.best_retailer,
    planName: latest.best_plan_name,
    yearly: latest.estimated_saving,
    unsubscribeUrl: `${process.env.SITE_URL || req.nextUrl.origin}/api/unsubscribe?type=lead&id=${latest.id}`,
    checkedOn: new Date(latest.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "Australia/Melbourne" }),
    name: firstNameOf(latest.customer_name ?? null),
  });
  const ok = await sendEmail({ to: latest.email, subject: e.subject, title: e.title, html: e.html });
  if (!ok) return fail("The email didn't send. Check Resend, then try again.", 502);
  const now = new Date().toISOString();
  res = await db.from("leads").update({ invite_sent_at: now }).ilike("email", like).select(cols);
  await logAdmin(db, "invite", email);
  return NextResponse.json({ ok: true, sentAt: now, message: "Invite sent." });
}

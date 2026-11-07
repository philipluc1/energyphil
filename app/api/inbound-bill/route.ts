import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readBill, type BillFile } from "@/lib/billReader";
import { applyBillForMember } from "@/lib/applyBill";
import { sendEmail, esc } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import { findMoney } from "@/lib/moneyFinder";
import { addFound } from "@/lib/moneyFound";
import { INBOX_READS_PER_DAY, forwardedVerdict, gmailConfirmation, localFromAddresses, pickBillAttachments, verifyWebhook, type Attachment } from "@/lib/billInbox";

// 5 Nov 2026: a bill forwarded to a member's private address arrives here from
// Resend (webhook "email.received"). We answer straight away, then read the
// bill, save it the same way as an upload, re-check the plans and tell the member.
// Nothing from the email is kept except the numbers on the bill.

export const maxDuration = 60;

const RESEND = process.env.RESEND_API_BASE || "https://api.resend.com";
const dash = `${SITE_URL}/account#read-bill`;
const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

type Received = { email_id?: string; from?: string; to?: string[]; cc?: string[]; received_for?: string[]; subject?: string; attachments?: Attachment[] };

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_INBOUND_SECRET ?? "";
  if (!secret || !supabaseAdmin || !process.env.RESEND_API_KEY) return NextResponse.json({ ok: false, message: "Forwarded bills aren't set up yet." }, { status: 503 });
  const raw = await req.text();
  const ok = verifyWebhook(raw, {
    id: req.headers.get("svix-id") ?? req.headers.get("webhook-id"),
    timestamp: req.headers.get("svix-timestamp") ?? req.headers.get("webhook-timestamp"),
    signature: req.headers.get("svix-signature") ?? req.headers.get("webhook-signature"),
  }, secret);
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });
  let event: { type?: string; data?: Received };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (event.type !== "email.received" || !event.data?.email_id) return NextResponse.json({ ok: true, ignored: true });
  const data = event.data;
  // Answer Resend now (it retries slow replies); the reading happens after.
  after(() => handle(data).catch((e) => console.error("inbound-bill:", e)));
  return NextResponse.json({ ok: true });
}

async function resendGet<T>(path: string): Promise<T | null> {
  const r = await fetch(`${RESEND}${path}`, { headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` } }).catch(() => null);
  return r && r.ok ? ((await r.json().catch(() => null)) as T | null) : null;
}

async function handle(d: Received) {
  const db = supabaseAdmin!;
  const local = localFromAddresses([...(d.to ?? []), ...(d.received_for ?? []), ...(d.cc ?? [])]);
  if (!local) return;
  const { data: sub } = await db
    .from("subscribers")
    .select("id, email, status, nmi, inbox_last_email_id")
    .eq("bill_inbox", local)
    .limit(1)
    .maybeSingle();
  if (!sub || sub.status !== "active") return;
  if (sub.inbox_last_email_id === d.email_id) return; // Resend retried a delivery we already handled
  const email = String(sub.email);
  const setStatus = (status: string, extra: Record<string, unknown> = {}) =>
    db.from("subscribers").update({ inbox_last_at: new Date().toISOString(), inbox_last_status: status, inbox_last_email_id: d.email_id, ...extra }).eq("id", sub.id);

  // Gmail asks the new forwarding address to confirm first: pass the code on to the member.
  const full = await resendGet<{ text?: string | null; html?: string | null; subject?: string; from?: string; attachments?: Attachment[] }>(`/emails/receiving/${d.email_id}`);
  const text = full?.text ?? String(full?.html ?? "").replace(/<[^>]+>/g, " ");
  const g = gmailConfirmation(d.from ?? full?.from ?? "", d.subject ?? full?.subject ?? "", text);
  if (g) {
    await setStatus("gmail", { inbox_gmail_code: g.code, inbox_gmail_link: g.link });
    await sendEmail({
      to: email,
      subject: "One step left: confirm Gmail forwarding",
      title: "Confirm Gmail forwarding",
      html: `<p>Gmail wants to check it's you before it forwards bills to Utilo.</p>
        ${g.code ? `<p>Your confirmation code: <b style="font-size:20px;letter-spacing:2px;">${esc(g.code)}</b></p><p>Enter it in Gmail: Settings → Forwarding and POP/IMAP.</p>` : ""}
        ${g.link ? `<p>Or confirm in one tap with the button below. It opens Gmail's own page.</p>` : ""}
        <p>Then add the filter from your dashboard so only bills are forwarded.</p>`,
      cta: g.link ? { label: "Confirm forwarding in Gmail", url: g.link } : { label: "Open my dashboard", url: dash },
    });
    return;
  }

  // Same daily limit as uploads.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("bill_reads").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if ((count ?? 0) >= INBOX_READS_PER_DAY) { await setStatus("limit"); return; }

  const list = full?.attachments?.length ? full.attachments : d.attachments ?? [];
  const pick = pickBillAttachments(list);
  if (!pick.length) {
    await setStatus("no-bill");
    await sendEmail({
      to: email,
      subject: "That email had no bill attached",
      title: "No bill in that email",
      html: `<p>We got an email from ${esc(d.from ?? "your retailer")}${d.subject ? ` (“${esc(d.subject)}”)` : ""}, but there was no bill attached.</p>
        <p>Some retailers only send a link. In your retailer's app or account, look for <b>“Email me my bill as a PDF”</b> and turn it on. Until then, you can upload the bill on your dashboard.</p>`,
      cta: { label: "Upload my bill", url: dash },
    });
    return;
  }

  const links = await resendGet<{ data?: Array<Attachment & { download_url?: string }> }>(`/emails/receiving/${d.email_id}/attachments`);
  const files: BillFile[] = [];
  for (const a of pick) {
    const url = links?.data?.find((x) => x.id === a.id)?.download_url;
    if (!url) continue;
    const r = await fetch(url).catch(() => null);
    if (!r || !r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) continue;
    const type = /pdf/i.test(a.content_type ?? "") || /\.pdf$/i.test(a.filename ?? "") ? "application/pdf" : String(a.content_type).toLowerCase();
    files.push({ mediaType: type, base64: buf.toString("base64") });
  }
  if (!files.length) { await setStatus("unreadable"); return; }

  const { data: readRow } = await db.from("bill_reads").insert({ email }).select("id").single();
  const read = await readBill(files);
  if (!read.ok) {
    if (read.reason === "unreachable" || read.reason === "api" || read.reason === "nokey") {
      if (readRow?.id) await db.from("bill_reads").delete().eq("id", readRow.id);
      await setStatus("retry-later");
      await sendEmail({ to: email, subject: "We couldn't read your bill just now", title: "Bill not read yet",
        html: `<p>Our bill reader had a problem with the bill you forwarded. Please upload it on your dashboard, or forward it again later.</p>`,
        cta: { label: "Upload my bill", url: dash } });
      return;
    }
    await setStatus(read.reason === "notbill" ? "not-a-bill" : "unreadable");
    if (read.reason === "unreadable") {
      await sendEmail({ to: email, subject: "We couldn't read the bill you forwarded", title: "Bill not readable",
        html: `<p>The file attached to ${d.subject ? `“${esc(d.subject)}”` : "your email"} didn't read clearly. Upload a clearer copy on your dashboard and we'll re-check your plans.</p>`,
        cta: { label: "Upload my bill", url: dash } });
    }
    return; // a newsletter or promo forwarded by the rule: ignore quietly
  }
  const bill = read.extracted;
  if (readRow?.id) await db.from("bill_reads").update({ fuel: bill.fuel === "gas" || bill.fuel === "dual" ? bill.fuel : "electricity" }).eq("id", readRow.id);

  const verdict = forwardedVerdict(bill, sub.nmi);
  if (verdict !== "save") {
    await setStatus("check", { inbox_pending: bill });
    const why = verdict === "partial" ? "it looks like only part of the bill" : verdict === "other-meter" ? "it's for a different meter (NMI) from the one on your account" : "some of the usage figures were missing";
    await sendEmail({ to: email, subject: "Your forwarded bill needs a quick look", title: "A quick check, please",
      html: `<p>We read the ${bill.retailerName ? `${esc(bill.retailerName)} ` : ""}bill you forwarded, but ${why}. It takes a few seconds to check the numbers on your dashboard, then we'll re-check every plan.</p>`,
      cta: { label: "Check my bill", url: dash } });
    return;
  }

  const res = await applyBillForMember(email, bill);
  if (!res?.ok) {
    await setStatus("check", { inbox_pending: bill });
    await sendEmail({ to: email, subject: "Your forwarded bill needs a quick look", title: "A quick check, please",
      html: `<p>We read your bill, but couldn't use it as it was (${esc(res?.message ?? "something was missing")}). Check the numbers on your dashboard and we'll re-check every plan.</p>`,
      cta: { label: "Check my bill", url: dash } });
    return;
  }
  await setStatus("saved", { inbox_pending: null });
  const yearly = typeof res.savingPerYear === "number" ? res.savingPerYear : null;
  const worth = yearly !== null && yearly >= WORTH_SWITCHING_PER_YEAR && res.retailer;
  // 5 Nov 2026: money on the bill itself (fees, a missed discount, an estimated read, a concession not applied).
  const { data: cc } = await db.from("subscribers").select("concession_card").eq("id", sub.id).maybeSingle();
  const fm = findMoney({
    retailer: bill.retailerName ?? "", worthPerYear: WORTH_SWITCHING_PER_YEAR,
    flagged: new Set(bill.discountLost ? ["discount"] : []),
    readingType: bill.readingType ?? null, concessionApplied: bill.concessionApplied === true,
    hasCard: (cc as { concession_card?: boolean | null } | null)?.concession_card ?? null,
    fees: bill.fees ?? [], billTotal: bill.currentBill ?? null, days: bill.billingDays ?? null,
    fuel: bill.fuel === "gas" ? "gas" : "electricity",
  });
  // Add this bill to the member's running total (same key as the dashboard's bill check, so it counts once).
  {
    const { data: mf, error: mfErr } = await db.from("subscribers").select("money_found").eq("id", sub.id).maybeSingle();
    if (!mfErr) {
      const next = addFound((mf as { money_found?: unknown } | null)?.money_found, { key: new Date().toLocaleDateString("en-CA"), at: new Date().toISOString(), perYear: fm.perYear, oneOff: fm.oneOff, ids: fm.findings.map((f) => f.id) });
      await db.from("subscribers").update({ money_found: next }).eq("id", sub.id);
    }
  }
  // 8 Nov 2026: a member's very first bill gets the "first check" email from applyBill instead.
  if (res.firstCheck) return;
  const worthOf = fm.perYear > 0 ? ` worth about ${money(fm.perYear)} a year` : fm.oneOff > 0 ? ` worth ${money(fm.oneOff)} back` : "";
  const alsoFound = fm.findings.length
    ? `<p style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;"><b>We also found ${fm.findings.length === 1 ? "one thing" : `${fm.findings.length} things`} on this bill${worthOf}:</b><br>${fm.findings.map((f) => `• ${esc(f.ask)}`).join("<br>")}<br>Your dashboard has exactly what to say.</p>`
    : "";
  await sendEmail({
    to: email,
    subject: `Your ${bill.retailerName ?? "energy"} bill is in`,
    title: worth ? `You could save about ${money(yearly!)} a year` : "Bill in. You're on a good deal",
    html: worth
      ? `<p>We read the bill you forwarded and re-checked every plan. <b>${esc(res.retailer)}</b>'s ${esc(res.plan)} comes out about <b>${money(yearly!)} a year</b> less on your usage.</p>${alsoFound}`
      : `<p>We read the bill you forwarded and re-checked every plan. Nothing beats your plan by ${money(WORTH_SWITCHING_PER_YEAR)} a year or more${fm.findings.length ? "" : ", so there's nothing to do"}. We'll keep watching.</p>${alsoFound}`,
    cta: fm.findings.length && !worth ? { label: "See what to say", url: `${SITE_URL}/account#home` } : { label: worth ? "See the plan" : "Open my dashboard", url: worth ? `${SITE_URL}/account` : dash },
  });
}

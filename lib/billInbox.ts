import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

// 5 Nov 2026: forwarded bills. Each member gets a private address such as
// sam-k7q2m9x4@bills.utilo.com.au. A bill emailed there (by a Gmail or Outlook
// rule) is read like an uploaded one, the plans are re-checked, and the member
// is told what changed. Only the numbers are kept; the email and PDF are not.

export const INBOX_DOMAIN = (process.env.INBOUND_BILL_DOMAIN || "bills.utilo.com.au").toLowerCase();
/** Bill reads a member can trigger by email in 24 hours (same as uploads). */
export const INBOX_READS_PER_DAY = 10;
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // no 0/o/1/l/i

/** "sam-k7q2m9x4": the first name (if any) for recognition, then 8 random characters. */
export function newInboxLocal(firstName?: string | null, rnd: (n: number) => number = randomInt): string {
  const name = String(firstName ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "").slice(0, 12);
  let tail = "";
  for (let i = 0; i < 8; i++) tail += ALPHABET[rnd(ALPHABET.length)];
  return name ? `${name}-${tail}` : `bills-${tail}`;
}

export const inboxAddress = (local: string, domain = INBOX_DOMAIN) => `${local}@${domain}`;

/** The member's part of the first address on our domain ("Sam <x@d>" or "x@d"). */
export function localFromAddresses(addresses: unknown[], domain = INBOX_DOMAIN): string | null {
  for (const a of addresses) {
    const m = /([A-Za-z0-9._+-]+)@([A-Za-z0-9.-]+)/.exec(String(a ?? ""));
    if (m && m[2].toLowerCase() === domain) return m[1].toLowerCase().split("+")[0];
  }
  return null;
}

/**
 * Resend signs webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body"
 * with the base64 secret after "whsec_"; the header holds "v1,<base64>" entries.
 */
export function verifyWebhook(
  body: string,
  h: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): boolean {
  if (!h.id || !h.timestamp || !h.signature || !secret) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec) return false;
  let key: Buffer;
  try { key = Buffer.from(secret.replace(/^whsec_/, ""), "base64"); } catch { return false; }
  const expected = createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${body}`).digest();
  return h.signature.split(" ").some((part) => {
    const [ver, sig] = part.split(",");
    if (ver !== "v1" || !sig) return false;
    let got: Buffer;
    try { got = Buffer.from(sig, "base64"); } catch { return false; }
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** Gmail's "confirm forwarding" email: its code and link, so the member can finish setup. */
export function gmailConfirmation(from: string, subject: string, text: string): { code: string | null; link: string | null } | null {
  const isGoogle = /forwarding-noreply@google\.com/i.test(from) || /gmail forwarding confirmation/i.test(subject);
  if (!isGoogle) return null;
  const code = /confirmation code:\s*(\d{6,12})/i.exec(text)?.[1] ?? /\((#\d{6,12})\)/.exec(subject)?.[1]?.slice(1) ?? null;
  const link = /https:\/\/(?:mail-settings|mail)\.google\.com\/mail\/[^\s"'<>)]+/i.exec(text)?.[0] ?? null;
  return { code, link };
}

export type Attachment = { id: string; filename?: string | null; content_type?: string | null; content_disposition?: string | null; size?: number | null };
const MAX_BYTES = 15 * 1024 * 1024;
const IMAGE = /^image\/(jpeg|jpg|png|webp|gif)$/i;

/** The bill in an email: one PDF (named like a bill if there are several), else up to 3 photos. Logos and signatures are skipped. */
export function pickBillAttachments(list: Attachment[]): Attachment[] {
  const ok = list.filter((a) => (a.size ?? 0) <= MAX_BYTES);
  const pdfs = ok.filter((a) => /pdf/i.test(a.content_type ?? "") || /\.pdf$/i.test(a.filename ?? ""));
  if (pdfs.length) {
    const named = pdfs.find((a) => /bill|invoice|statement|account|tax/i.test(a.filename ?? ""));
    return [named ?? [...pdfs].sort((x, y) => (y.size ?? 0) - (x.size ?? 0))[0]];
  }
  return ok
    .filter((a) => IMAGE.test(a.content_type ?? "") && a.content_disposition !== "inline" && (a.size ?? 0) >= 50 * 1024)
    .slice(0, 3);
}

type Bill = {
  fuel?: string | null; distributor?: string | null; billingDays?: number | null; usageMode?: string | null;
  anytimeKwh?: number | null; peakKwh?: number | null; shoulderKwh?: number | null; offpeakKwh?: number | null;
  gasDistributor?: string | null; gasMj?: number | null; gasBillingDays?: number | null; looksPartial?: boolean | null; nmi?: string | null;
};
const pos = (n: number | null | undefined) => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Can a forwarded bill be saved without a person looking? The same bar as the dashboard's review step. */
export function forwardedVerdict(b: Bill, memberNmi?: string | null): "save" | "partial" | "missing" | "other-meter" {
  if (b.looksPartial) return "partial";
  const norm = (s: string | null | undefined) => String(s ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10);
  if (b.fuel !== "gas" && norm(memberNmi).length === 10 && norm(b.nmi).length === 10 && norm(memberNmi) !== norm(b.nmi)) return "other-meter";
  const days = b.billingDays ?? null;
  const elecOk = !!b.distributor && pos(days) && (days as number) <= 366 &&
    (b.usageMode === "detailed" ? pos((b.peakKwh ?? 0) + (b.shoulderKwh ?? 0) + (b.offpeakKwh ?? 0)) : pos(b.anytimeKwh));
  const gasOk = !!b.gasDistributor && pos(b.gasMj) && pos(b.gasBillingDays ?? days);
  if (b.fuel === "gas") return gasOk ? "save" : "missing";
  return elecOk ? "save" : "missing";
}

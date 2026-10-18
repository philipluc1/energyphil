// Where a visitor came from: a partner's link (/p/code), a member's referral
// link (/r/CODE) or an ad/campaign link (?utm_source=...). Kept in one small
// first-party cookie for 90 days, so the partner gets credit, the friend's
// discount applies at checkout, and the owner dashboard can show which
// channels bring checks and members. No personal information is stored in it.
//
// Cookie value:  p:<partner code>  |  r:<REFERRAL CODE>  |  u:<source>/<medium>/<campaign>

export const SRC_COOKIE = "utilo_src";
export const SRC_MAX_AGE_DAYS = 90;
export const SRC_MAX_AGE = SRC_MAX_AGE_DAYS * 24 * 60 * 60;

export type SourceKind = "partner" | "referral" | "ad";
export interface Source {
  kind: SourceKind;
  code: string;
}

const PREFIX: Record<SourceKind, string> = { partner: "p", referral: "r", ad: "u" };
const KIND: Record<string, SourceKind> = { p: "partner", r: "referral", u: "ad" };

/** Partner codes and ad parts: lower-case letters, digits and dashes. */
export function cleanCode(s: unknown, max = 40): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

/** Referral codes: 6 characters, no look-alikes (no I, L, O, 0, 1). */
export const REFERRAL_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const REFERRAL_RE = /^[A-HJKMNP-Z2-9]{6}$/;
export function cleanReferralCode(s: unknown): string | null {
  const c = String(s ?? "").trim().toUpperCase();
  return REFERRAL_RE.test(c) ? c : null;
}

export function formatSource(s: Source): string {
  return `${PREFIX[s.kind]}:${s.code}`;
}

export function parseSource(v: string | null | undefined): Source | null {
  if (!v) return null;
  let raw = v;
  try {
    raw = decodeURIComponent(v);
  } catch {
    /* keep as is */
  }
  const m = /^([pru]):(.+)$/.exec(raw.trim());
  if (!m) return null;
  const kind = KIND[m[1]];
  if (kind === "referral") {
    const code = cleanReferralCode(m[2]);
    return code ? { kind, code } : null;
  }
  if (kind === "ad") {
    const parts = m[2].split("/").map((p) => cleanCode(p, 40)).slice(0, 3);
    if (!parts[0]) return null;
    return { kind, code: parts.join("/").replace(/\/+$/, "") };
  }
  const code = cleanCode(m[2]);
  return code ? { kind, code } : null;
}

/** The value to store from a raw cookie (validated), or null. */
export function sourceValue(v: string | null | undefined): string | null {
  const s = parseSource(v);
  return s ? formatSource(s) : null;
}

/** An ad/campaign source from URL parameters, or null when there's no utm_source. */
export function sourceFromUtm(params: URLSearchParams): Source | null {
  const src = cleanCode(params.get("utm_source"));
  if (!src) return null;
  const parts = [src, cleanCode(params.get("utm_medium")), cleanCode(params.get("utm_campaign"))];
  return { kind: "ad", code: parts.join("/").replace(/\/+$/, "") };
}

/** Plain label for the owner dashboard. */
export function sourceLabel(v: string | null | undefined, partnerName?: (code: string) => string | null): string {
  const s = parseSource(v ?? null);
  if (!s) return "Direct or unknown";
  if (s.kind === "partner") return `Partner: ${partnerName?.(s.code) ?? s.code}`;
  if (s.kind === "referral") return "A member's referral";
  return `Ad or campaign: ${s.code}`;
}

// --- Browser helpers (no-ops on the server) -------------------------------

export function readSourceCookie(): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${SRC_COOKIE}=`));
  return hit ? sourceValue(hit.slice(SRC_COOKIE.length + 1)) : null;
}

export function writeSourceCookie(s: Source): void {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SRC_COOKIE}=${encodeURIComponent(formatSource(s))}; Max-Age=${SRC_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

// Visits (2 Nov 2026): which pages people land on and look at, and how many
// are on the site right now, for the owner dashboard. Anonymous: a random id
// for the browser tab (the same one the check counts use), the page path
// (never the ? or # part), the site that sent them, and phone/tablet/desktop.
// No name, email, IP address or browser fingerprint.

export interface ViewRow {
  created_at: string;
  sid: string;
  path: string;
  ref: string | null;
  device: string | null;
  first: boolean | null;
  source?: string | null;
}

/** Someone counts as "on the site now" if their tab checked in within this long. */
export const LIVE_WINDOW_MS = 2 * 60_000;
/** How often an open, visible tab checks in. */
export const PING_EVERY_MS = 45_000;

const ID_SEG = /^(?:[0-9a-f]{8}-[0-9a-f-]{27,}|[0-9a-f]{16,}|\d{4,}|[A-Za-z0-9_-]{24,})$/i;

/** "/account/bills/3f2a…?x=1#y" → "/account/bills/:id". Null for anything odd. */
export function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = raw.split(/[?#]/)[0];
  const segs = path.split("/").map((s) => (ID_SEG.test(s) ? ":id" : s));
  const out = segs.join("/").replace(/\/+$/, "") || "/";
  if (out.length > 120 || /[^\w\-/.:~%]/.test(out)) return null;
  return out;
}

/** The site that sent them: "google.com". Null for none, or our own site. */
export function refHost(raw: unknown, ownHost: string | null): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const h = new URL(raw).hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "").replace(/^l\./, "").replace(/^lm\./, "");
    const own = (ownHost ?? "").toLowerCase().replace(/^www\./, "").split(":")[0];
    if (!h || h === own || h === "localhost") return null;
    return h.slice(0, 80);
  } catch {
    return null;
  }
}

export function deviceOf(ua: string | null | undefined): "phone" | "tablet" | "desktop" {
  const u = ua ?? "";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(u)) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(u)) return "phone";
  return "desktop";
}

const LABELS: Record<string, string> = {
  "/": "Home page",
  "/check": "Free check",
  "/pricing": "Utilo Plus (prices)",
  "/business": "Business",
  "/gas": "Gas",
  "/ev": "EV",
  "/learn": "Learn",
  "/market": "Market",
  "/faq": "FAQ",
  "/default-offer": "Default offer",
  "/account": "Member dashboard",
  "/welcome": "Welcome (just joined)",
  "/subscribe/success": "Payment done",
  "/privacy": "Privacy",
  "/terms": "Terms",
};
export const pageLabel = (path: string) => LABELS[path] ?? path;

export interface VisitReport {
  visitors: number;
  views: number;
  /** Visitors who started a check in the same tab session. */
  startedCheck: number;
  landing: { path: string; visitors: number; checks: number }[];
  pages: { path: string; views: number; visitors: number }[];
  referrers: { host: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  pagesPerVisitor: number;
}

const top = <T,>(m: Map<string, T>, by: (v: T) => number, n: number) => Array.from(m.entries()).sort((a, b) => by(b[1]) - by(a[1])).slice(0, n);

/** Visitors, the page each one landed on (and whether they went on to start a check), pages viewed, who sent them. */
export function visitReport(rows: ViewRow[], checkSids: Set<string>): VisitReport {
  const bySid = new Map<string, ViewRow[]>();
  for (const r of rows) {
    const list = bySid.get(r.sid);
    if (list) list.push(r);
    else bySid.set(r.sid, [r]);
  }
  const landing = new Map<string, { visitors: number; checks: number }>();
  const referrers = new Map<string, number>();
  const devices = new Map<string, number>();
  let startedCheck = 0;
  for (const [sid, list] of bySid) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const land = list.find((r) => r.first) ?? list[0];
    const checked = checkSids.has(sid);
    if (checked) startedCheck++;
    const l = landing.get(land.path) ?? { visitors: 0, checks: 0 };
    l.visitors++;
    if (checked) l.checks++;
    landing.set(land.path, l);
    const ref = list.find((r) => r.ref)?.ref ?? "Direct or unknown";
    referrers.set(ref, (referrers.get(ref) ?? 0) + 1);
    const dev = land.device ?? "desktop";
    devices.set(dev, (devices.get(dev) ?? 0) + 1);
  }
  const pages = new Map<string, { views: number; sids: Set<string> }>();
  for (const r of rows) {
    const p = pages.get(r.path) ?? { views: 0, sids: new Set<string>() };
    p.views++;
    p.sids.add(r.sid);
    pages.set(r.path, p);
  }
  const visitors = bySid.size;
  return {
    visitors,
    views: rows.length,
    startedCheck,
    landing: top(landing, (v) => v.visitors, 15).map(([path, v]) => ({ path, ...v })),
    pages: top(pages, (v) => v.views, 20).map(([path, v]) => ({ path, views: v.views, visitors: v.sids.size })),
    referrers: top(referrers, (v) => v, 10).map(([host, n]) => ({ host, visitors: n })),
    devices: top(devices, (v) => v, 3).map(([device, n]) => ({ device, visitors: n })),
    pagesPerVisitor: visitors ? Math.round((rows.length / visitors) * 10) / 10 : 0,
  };
}

/** Who's on the site now, and on which pages. */
export function liveNow(rows: { sid: string; path: string | null; last_seen: string }[], now: number): { count: number; pages: { path: string; n: number }[] } {
  const live = rows.filter((r) => now - Date.parse(r.last_seen) <= LIVE_WINDOW_MS);
  const m = new Map<string, number>();
  for (const r of live) m.set(r.path ?? "/", (m.get(r.path ?? "/") ?? 0) + 1);
  return { count: live.length, pages: top(m, (v) => v, 8).map(([path, n]) => ({ path, n })) };
}

// 5 Nov 2026: "money we found for you", the running total that shows Plus paying for itself.
// One entry per bill (keyed by the day the bill was read), from the dashboard's bill check
// and from forwarded bills. Counted honestly: things caught add up across bills, and so do
// one-off amounts to ask back (fees); yearly savings are NOT added across bills (the same
// concession on four bills is one saving), so we show what's on offer on the latest bill.

export interface FoundEntry { key: string; at: string; perYear: number; oneOff: number; ids: string[] }

const clean = (x: unknown): FoundEntry | null => {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const key = typeof r.key === "string" ? r.key.slice(0, 20) : "";
  const at = typeof r.at === "string" ? r.at.slice(0, 30) : "";
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 100000 ? Math.round(v * 100) / 100 : 0);
  const ids = Array.isArray(r.ids) ? r.ids.filter((i): i is string => typeof i === "string" && /^[a-z-]{2,20}$/.test(i)).slice(0, 12) : [];
  return key && at ? { key, at, perYear: n(r.perYear), oneOff: n(r.oneOff), ids } : null;
};

/** Add (or merge) one bill's findings; keeps the latest 24 bills. */
export function addFound(list: unknown, e: FoundEntry): FoundEntry[] {
  const all = (Array.isArray(list) ? list.map(clean).filter((x): x is FoundEntry => !!x) : []);
  const next = clean(e);
  if (!next) return all;
  const i = all.findIndex((x) => x.key === next.key);
  if (i >= 0) {
    const old = all[i];
    all[i] = { key: old.key, at: next.at > old.at ? next.at : old.at, perYear: Math.max(old.perYear, next.perYear), oneOff: Math.max(old.oneOff, next.oneOff), ids: Array.from(new Set([...old.ids, ...next.ids])) };
  } else all.push(next);
  return all.sort((a, b) => a.key.localeCompare(b.key)).slice(-24);
}

export interface FoundTotals { bills: number; caught: number; back: number; onOfferYear: number }

export function foundTotals(list: unknown): FoundTotals {
  const all = Array.isArray(list) ? list.map(clean).filter((x): x is FoundEntry => !!x) : [];
  const withAny = all.filter((x) => x.ids.length > 0);
  const latest = all[all.length - 1];
  return {
    bills: all.length,
    caught: withAny.reduce((t, x) => t + x.ids.length, 0),
    back: Math.round(all.reduce((t, x) => t + x.oneOff, 0)),
    onOfferYear: Math.round(latest?.perYear ?? 0),
  };
}

const whole = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

/** "We've caught 5 things on your bills: $24 in fees to ask back, and about $372 a year on offer on your latest bill." */
export function foundSentence(t: FoundTotals): string | null {
  if (t.caught === 0) return null;
  const parts = [t.back > 0 ? `${whole(t.back)} in fees and charges to ask back` : null, t.onOfferYear > 0 ? `about ${whole(t.onOfferYear)} a year on offer on your latest bill` : null].filter(Boolean);
  return `We've caught ${t.caught === 1 ? "one thing" : `${t.caught} things`} on your bills${parts.length ? `: ${parts.join(", and ")}` : ""}.`;
}

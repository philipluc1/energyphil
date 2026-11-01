// "Why did my bill change?" (2 Nov 2026): the latest bill against the one
// before, in plain words. A bill moves for three reasons: it covered more or
// fewer days, you used more or less each day, or each unit cost more or less
// (counting the supply charge). We say which mattered, and by roughly how much.

export interface BillPoint {
  periodEnd: string;
  days: number;
  amount: number;
  /** kWh or MJ for the period. */
  usage: number;
}

export interface BillChange {
  diff: number;
  /** "$62 more than your last bill" */
  headline: string;
  /** The reasons, biggest first, e.g. ["9 more days", "18% more power a day"]. */
  reasons: string[];
  /** The one that moved the bill most. */
  main: "days" | "usage" | "price" | null;
}

const whole = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("en-AU");
const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;

export function billChange(prev: BillPoint, next: BillPoint, unit: "power" | "gas" = "power"): BillChange | null {
  if (![prev, next].every((b) => b.days > 0 && b.amount > 0 && b.usage > 0)) return null;
  const diff = next.amount - prev.amount;
  if (Math.abs(diff) < 5) return { diff, headline: "About the same as your last bill", reasons: [], main: null };

  const u0 = prev.usage / prev.days, u1 = next.usage / next.days;
  const p0 = prev.amount / prev.usage, p1 = next.amount / next.usage;
  // Each effect in dollars, so the biggest can be named.
  const daysFx = (prev.amount / prev.days) * (next.days - prev.days);
  const usageFx = (u1 - u0) * next.days * p0;
  const priceFx = diff - daysFx - usageFx;

  const word = unit === "gas" ? "gas" : "power";
  const parts: { key: BillChange["main"]; fx: number; text: string }[] = [];
  const dd = next.days - prev.days;
  if (Math.abs(dd) >= 3) parts.push({ key: "days", fx: daysFx, text: `${Math.abs(dd)} ${dd > 0 ? "more" : "fewer"} days` });
  const du = u1 / u0 - 1;
  if (Math.abs(du) >= 0.05) parts.push({ key: "usage", fx: usageFx, text: `${pct(du)} ${du > 0 ? "more" : "less"} ${word} a day` });
  const dp = p1 / p0 - 1;
  if (Math.abs(dp) >= 0.03) parts.push({ key: "price", fx: priceFx, text: `each ${unit === "gas" ? "MJ" : "kWh"} cost ${pct(dp)} ${dp > 0 ? "more" : "less"}, counting supply` });
  parts.sort((a, b) => Math.abs(b.fx) - Math.abs(a.fx));
  // The main reason has to push the same way as the bill moved.
  const main = parts.find((x) => Math.sign(x.fx) === Math.sign(diff))?.key ?? null;
  return { diff, headline: `${whole(diff)} ${diff > 0 ? "more" : "less"} than your last bill`, reasons: parts.map((x) => x.text), main };
}

/** The latest two bills, in period order, that can be compared. */
export function latestPair<T extends { period_end: string; billing_days: number; amount: number | null }>(bills: T[], usageOf: (b: T) => number | null): [BillPoint, BillPoint] | null {
  const ok = bills
    .filter((b) => b.amount !== null && b.amount > 0 && (usageOf(b) ?? 0) > 0 && b.billing_days > 0)
    .sort((a, b) => (a.period_end < b.period_end ? -1 : 1));
  if (ok.length < 2) return null;
  const pt = (b: T): BillPoint => ({ periodEnd: b.period_end, days: b.billing_days, amount: b.amount as number, usage: usageOf(b) as number });
  return [pt(ok[ok.length - 2]), pt(ok[ok.length - 1])];
}

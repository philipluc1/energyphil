// The bill tracker (1 Nov 2026): every bill a member uploads (or types in)
// is kept, and spread over the calendar months it covered, so a quarterly
// bill fills three columns and a gap shows a month nobody has a bill for.

export type Fuel = "electricity" | "gas";

export interface TrackedBill {
  id: string;
  fuel: Fuel;
  /** Last day of the billing period, YYYY-MM-DD. */
  period_end: string;
  billing_days: number;
  /** Electricity used, kWh (all meters). */
  kwh: number | null;
  /** Gas used, MJ. */
  mj: number | null;
  /** The bill's total for this fuel, $ incl. GST. */
  amount: number | null;
  retailer: string | null;
  source: "photo" | "typed";
}

export interface TrackedMonth {
  year: number;
  /** 0..11 */
  month: number;
  /** "2026-10" */
  key: string;
  days: number;
  /** Days of this month covered by a bill. */
  covered: number;
  /** $ from the bills that covered it, spread by day. */
  amount: number;
  /** kWh or MJ, spread by day. */
  usage: number;
  /** Bills that touched this month. */
  billIds: string[];
  /** full: all of it covered; part: some; missing: none; now: this month, not billed yet. */
  status: "full" | "part" | "missing" | "now";
  /** Some covered days had no $ or no usage on the bill, so the figure is partial. */
  estimatedGap: boolean;
}

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Calendar months from `from` to `to` (inclusive), oldest first. */
function monthRange(from: { y: number; m: number }, to: { y: number; m: number }): { y: number; m: number }[] {
  const out: { y: number; m: number }[] = [];
  let y = from.y;
  let m = from.m;
  while (y < to.y || (y === to.y && m <= to.m)) {
    out.push({ y, m });
    m++;
    if (m > 11) { m = 0; y++; }
    if (out.length > 60) break;
  }
  return out;
}

/**
 * The months to chart for one fuel: from the earliest bill (or `minMonths`
 * back, whichever is earlier) to this month, at most `maxMonths`.
 */
export function trackMonths(bills: TrackedBill[], fuel: Fuel, opts: { today?: Date; minMonths?: number; maxMonths?: number } = {}): TrackedMonth[] {
  const today = opts.today ?? new Date();
  const now = { y: today.getUTCFullYear(), m: today.getUTCMonth() };
  const mine = bills.filter((b) => b.fuel === fuel && b.billing_days > 0 && /^\d{4}-\d{2}-\d{2}$/.test(b.period_end));
  const minBack = Math.max(1, opts.minMonths ?? 6);
  const maxN = Math.max(minBack, opts.maxMonths ?? 12);
  let start = { y: now.y, m: now.m - (minBack - 1) };
  for (const b of mine) {
    const s = new Date(utc(b.period_end) - (b.billing_days - 1) * DAY);
    if (s.getUTCFullYear() < start.y || (s.getUTCFullYear() === start.y && s.getUTCMonth() < start.m)) start = { y: s.getUTCFullYear(), m: s.getUTCMonth() };
  }
  while (start.m < 0) { start.m += 12; start.y--; }
  let months = monthRange(start, now);
  if (months.length > maxN) months = months.slice(months.length - maxN);

  const out: TrackedMonth[] = months.map(({ y, m }) => ({
    year: y, month: m, key: `${y}-${String(m + 1).padStart(2, "0")}`, days: daysIn(y, m),
    covered: 0, amount: 0, usage: 0, billIds: [], status: "missing", estimatedGap: false,
  }));
  const at = new Map(out.map((x, i) => [x.key, i]));
  // Each day of each bill goes to its month; a day two bills both claim counts once (the later bill wins).
  const claimed = new Map<string, string>();
  const sorted = [...mine].sort((a, b) => utc(a.period_end) - utc(b.period_end));
  for (const b of sorted) {
    const end = utc(b.period_end);
    for (let i = 0; i < b.billing_days; i++) claimed.set(new Date(end - i * DAY).toISOString().slice(0, 10), b.id);
  }
  const byId = new Map(mine.map((b) => [b.id, b]));
  for (const [day, id] of claimed) {
    const idx = at.get(day.slice(0, 7));
    if (idx === undefined) continue;
    const b = byId.get(id)!;
    const x = out[idx];
    x.covered++;
    if (b.amount !== null) x.amount += b.amount / b.billing_days; else x.estimatedGap = true;
    const use = fuel === "gas" ? b.mj : b.kwh;
    if (use !== null) x.usage += use / b.billing_days; else x.estimatedGap = true;
    if (!x.billIds.includes(id)) x.billIds.push(id);
  }
  for (const x of out) {
    const isNow = x.year === now.y && x.month === now.m;
    x.status = x.covered >= x.days ? "full" : x.covered > 0 ? (isNow ? "now" : "part") : isNow ? "now" : "missing";
    x.amount = Math.round(x.amount * 100) / 100;
    x.usage = Math.round(x.usage);
  }
  return out;
}

/** Totals for the tracked months that have bills: $ and usage, and the average a month. */
export function trackerTotals(months: TrackedMonth[]): { amount: number; usage: number; months: number; avgAmount: number; missing: number } {
  const billed = months.filter((m) => m.covered > 0);
  const amount = billed.reduce((a, m) => a + m.amount, 0);
  const usage = billed.reduce((a, m) => a + m.usage, 0);
  const coveredMonths = billed.reduce((a, m) => a + m.covered / m.days, 0);
  return { amount, usage, months: billed.length, avgAmount: coveredMonths > 0 ? amount / coveredMonths : 0, missing: months.filter((m) => m.status === "missing").length };
}

/** A typed-in bill for a month: the whole month, ending on its last day. */
export function monthBill(year: number, month: number): { periodEnd: string; days: number } {
  const d = daysIn(year, month);
  return { periodEnd: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, days: d };
}

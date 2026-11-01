// Owner dashboard filters (2 Nov 2026): time period, plan and where people
// came from. They live in the address (?period=90&plan=annual&source=referral);
// none of them is personal.

export const PERIODS = [
  { id: "7", label: "7 days", days: 7 },
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "365", label: "12 months", days: 365 },
  { id: "all", label: "All time", days: null },
] as const;
export const PLANS = [
  { id: "all", label: "All plans" },
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Yearly" },
] as const;
export const SOURCES = [
  { id: "all", label: "Everyone" },
  { id: "direct", label: "Direct" },
  { id: "referral", label: "Referrals" },
  { id: "partner", label: "Partners" },
  { id: "ads", label: "Ads" },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];
export type PlanId = (typeof PLANS)[number]["id"];
export type SourceId = (typeof SOURCES)[number]["id"];

export interface DashFilters {
  period: PeriodId;
  plan: PlanId;
  source: SourceId;
}

const pick = <T extends string>(v: unknown, ok: readonly { id: T }[], dflt: T): T => {
  const s = Array.isArray(v) ? v[0] : v;
  return ok.some((o) => o.id === s) ? (s as T) : dflt;
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): DashFilters {
  return { period: pick(sp.period, PERIODS, "all"), plan: pick(sp.plan, PLANS, "all"), source: pick(sp.source, SOURCES, "all") };
}

export const isFiltered = (f: DashFilters) => f.period !== "all" || f.plan !== "all" || f.source !== "all";

/** Days in the period, or null for all time. */
export const periodDays = (f: DashFilters): number | null => PERIODS.find((p) => p.id === f.period)?.days ?? null;

/** The start of the period (epoch ms), or 0 for all time. */
export function periodStart(f: DashFilters, now: Date): number {
  const d = periodDays(f);
  return d === null ? 0 : now.getTime() - d * 86_400_000;
}

/** 'p:<partner>' → partner, 'r:<CODE>' → referral, 'u:…' → ads, nothing → direct. */
export function sourceKind(raw: string | null | undefined): Exclude<SourceId, "all"> {
  if (!raw) return "direct";
  if (raw.startsWith("p:")) return "partner";
  if (raw.startsWith("r:")) return "referral";
  if (raw.startsWith("u:")) return "ads";
  return "direct";
}

type Dated = { created_at: string };
type Sourced = { source?: string | null };
type Planned = { plan: string };

/** Keep rows inside the period. */
export const inPeriod = <T extends Dated>(rows: T[], f: DashFilters, now: Date): T[] => {
  const from = periodStart(f, now);
  return from ? rows.filter((r) => new Date(r.created_at).getTime() >= from) : rows;
};

/** Keep rows from the chosen source. */
export const fromSource = <T extends Sourced>(rows: T[], f: DashFilters): T[] => (f.source === "all" ? rows : rows.filter((r) => sourceKind(r.source) === f.source));

/** Keep memberships on the chosen plan. */
export const onPlan = <T extends Planned>(rows: T[], f: DashFilters): T[] => (f.plan === "all" ? rows : rows.filter((r) => r.plan === f.plan));

/** How many months of joins/cancellations and cohorts to show for the period. */
export function monthsFor(f: DashFilters): number {
  const d = periodDays(f);
  return d === null || d >= 365 ? 12 : d >= 90 ? 3 : 2;
}

/** "the last 90 days · Yearly · Referrals" */
export function describeFilters(f: DashFilters): string {
  const parts: string[] = [f.period === "all" ? "All time" : `The last ${PERIODS.find((p) => p.id === f.period)!.label}`];
  if (f.plan !== "all") parts.push(PLANS.find((p) => p.id === f.plan)!.label);
  if (f.source !== "all") parts.push(SOURCES.find((s) => s.id === f.source)!.label);
  return parts.join(" · ");
}

import { sourceLabel } from "./attribution";

export interface LeadRow {
  id: string;
  created_at: string;
  email: string;
  distributor: string;
  current_bill: number | null;
  best_retailer: string | null;
  best_plan_name: string | null;
  best_total: number | null;
  estimated_saving: number | null;
  estimated_saving_pct: number | null;
}

export interface DashboardStats {
  totalLeads: number;
  leadsThisWeek: number;
  avgSaving: number | null;
  avgSavingPct: number | null;
  /** Sum (not average) of every saving the tool has shown a customer — what
   * the tool has found, not confirmation anyone actually switched. */
  totalSavingsFound: number;
  perDay: { date: string; count: number }[];
  byDistributor: { name: string; count: number }[];
  /** Average saving found per network — a market-level read on which
   * networks tend to have the most room to save. */
  avgSavingByDistributor: { name: string; avgSaving: number }[];
  /** How often each retailer comes out as the #1 cheapest match — "who wins
   * most often", across every check, not weighted by usage size. */
  winsByRetailer: { name: string; count: number }[];
  /** Average cheapest-match price per network — typical bill size by area,
   * since VDO base rates vary a lot by distributor. */
  avgBestTotalByDistributor: { name: string; avgTotal: number }[];
  recent: LeadRow[];
}

/**
 * Pure given `now` — called once per request from the dashboard's Server
 * Component (app/dashboard/page.tsx), which is where "what time is it"
 * belongs. Keeping it out of the client chart component avoids computing
 * "current time" inside a React render/hook, which is unstable there.
 */
export function computeDashboardStats(leads: LeadRow[], now: Date = new Date()): DashboardStats {
  const totalLeads = leads.length;

  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const leadsThisWeek = leads.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length;

  const savings = leads.map((l) => l.estimated_saving).filter((v): v is number => v !== null && !Number.isNaN(v));
  const avgSaving = savings.length ? savings.reduce((a, b) => a + b, 0) / savings.length : null;

  const savingPcts = leads
    .map((l) => l.estimated_saving_pct)
    .filter((v): v is number => v !== null && !Number.isNaN(v));
  const avgSavingPct = savingPcts.length ? savingPcts.reduce((a, b) => a + b, 0) / savingPcts.length : null;

  // Leads per day, last 30 days.
  const dayMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const lead of leads) {
    const day = lead.created_at.slice(0, 10);
    if (dayMap.has(day)) dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const perDay = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

  // Leads by network.
  const distMap = new Map<string, number>();
  for (const lead of leads) {
    distMap.set(lead.distributor, (distMap.get(lead.distributor) ?? 0) + 1);
  }
  const byDistributor = Array.from(distMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Total $ found across every check — a sum, not an average, so it grows
  // with volume; framed to Phil as "what the tool has surfaced", not revenue.
  const totalSavingsFound = savings.reduce((a, b) => a + b, 0);

  // Average saving found, grouped by network — which distributor areas tend
  // to have the most room to save.
  const savingByDistMap = new Map<string, { sum: number; count: number }>();
  for (const lead of leads) {
    if (lead.estimated_saving === null || Number.isNaN(lead.estimated_saving)) continue;
    const entry = savingByDistMap.get(lead.distributor) ?? { sum: 0, count: 0 };
    entry.sum += lead.estimated_saving;
    entry.count += 1;
    savingByDistMap.set(lead.distributor, entry);
  }
  const avgSavingByDistributor = Array.from(savingByDistMap.entries())
    .map(([name, { sum, count }]) => ({ name, avgSaving: sum / count }))
    .sort((a, b) => b.avgSaving - a.avgSaving);

  // How often each retailer comes out as the #1 cheapest match.
  const winsMap = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.best_retailer) continue;
    winsMap.set(lead.best_retailer, (winsMap.get(lead.best_retailer) ?? 0) + 1);
  }
  const winsByRetailer = Array.from(winsMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Average cheapest-match price, grouped by network.
  const bestTotalByDistMap = new Map<string, { sum: number; count: number }>();
  for (const lead of leads) {
    if (lead.best_total === null || Number.isNaN(lead.best_total)) continue;
    const entry = bestTotalByDistMap.get(lead.distributor) ?? { sum: 0, count: 0 };
    entry.sum += lead.best_total;
    entry.count += 1;
    bestTotalByDistMap.set(lead.distributor, entry);
  }
  const avgBestTotalByDistributor = Array.from(bestTotalByDistMap.entries())
    .map(([name, { sum, count }]) => ({ name, avgTotal: sum / count }))
    .sort((a, b) => a.avgTotal - b.avgTotal);

  const recent = leads.slice(0, 25);

  return {
    totalLeads,
    leadsThisWeek,
    avgSaving,
    avgSavingPct,
    totalSavingsFound,
    perDay,
    byDistributor,
    avgSavingByDistributor,
    winsByRetailer,
    avgBestTotalByDistributor,
    recent,
  };
}

export interface SubscriberRow {
  id: string;
  created_at: string;
  email: string;
  plan: string;
  status: string;
  amount_cents: number | null;
  currency: string;
  current_period_end: string | null;
}

export interface SubscriberStats {
  totalSubscribers: number;
  activeSubscribers: number;
  /** Sum of amounts captured at checkout. For subscriptions this is the
   * FIRST payment only — renewal payments aren't tracked yet (that needs a
   * Stripe `invoice.paid` webhook handler, not built in this pass), so treat
   * this as "collected via checkout so far", not true lifetime revenue. */
  totalCollectedCents: number;
  byPlan: { plan: string; count: number }[];
  /** Checkout revenue by day, last 30 days — first payments only (see
   * totalCollectedCents note above re: renewals not tracked yet). */
  revenuePerDay: { date: string; amountCents: number }[];
  recent: SubscriberRow[];
}

/**
 * Pure given `now`, same reasoning as computeDashboardStats above — "now"
 * stays in the Server Component caller, not here.
 */
export function computeSubscriberStats(subs: SubscriberRow[], now: Date = new Date()): SubscriberStats {
  const totalSubscribers = subs.length;
  const activeSubscribers = subs.filter((s) => s.status === "active").length;
  const totalCollectedCents = subs.reduce((sum, s) => sum + (s.amount_cents ?? 0), 0);

  const planMap = new Map<string, number>();
  for (const s of subs) planMap.set(s.plan, (planMap.get(s.plan) ?? 0) + 1);
  const byPlan = Array.from(planMap.entries())
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => b.count - a.count);

  // Revenue per day, last 30 days — mirrors perDay in computeDashboardStats.
  const revMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    revMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of subs) {
    const day = s.created_at.slice(0, 10);
    if (revMap.has(day)) revMap.set(day, (revMap.get(day) ?? 0) + (s.amount_cents ?? 0));
  }
  const revenuePerDay = Array.from(revMap.entries()).map(([date, amountCents]) => ({ date, amountCents }));

  const recent = subs.slice(0, 25);

  return { totalSubscribers, activeSubscribers, totalCollectedCents, byPlan, revenuePerDay, recent };
}

// --- Launch funnel (check_events + subscribers) ------------------------------
// Anonymous counts of checks started and finished (lib/track.ts), set against
// new members, overall and by where people came from. Powers the "Launch
// checkpoints" section of the owner dashboard.


export interface CheckEventRow {
  created_at: string;
  event: string;
  source: string | null;
}
export interface MemberSourceRow {
  created_at: string;
  status: string;
  source: string | null;
}
export interface FunnelWindow {
  label: string;
  started: number;
  completed: number;
  joinClicks: number;
  checkouts: number;
  members: number;
  /** New members ÷ finished checks; null when there are no finished checks. */
  conversion: number | null;
}
export interface SourceFunnelRow {
  label: string;
  completed: number;
  members: number;
  conversion: number | null;
}
export interface Checkpoint {
  label: string;
  due: string;
  target: number;
  actual: number;
  kind: "count" | "rate";
  met: boolean;
}
export interface FunnelStats {
  windows: FunnelWindow[];
  bySource: SourceFunnelRow[];
  checkpoints: Checkpoint[];
  firstEvent: string | null;
}

/** The targets from the launch plan (strategy notes, 18 Oct 2026). */
export const LAUNCH_CHECKPOINTS = [
  { key: "checks", label: "Finished checks", due: "31 January 2027", target: 1000 },
  { key: "conversion", label: "Finished checks that become members", due: "31 January 2027", target: 0.025 },
  { key: "members", label: "Active members", due: "30 April 2027", target: 100 },
] as const;

export function computeFunnelStats(
  events: CheckEventRow[],
  members: MemberSourceRow[],
  now: Date = new Date(),
  partnerName?: (code: string) => string | null,
): FunnelStats {
  const day = 86_400_000;
  const windowOf = (label: string, from: number): FunnelWindow => {
    const ev = events.filter((e) => new Date(e.created_at).getTime() >= from);
    const count = (name: string) => ev.filter((e) => e.event === name).length;
    const completed = count("check_completed");
    const joined = members.filter((m) => new Date(m.created_at).getTime() >= from).length;
    return {
      label,
      started: count("check_started"),
      completed,
      joinClicks: count("unlock_clicked"),
      checkouts: count("checkout_started"),
      members: joined,
      conversion: completed > 0 ? joined / completed : null,
    };
  };
  const t = now.getTime();
  const windows = [windowOf("Last 7 days", t - 7 * day), windowOf("Last 30 days", t - 30 * day), windowOf("Since launch", 0)];

  const bySourceMap = new Map<string, { completed: number; members: number }>();
  const bump = (raw: string | null, key: "completed" | "members") => {
    const label = sourceLabel(raw, partnerName);
    const row = bySourceMap.get(label) ?? { completed: 0, members: 0 };
    row[key]++;
    bySourceMap.set(label, row);
  };
  for (const e of events) if (e.event === "check_completed") bump(e.source, "completed");
  for (const m of members) bump(m.source, "members");
  const bySource = Array.from(bySourceMap.entries())
    .map(([label, r]) => ({ label, ...r, conversion: r.completed > 0 ? r.members / r.completed : null }))
    .sort((a, b) => b.completed - a.completed || b.members - a.members);

  const all = windows[2];
  const active = members.filter((m) => m.status === "active").length;
  const checkpoints: Checkpoint[] = LAUNCH_CHECKPOINTS.map((c) => {
    const actual = c.key === "checks" ? all.completed : c.key === "conversion" ? all.conversion ?? 0 : active;
    return { label: c.label, due: c.due, target: c.target, actual, kind: c.key === "conversion" ? "rate" : "count", met: actual >= c.target };
  });

  const times = events.map((e) => e.created_at).sort();
  return { windows, bySource, checkpoints, firstEvent: times[0] ?? null };
}

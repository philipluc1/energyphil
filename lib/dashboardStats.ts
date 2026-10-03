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
  perDay: { date: string; count: number }[];
  byDistributor: { name: string; count: number }[];
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

  const recent = leads.slice(0, 25);

  return { totalLeads, leadsThisWeek, avgSaving, avgSavingPct, perDay, byDistributor, recent };
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
  recent: SubscriberRow[];
}

/** Pure, like computeDashboardStats above — no implicit "now". */
export function computeSubscriberStats(subs: SubscriberRow[]): SubscriberStats {
  const totalSubscribers = subs.length;
  const activeSubscribers = subs.filter((s) => s.status === "active").length;
  const totalCollectedCents = subs.reduce((sum, s) => sum + (s.amount_cents ?? 0), 0);

  const planMap = new Map<string, number>();
  for (const s of subs) planMap.set(s.plan, (planMap.get(s.plan) ?? 0) + 1);
  const byPlan = Array.from(planMap.entries())
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => b.count - a.count);

  const recent = subs.slice(0, 25);

  return { totalSubscribers, activeSubscribers, totalCollectedCents, byPlan, recent };
}

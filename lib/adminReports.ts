// Owner dashboard reports (2 Nov 2026): recurring revenue, churn, cohorts,
// cancellation reasons and the "got a result but didn't join" list. Pure
// functions over rows from Supabase, so they can be tested without a database.

import { findPlan } from "./pricingPlans";

export interface MemberRow {
  id: string;
  created_at: string;
  email: string;
  plan: string;
  status: string; // 'active' | 'past_due' | 'canceled'
  amount_cents: number;
  current_period_end: string | null;
  canceled_at?: string | null;
  cancel_at?: string | null;
  cancel_reason?: string | null;
  customer_name?: string | null;
  source?: string | null;
}

export interface LeadLite {
  created_at: string;
  email: string;
  estimated_saving: number | null;
  distributor: string | null;
  unsubscribed?: boolean | null;
}

const DAY = 86_400_000;
const isLive = (s: string) => s === "active" || s === "past_due";

/** What a membership is worth a month, in cents (a once-off payment is 0). */
export function monthlyValueCents(plan: string, amountCents: number): number {
  const p = findPlan(plan);
  if (!p || plan === "once_off") return 0;
  const months = p.interval === "month" ? p.intervalCount ?? 1 : 12;
  return Math.round(amountCents / Math.max(1, months));
}

/** One row per person: their live membership if they have one, else the newest. */
export function latestPerEmail(rows: MemberRow[]): MemberRow[] {
  const by = new Map<string, MemberRow>();
  for (const r of rows) {
    const k = r.email.trim().toLowerCase();
    const cur = by.get(k);
    if (!cur) { by.set(k, r); continue; }
    const better = isLive(r.status) !== isLive(cur.status) ? isLive(r.status) : r.created_at > cur.created_at;
    if (better) by.set(k, r);
  }
  return [...by.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** When a cancelled membership stopped: the scheduled end (cancel at period end),
 * else the cancel date, else the end of what they paid for. */
export function churnDate(m: MemberRow): Date | null {
  if (m.status !== "canceled") return null;
  const iso = m.cancel_at ?? m.canceled_at ?? m.current_period_end ?? m.created_at;
  return new Date(iso);
}

export interface Revenue {
  mrrCents: number;
  arrCents: number;
  active: number;
  pastDue: number;
  /** Still active but set to end at the close of their paid period. */
  cancelling: number;
  byPlan: { plan: string; count: number; mrrCents: number }[];
}

export function revenue(rows: MemberRow[], now: Date = new Date()): Revenue {
  const people = latestPerEmail(rows);
  const byPlan = new Map<string, { count: number; mrrCents: number }>();
  let mrr = 0, active = 0, pastDue = 0, cancelling = 0;
  for (const m of people) {
    if (m.status === "past_due") pastDue++;
    if (m.status !== "active") continue;
    active++;
    if (m.cancel_at && new Date(m.cancel_at) > now) cancelling++;
    const v = monthlyValueCents(m.plan, m.amount_cents);
    mrr += v;
    const b = byPlan.get(m.plan) ?? { count: 0, mrrCents: 0 };
    b.count++; b.mrrCents += v;
    byPlan.set(m.plan, b);
  }
  return {
    mrrCents: mrr,
    arrCents: mrr * 12,
    active,
    pastDue,
    cancelling,
    byPlan: [...byPlan.entries()].map(([plan, b]) => ({ plan, ...b })).sort((a, b) => b.mrrCents - a.mrrCents),
  };
}

/** "2026-11" in Melbourne time. */
export function monthKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" });
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

export interface CohortRow {
  month: string;
  joined: number;
  /** Share still paying after each offset; null when that point hasn't been reached yet. */
  retained: (number | null)[];
}

export const COHORT_OFFSETS = [1, 2, 3, 6] as const;

/** Members grouped by the month they joined, and the share still paying 1, 2, 3 and 6 months on. */
export function cohorts(rows: MemberRow[], now: Date = new Date(), offsets: readonly number[] = COHORT_OFFSETS, maxMonths = 12): CohortRow[] {
  // Each person once, from their first paid membership; once-off payments aren't subscriptions.
  const first = new Map<string, MemberRow[]>();
  for (const r of rows) {
    if (r.plan === "once_off") continue;
    const k = r.email.trim().toLowerCase();
    first.set(k, [...(first.get(k) ?? []), r]);
  }
  const groups = new Map<string, { start: Date; end: Date | null }[]>();
  for (const list of first.values()) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const start = new Date(list[0].created_at);
    // They're "still paying" while any of their memberships is live.
    const live = list.some((m) => isLive(m.status));
    const end = live ? null : list.map(churnDate).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? start;
    const key = monthKey(start);
    groups.set(key, [...(groups.get(key) ?? []), { start, end }]);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, maxMonths)
    .map(([month, people]) => ({
      month,
      joined: people.length,
      retained: offsets.map((n) => {
        const due = people.filter((p) => addMonths(p.start, n) <= now);
        if (due.length < people.length) return null; // not everyone has reached this point yet
        const kept = due.filter((p) => !p.end || p.end > addMonths(p.start, n)).length;
        return due.length ? kept / due.length : null;
      }),
    }));
}

export interface ChurnMonth {
  month: string;
  joined: number;
  cancelled: number;
  /** Members at the start of the month. */
  atStart: number;
  /** cancelled / atStart, or null with nobody at the start. */
  rate: number | null;
}

/** Joins and cancellations for each of the last few months. */
export function churnByMonth(rows: MemberRow[], now: Date = new Date(), months = 6): ChurnMonth[] {
  const people = rows.filter((r) => r.plan !== "once_off");
  const out: ChurnMonth[] = [];
  const thisKey = monthKey(now);
  const [y, m] = thisKey.split("-").map(Number);
  for (let i = months - 1; i >= 0; i--) {
    // Month boundaries in Melbourne, approximated at UTC midnight minus 11 hours.
    const start = new Date(Date.UTC(y, m - 1 - i, 1) - 11 * 3600_000);
    const end = new Date(Date.UTC(y, m - i, 1) - 11 * 3600_000);
    const key = monthKey(new Date(start.getTime() + 2 * DAY));
    let joined = 0, cancelled = 0, atStart = 0;
    for (const r of people) {
      const c = new Date(r.created_at);
      const ch = churnDate(r);
      if (c >= start && c < end) joined++;
      if (ch && ch >= start && ch < end) cancelled++;
      if (c < start && (!ch || ch >= start)) atStart++;
    }
    out.push({ month: key, joined, cancelled, atStart, rate: atStart ? cancelled / atStart : null });
  }
  return out;
}

const REASON_LABEL: Record<string, string> = {
  too_expensive: "Too expensive",
  missing_features: "Missing features",
  switched_service: "Switched to another service",
  unused: "Not using it enough",
  customer_service: "Customer service",
  too_complex: "Too complicated",
  low_quality: "Not good enough",
  other: "Other",
};

export function reasonLabel(code: string | null | undefined): string {
  if (!code) return "No reason given";
  return REASON_LABEL[code] ?? code;
}

export function cancelReasons(rows: MemberRow[]): { reason: string; count: number }[] {
  const by = new Map<string, number>();
  for (const r of latestPerEmail(rows)) {
    if (r.status !== "canceled" && !r.cancel_at) continue;
    const k = reasonLabel(r.cancel_reason);
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  return [...by.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

export interface AbandonedLead {
  email: string;
  created_at: string;
  saving: number | null;
  distributor: string | null;
  /** They asked for no more emails: don't contact them. */
  unsubscribed: boolean;
  /** How many free checks they ran in the window. */
  checks: number;
}

/** People who left an email for their result but never became a member, newest first. */
export function abandonedLeads(leads: LeadLite[], members: MemberRow[], now: Date = new Date(), days = 60): AbandonedLead[] {
  const joined = new Set(members.map((m) => m.email.trim().toLowerCase()));
  const since = now.getTime() - days * DAY;
  const by = new Map<string, AbandonedLead>();
  for (const l of leads) {
    const k = l.email.trim().toLowerCase();
    if (!k || joined.has(k) || new Date(l.created_at).getTime() < since) continue;
    const cur = by.get(k);
    if (!cur) {
      by.set(k, { email: k, created_at: l.created_at, saving: l.estimated_saving, distributor: l.distributor, unsubscribed: !!l.unsubscribed, checks: 1 });
      continue;
    }
    cur.checks++;
    if (l.unsubscribed) cur.unsubscribed = true;
    if (l.created_at > cur.created_at) Object.assign(cur, { created_at: l.created_at, saving: l.estimated_saving, distributor: l.distributor });
  }
  return [...by.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** "p***@gmail.com": enough to recognise a deleted member in the admin log, no more. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}

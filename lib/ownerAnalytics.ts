// Owner dashboard analytics (9 Nov 2026): members growth, the funnel by week,
// ad payback by channel, plan vs actual, recurring revenue and cash ahead,
// value delivered and members at risk. Pure functions over rows from Supabase,
// so they're tested without a database (ownerAnalytics.test.ts).

import { churnDate, monthKey, monthLabel, monthlyValueCents, type MemberRow } from "./adminReports";
import { sourceKind } from "./adminFilters";
import { foundTotals } from "./moneyFound";
import type { PlanMonth } from "./planTargets";

const DAY = 86_400_000;
export type Unit = "week" | "month";

// ---------- periods (Melbourne calendar) ----------
const melDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(d); // yyyy-mm-dd

/** "2026-11" for a month; the Monday "2026-11-09" for a week. */
export function periodKey(d: Date, unit: Unit): string {
  if (unit === "month") return monthKey(d);
  const t = Date.parse(`${melDay(d)}T00:00:00Z`);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * DAY).toISOString().slice(0, 10);
}

/** The last n period keys, oldest first, ending with the one `now` is in. */
export function periodKeys(unit: Unit, n: number, now: Date): string[] {
  const cur = periodKey(now, unit);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    if (unit === "week") out.push(new Date(Date.parse(`${cur}T00:00:00Z`) - i * 7 * DAY).toISOString().slice(0, 10));
    else {
      const [y, m] = cur.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
  }
  return out;
}

export function periodLabel(key: string, unit: Unit): string {
  if (unit === "month") return monthLabel(key).replace(/ (\d\d)(\d\d)$/, " $2");
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** When a period ends (Melbourne midnight, near enough: AEST/AEDT differ by an hour). */
export function periodEndMs(key: string, unit: Unit): number {
  const MEL = 10 * 3_600_000;
  if (unit === "week") return Date.parse(`${key}T00:00:00Z`) + 7 * DAY - MEL;
  const [y, m] = key.split("-").map(Number);
  return Date.UTC(y, m, 1) - MEL;
}

// ---------- memberships ----------
const isYearly = (plan: string) => plan === "annual";
const liveAt = (m: MemberRow, t: number) => {
  if (Date.parse(m.created_at) > t) return false;
  if (m.status === "incomplete") return false;
  const end = churnDate(m);
  return !end || end.getTime() > t;
};
/** Paying people at a moment (one per email). */
export function payingAt(members: MemberRow[], t: number): MemberRow[] {
  const by = new Map<string, MemberRow>();
  for (const m of members) if (liveAt(m, t)) by.set(m.email.trim().toLowerCase(), m);
  return [...by.values()];
}

export interface GrowthPoint { key: string; label: string; newYearly: number; newMonthly: number; cancelled: number; paying: number; checks: number }
export interface EventLite { created_at: string; event: string; source?: string | null; sid?: string }

/** New members (yearly / monthly), cancellations and paying members at the end of each period, plus free checks finished. */
export function growthSeries(members: MemberRow[], events: EventLite[], unit: Unit, n: number, now: Date): GrowthPoint[] {
  const keys = periodKeys(unit, n, now);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const pts: GrowthPoint[] = keys.map((k) => ({ key: k, label: periodLabel(k, unit), newYearly: 0, newMonthly: 0, cancelled: 0, paying: 0, checks: 0 }));
  for (const m of members) {
    if (m.status === "incomplete") continue;
    const i = idx.get(periodKey(new Date(m.created_at), unit));
    if (i !== undefined) { if (isYearly(m.plan)) pts[i].newYearly++; else pts[i].newMonthly++; }
    const end = churnDate(m);
    if (end && end.getTime() <= now.getTime()) {
      const j = idx.get(periodKey(end, unit));
      if (j !== undefined) pts[j].cancelled--;
    }
  }
  for (const e of events) {
    if (e.event !== "check_completed") continue;
    const i = idx.get(periodKey(new Date(e.created_at), unit));
    if (i !== undefined) pts[i].checks++;
  }
  pts.forEach((p) => { p.paying = payingAt(members, Math.min(periodEndMs(p.key, unit), now.getTime())).length; });
  return pts;
}

// ---------- funnel by week ----------
export interface FunnelWeek { key: string; label: string; visitors: number; started: number; completed: number; emailed: number; checkout: number; paid: number; conversion: number | null }
export function funnelWeeks(
  views: { created_at: string; sid: string }[], events: EventLite[], leads: { created_at: string }[], members: MemberRow[], n: number, now: Date,
): FunnelWeek[] {
  const keys = periodKeys("week", n, now);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const rows: FunnelWeek[] = keys.map((k) => ({ key: k, label: periodLabel(k, "week"), visitors: 0, started: 0, completed: 0, emailed: 0, checkout: 0, paid: 0, conversion: null }));
  const sids = keys.map(() => new Set<string>());
  const at = (iso: string) => idx.get(periodKey(new Date(iso), "week"));
  for (const v of views) { const i = at(v.created_at); if (i !== undefined) sids[i].add(v.sid); }
  for (const e of events) {
    const i = at(e.created_at); if (i === undefined) continue;
    if (e.event === "check_started") rows[i].started++;
    else if (e.event === "check_completed") rows[i].completed++;
    else if (e.event === "checkout_started") rows[i].checkout++;
  }
  for (const l of leads) { const i = at(l.created_at); if (i !== undefined) rows[i].emailed++; }
  for (const m of members) { if (m.status === "incomplete") continue; const i = at(m.created_at); if (i !== undefined) rows[i].paid++; }
  rows.forEach((r, i) => { r.visitors = sids[i].size; r.conversion = r.completed > 0 ? r.paid / r.completed : null; });
  return rows;
}

// ---------- channels and ad payback ----------
export const SPEND_CHANNELS = ["Meta", "ChatGPT", "Google", "Other ads"] as const;
const UTM: Record<string, string> = { meta: "Meta", facebook: "Meta", fb: "Meta", instagram: "Meta", ig: "Meta", chatgpt: "ChatGPT", openai: "ChatGPT", google: "Google" };

/** Where someone came from, as a channel name: Direct, Referrals, Partners, Meta, ChatGPT, Google, Other ads. */
export function channelOf(raw: string | null | undefined): string {
  const k = sourceKind(raw);
  if (k === "referral") return "Referrals";
  if (k === "partner") return "Partners";
  if (k !== "ads") return "Direct";
  const utm = (raw ?? "").slice(2).split("/")[0].toLowerCase();
  return UTM[utm] ?? "Other ads";
}

/** Regular prices (from 1 Feb 2027) and the yearly share used in the financial model. */
export const REGULAR = { yearlyCents: 5500, monthlyCents: 900, yearlyShare: 0.7 };
/** What a new member leaves in their first year after GST, Stripe (1.65% + 0.7% + 30c a payment): the most a member can cost to win and still break even in a year. */
export function breakEvenPerMember(r = REGULAR): number {
  const net = (price: number, payments: number) => price * (10 / 11) - price * 0.0235 - 0.3 * payments;
  return r.yearlyShare * net(r.yearlyCents / 100, 1) + (1 - r.yearlyShare) * net((r.monthlyCents / 100) * 12, 12);
}

export interface SpendRow { month: string; channel: string; amount: number }
export interface ChannelRow { channel: string; checks: number; members: number; conversion: number | null; spend: number | null; costPerCheck: number | null; costPerMember: number | null; paysBackInYear: boolean | null }
export function channelPayback(events: EventLite[], members: MemberRow[], spend: SpendRow[], fromMs: number | null): ChannelRow[] {
  const inRange = (iso: string) => fromMs === null || Date.parse(iso) >= fromMs;
  const fromMonth = fromMs === null ? null : monthKey(new Date(fromMs));
  const map = new Map<string, ChannelRow>();
  const row = (c: string) => map.get(c) ?? (map.set(c, { channel: c, checks: 0, members: 0, conversion: null, spend: null, costPerCheck: null, costPerMember: null, paysBackInYear: null }), map.get(c)!);
  for (const e of events) if (e.event === "check_completed" && inRange(e.created_at)) row(channelOf(e.source)).checks++;
  for (const m of members) if (m.status !== "incomplete" && inRange(m.created_at)) row(channelOf(m.source)).members++;
  for (const s of spend) {
    if (fromMonth && s.month.slice(0, 7) < fromMonth) continue;
    const r = row(s.channel);
    r.spend = (r.spend ?? 0) + Number(s.amount || 0);
  }
  const be = breakEvenPerMember();
  const order = ["Direct", "Referrals", "Partners", ...SPEND_CHANNELS];
  return [...map.values()].map((r) => {
    r.conversion = r.checks ? r.members / r.checks : null;
    if (r.spend !== null && r.spend > 0) {
      r.costPerCheck = r.checks ? r.spend / r.checks : null;
      r.costPerMember = r.members ? r.spend / r.members : null;
      r.paysBackInYear = r.costPerMember === null ? false : r.costPerMember <= be;
    }
    return r;
  }).sort((a, b) => order.indexOf(a.channel) - order.indexOf(b.channel));
}

// ---------- plan vs actual ----------
export interface PlanRow { month: string; label: string; partial: boolean; target: PlanMonth; checks: number; newMembers: number; active: number; salesIncGst: number; status: "ahead" | "close" | "behind" }
/** Payments in a month, estimated from memberships: monthly plans pay every month they're live; yearly plans in the month they join and on each anniversary. */
export function salesInMonth(members: MemberRow[], key: string): number {
  const [y, m] = key.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1), end = Date.UTC(y, m, 1);
  let cents = 0;
  for (const r of members) {
    if (r.status === "incomplete" || !r.amount_cents) continue;
    const c = Date.parse(r.created_at);
    if (c >= end) continue;
    const stop = churnDate(r)?.getTime() ?? Infinity;
    if (isYearly(r.plan)) {
      const cm = new Date(c);
      const anniv = cm.getUTCMonth() === m - 1 && cm.getUTCFullYear() <= y;
      if (anniv && Date.UTC(y, m - 1, cm.getUTCDate()) < stop) cents += r.amount_cents;
    } else if (r.plan === "monthly") {
      if (stop > start) cents += r.amount_cents;
    } else if (c >= start) cents += r.amount_cents;
  }
  return cents / 100;
}
export function planVsActual(targets: PlanMonth[], events: EventLite[], members: MemberRow[], now: Date): PlanRow[] {
  const cur = monthKey(now);
  const out: PlanRow[] = [];
  for (const t of targets) {
    if (t.month > cur) break;
    const partial = t.month === cur;
    const [y, m] = t.month.split("-").map(Number);
    const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const share = partial ? Math.min(1, Number(melDay(now).slice(8, 10)) / daysIn) : 1;
    const checks = events.filter((e) => e.event === "check_completed" && monthKey(new Date(e.created_at)) === t.month).length;
    const newMembers = members.filter((r) => r.status !== "incomplete" && monthKey(new Date(r.created_at)) === t.month).length;
    const endMs = partial ? now.getTime() : periodEndMs(t.month, "month");
    const active = payingAt(members, endMs).length;
    const salesIncGst = salesInMonth(members, t.month);
    // Score on members joining (the lead indicator), against the target so far this month.
    const ratio = t.newMembers * share > 0 ? newMembers / (t.newMembers * share) : 1;
    out.push({ month: t.month, label: monthLabel(t.month), partial, target: t, checks, newMembers, active, salesIncGst, status: ratio >= 1 ? "ahead" : ratio >= 0.8 ? "close" : "behind" });
  }
  return out;
}

// ---------- revenue and cash ahead ----------
export interface MrrPoint { key: string; label: string; mrr: number; yearly: number; monthly: number }
export function mrrTrend(members: MemberRow[], n: number, now: Date): MrrPoint[] {
  return periodKeys("month", n, now).map((k) => {
    const t = Math.min(periodEndMs(k, "month"), now.getTime());
    const live = payingAt(members, t);
    let yearly = 0, monthly = 0;
    for (const m of live) { const v = monthlyValueCents(m.plan, m.amount_cents) / 100; if (isYearly(m.plan)) yearly += v; else monthly += v; }
    return { key: k, label: periodLabel(k, "month"), mrr: yearly + monthly, yearly, monthly };
  });
}

export interface MixRow { name: string; members: number }
/** Paying members by plan and by price (New Year special or regular). */
export function priceMix(members: MemberRow[], now: Date): MixRow[] {
  const live = payingAt(members, now.getTime()).filter((m) => m.status === "active" || m.status === "past_due");
  const c = { ys: 0, yr: 0, ms: 0, mr: 0, other: 0 };
  for (const m of live) {
    if (isYearly(m.plan)) { if (m.amount_cents < REGULAR.yearlyCents) c.ys++; else c.yr++; }
    else if (m.plan === "monthly") { if (m.amount_cents < REGULAR.monthlyCents) c.ms++; else c.mr++; }
    else c.other++;
  }
  return [
    { name: "Yearly, New Year special", members: c.ys }, { name: "Yearly, regular", members: c.yr },
    { name: "Monthly, New Year special", members: c.ms }, { name: "Monthly, regular", members: c.mr },
    ...(c.other ? [{ name: "Other plans", members: c.other }] : []),
  ];
}

export interface RenewalWindow { days: number; yearlyCount: number; yearly: number; monthlyPayments: number; monthly: number; total: number }
/** Payments due in the next 30/60/90 days from members not set to cancel. */
export function renewalsAhead(members: MemberRow[], now: Date, windows = [30, 60, 90]): RenewalWindow[] {
  const live = payingAt(members, now.getTime()).filter((m) => m.status === "active" && !(m.cancel_at && Date.parse(m.cancel_at) > now.getTime()) && m.current_period_end);
  return windows.map((days) => {
    const until = now.getTime() + days * DAY;
    const w: RenewalWindow = { days, yearlyCount: 0, yearly: 0, monthlyPayments: 0, monthly: 0, total: 0 };
    for (const m of live) {
      const p = new Date(m.current_period_end!);
      if (isYearly(m.plan)) {
        if (p.getTime() > now.getTime() && p.getTime() <= until) { w.yearlyCount++; w.yearly += m.amount_cents / 100; }
      } else if (m.plan === "monthly") {
        const d = new Date(p.getTime());
        while (d.getTime() <= now.getTime()) d.setUTCMonth(d.getUTCMonth() + 1);
        while (d.getTime() <= until) { w.monthlyPayments++; w.monthly += m.amount_cents / 100; d.setUTCMonth(d.getUTCMonth() + 1); }
      }
    }
    w.total = w.yearly + w.monthly;
    return w;
  });
}

/** Bill reads by month and their AI cost (about 2c a read). */
export const AI_COST_PER_READ = 0.02;
export function readsByMonth(reads: { created_at: string }[], n: number, now: Date): { key: string; label: string; reads: number; cost: number }[] {
  const keys = periodKeys("month", n, now);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const out = keys.map((k) => ({ key: k, label: periodLabel(k, "month"), reads: 0, cost: 0 }));
  for (const r of reads) { const i = idx.get(monthKey(new Date(r.created_at))); if (i !== undefined) out[i].reads++; }
  out.forEach((o) => { o.cost = o.reads * AI_COST_PER_READ; });
  return out;
}

// ---------- value delivered and churn risk ----------
export interface MemberDetail extends MemberRow {
  bill_inbox?: string | null;
  inbox_last_at?: string | null;
  money_found?: unknown;
  last_notified_at?: string | null;
  switched_at?: string | null;
}
export interface ValueDelivered {
  paying: number;
  forwardingSetUp: number;
  forwardedABill: number;
  billsByWeek: { key: string; label: string; bills: number }[];
  thingsCaught: number;
  feesToAskBack: number;
  onOfferYear: number;
  alerts30: number;
  switched: number;
}
export function valueDelivered(members: MemberDetail[], bills: { created_at: string }[], now: Date, weeks = 8): ValueDelivered {
  const live = payingAt(members, now.getTime()) as MemberDetail[];
  const keys = periodKeys("week", weeks, now);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const billsByWeek = keys.map((k) => ({ key: k, label: periodLabel(k, "week"), bills: 0 }));
  for (const b of bills) { const i = idx.get(periodKey(new Date(b.created_at), "week")); if (i !== undefined) billsByWeek[i].bills++; }
  let caught = 0, back = 0, offer = 0;
  for (const m of live) { const t = foundTotals(m.money_found); caught += t.caught; back += t.back; offer += t.onOfferYear; }
  return {
    paying: live.length,
    forwardingSetUp: live.filter((m) => !!m.bill_inbox).length,
    forwardedABill: live.filter((m) => !!m.inbox_last_at).length,
    billsByWeek,
    thingsCaught: caught, feesToAskBack: back, onOfferYear: offer,
    alerts30: live.filter((m) => m.last_notified_at && now.getTime() - Date.parse(m.last_notified_at) <= 30 * DAY).length,
    switched: live.filter((m) => !!m.switched_at).length,
  };
}

export interface RiskRow { email: string; name: string | null; plan: string; joined: string; renews: string | null; reasons: string[]; score: number }
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" });
/** Paying members worth a look, most urgent first. */
export function atRisk(members: MemberDetail[], bills: { email: string; created_at: string }[], now: Date): RiskRow[] {
  const lastBill = new Map<string, number>();
  for (const b of bills) { const k = b.email.trim().toLowerCase(); lastBill.set(k, Math.max(lastBill.get(k) ?? 0, Date.parse(b.created_at))); }
  const out: RiskRow[] = [];
  for (const m of payingAt(members, now.getTime()) as MemberDetail[]) {
    const reasons: string[] = []; let score = 0;
    const age = (now.getTime() - Date.parse(m.created_at)) / DAY;
    if (m.status === "past_due") { reasons.push("Payment failed"); score += 3; }
    if (m.cancel_at && Date.parse(m.cancel_at) > now.getTime()) { reasons.push(`Set to cancel ${fmtDay(m.cancel_at)}`); score += 3; }
    const lb = lastBill.get(m.email.trim().toLowerCase());
    if (!lb && age > 14) { reasons.push("No bill yet"); score += 2; }
    else if (lb && now.getTime() - lb > 120 * DAY) { reasons.push(`No bill in ${Math.round((now.getTime() - lb) / DAY)} days`); score += 2; }
    if (!m.bill_inbox && age > 14) { reasons.push("Forwarding not set up"); score += 1; }
    const renew = m.current_period_end && isYearly(m.plan) && !m.cancel_at && Date.parse(m.current_period_end) - now.getTime() <= 30 * DAY && Date.parse(m.current_period_end) > now.getTime();
    if (renew) { reasons.push(`Renews ${fmtDay(m.current_period_end!)}`); score += 1; }
    if (reasons.length && (score >= 2 || renew)) out.push({ email: m.email, name: m.customer_name ?? null, plan: m.plan, joined: m.created_at, renews: m.current_period_end ?? null, reasons, score });
  }
  return out.sort((a, b) => b.score - a.score || (a.renews ?? "9").localeCompare(b.renews ?? "9"));
}

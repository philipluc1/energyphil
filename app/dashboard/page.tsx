import { computeDashboardStats, computeFunnelStats, computeSubscriberStats, LeadRow, SubscriberRow, type CheckEventRow, type MemberSourceRow } from "@/lib/dashboardStats";
import { partnerName } from "@/lib/partners";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DashboardCharts from "./DashboardCharts";
import GrowthSections, { type AbandonedCheckout } from "./GrowthSections";
import { abandonedLeads, cancelReasons, churnByMonth, churnDate, cohorts, revenue, type LeadLite, type MemberRow } from "@/lib/adminReports";
import { fromSource, inPeriod, monthsFor, onPlan, parseFilters, periodDays, periodStart } from "@/lib/adminFilters";
import { stripe } from "@/lib/stripeClient";
import styles from "./dashboard.module.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";

// Always hit the database fresh — this is a live admin view, never cached.
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Second check alongside middleware.ts, so the leads list is never served without the password.
  if (!(await dashCookieValid((await cookies()).get(DASH_COOKIE)?.value))) redirect("/dashboard/login");
  if (!supabaseAdmin) {
    return (
      <div className={styles.wrap}>
        <div className={styles.notice}>
          The dashboard isn&apos;t connected yet — the server is missing its Supabase secret key
          (<code>SUPABASE_SECRET_KEY</code> in Vercel&apos;s Environment Variables).
        </div>
      </div>
    );
  }
  const db = supabaseAdmin;
  // Filters (2 Nov 2026): period, plan and where people came from, from the address.
  const f = parseFilters(await searchParams);
  // Shared "now" so every window lines up exactly.
  const now = new Date();
  const since = periodStart(f, now);

  // Leads: the period and source filters apply (leads have no plan). An older
  // database without leads.source still loads, unfiltered by source.
  const LEAD_COLS = "id, created_at, email, distributor, current_bill, best_retailer, best_plan_name, best_total, estimated_saving, estimated_saving_pct";
  const leadQuery = (cols: string) => {
    let q = db.from("leads").select(cols).order("created_at", { ascending: false }).limit(5000);
    if (since) q = q.gte("created_at", new Date(since).toISOString());
    return q;
  };
  let leadRes = await leadQuery(`${LEAD_COLS}, source`);
  if (leadRes.error) leadRes = await leadQuery(LEAD_COLS);
  if (leadRes.error) {
    return (
      <div className={styles.wrap}>
        <div className={styles.notice}>Couldn&apos;t load leads: {leadRes.error.message}</div>
      </div>
    );
  }
  const leads = fromSource((leadRes.data ?? []) as unknown as (LeadRow & { source?: string | null })[], f);
  const stats = computeDashboardStats(leads, now);

  // Every membership, once; the sections below each take the slice they need.
  const BASE = "id, created_at, email, plan, status, amount_cents, currency, current_period_end, customer_name, source";
  const full = await db.from("subscribers").select(`${BASE}, canceled_at, cancel_at, cancel_reason`).order("created_at", { ascending: false }).limit(10000);
  const memData: unknown[] | null = full.error
    ? (await db.from("subscribers").select(BASE).order("created_at", { ascending: false }).limit(10000)).data
      ?? (await db.from("subscribers").select("id, created_at, email, plan, status, amount_cents, currency, current_period_end").order("created_at", { ascending: false }).limit(10000)).data
    : full.data;
  const allMembers = (memData ?? []) as (MemberRow & { currency?: string })[];
  // Plan and source apply everywhere; the period applies to things that happened in it.
  const members = fromSource(onPlan(allMembers, f), f);
  const joinedInPeriod = inPeriod(members, f, now);
  const subscriberStats = computeSubscriberStats(joinedInPeriod.map((m) => ({ ...m, currency: m.currency ?? "aud" })) as SubscriberRow[], now);

  // Launch funnel: anonymous check counts against new members. The launch
  // checkpoints are fixed targets, so they always use everything.
  const { data: evData } = await db.from("check_events").select("created_at, event, source").order("created_at", { ascending: false }).limit(50000);
  const events = (evData ?? []) as CheckEventRow[];
  const toSourceRows = (rows: MemberRow[]): MemberSourceRow[] => rows.map((r) => ({ created_at: r.created_at, status: r.status, source: r.source ?? null }));
  const funnel = computeFunnelStats(fromSource(inPeriod(events, f, now), f), toSourceRows(joinedInPeriod), now, partnerName);
  funnel.checkpoints = computeFunnelStats(events, toSourceRows(allMembers), now, partnerName).checkpoints;

  // The "didn't join" lists cover the period (up to a year of results, 90 days of checkouts).
  const days = periodDays(f);
  const leadDays = Math.min(days ?? 365, 365);
  const abQuery = (cols: string) => db.from("leads").select(cols).gte("created_at", new Date(now.getTime() - leadDays * 86_400_000).toISOString()).order("created_at", { ascending: false }).limit(5000);
  let abRes = await abQuery("created_at, email, estimated_saving, distributor, unsubscribed, source");
  if (abRes.error) abRes = await abQuery("created_at, email, estimated_saving, distributor, unsubscribed");
  // Anyone who ever joined counts as joined, whatever the filters.
  const abandoned = abandonedLeads(fromSource((abRes.data ?? []) as unknown as (LeadLite & { source?: string | null })[], f), allMembers, now, leadDays);
  const checkoutDays = Math.min(days ?? 90, 90);
  const { checkouts, note } = await unpaidCheckouts(allMembers, now, checkoutDays, f.plan);
  const months = monthsFor(f);

  return (
    <DashboardCharts stats={stats} subscriberStats={subscriberStats} funnel={funnel} filters={f}>
      <GrowthSections
        rev={revenue(members, now)}
        churn={churnByMonth(members, now, months)}
        cohorts={cohorts(members, now, undefined, months)}
        reasons={cancelReasons(since ? members.filter((m) => { const d = churnDate(m) ?? (m.cancel_at ? new Date(m.canceled_at ?? m.cancel_at) : null); return !!d && d.getTime() >= since; }) : members)}
        abandoned={abandoned}
        abandonedDays={leadDays}
        checkouts={checkouts}
        checkoutDays={checkoutDays}
        checkoutsNote={note}
      />
    </DashboardCharts>
  );
}

/** Stripe checkouts in the period that expired unpaid, for people who never became members. */
async function unpaidCheckouts(members: MemberRow[], now: Date, days: number, plan: string): Promise<{ checkouts: AbandonedCheckout[]; note: string | null }> {
  if (!stripe) return { checkouts: [], note: "Stripe isn't connected on this server." };
  const joined = new Set(members.map((m) => m.email.trim().toLowerCase()));
  try {
    const list = await stripe.checkout.sessions.list({ limit: 100, created: { gte: Math.floor(now.getTime() / 1000) - days * 86_400 } });
    const seen = new Set<string>();
    const out: AbandonedCheckout[] = [];
    for (const s of list.data) {
      const email = (s.customer_details?.email ?? s.customer_email ?? "").trim().toLowerCase();
      if (!email || s.status !== "expired" || s.payment_status === "paid" || joined.has(email) || seen.has(email)) continue;
      if (plan !== "all" && s.metadata?.planId !== plan) continue;
      seen.add(email);
      out.push({ email, created: new Date(s.created * 1000).toISOString(), plan: s.metadata?.planId ?? null });
    }
    return { checkouts: out, note: null };
  } catch (e) {
    return { checkouts: [], note: `Couldn't reach Stripe: ${(e as Error).message}` };
  }
}

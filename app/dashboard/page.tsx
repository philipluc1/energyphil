import { computeDashboardStats, computeFunnelStats, computeSubscriberStats, LeadRow, SubscriberRow, type CheckEventRow, type MemberSourceRow } from "@/lib/dashboardStats";
import { partnerName } from "@/lib/partners";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DashboardCharts from "./DashboardCharts";
import GrowthSections, { type AbandonedCheckout } from "./GrowthSections";
import { abandonedLeads, cancelReasons, churnByMonth, churnDate, cohorts, revenue, type LeadLite, type MemberRow } from "@/lib/adminReports";
import { PERIODS, fromSource, inPeriod, monthsFor, onPlan, parseFilters, periodDays, periodStart } from "@/lib/adminFilters";
import { LIVE_WINDOW_MS, liveNow, visitReport, type ViewRow } from "@/lib/visits";
import VisitorsSection from "./VisitorsSection";
import ReviewsSection from "./ReviewsSection";
import { reviewUrl } from "@/lib/reviews";
import { stripe } from "@/lib/stripeClient";
import styles from "./dashboard.module.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";
import { schemaHealth } from "@/lib/schemaHealth";

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

  // Invite buttons (2 Nov 2026): who's a member, unsubscribed or already invited, for the leads on screen.
  const shown = Array.from(new Set([...stats.recent.map((l) => l.email), ...abandoned.slice(0, 200).map((a) => a.email)].map((e) => e.trim().toLowerCase())));
  const memberEmails = new Set(allMembers.map((m) => m.email.trim().toLowerCase()));
  const leadState: Record<string, { member: boolean; unsubscribed: boolean; invitedAt: string | null; followUpAt?: string | null }> = {};
  for (const e of shown) leadState[e] = { member: memberEmails.has(e), unsubscribed: false, invitedAt: null, followUpAt: null };
  if (shown.length) {
    const pick = (cols: string) => db.from("leads").select(cols).in("email", shown).limit(5000);
    let q = await pick("email, unsubscribed, invite_sent_at, invite_followup_at");
    if (q.error) q = await pick("email, unsubscribed, invite_sent_at");
    const rows = (q.error ? (await db.from("leads").select("email, unsubscribed").in("email", shown).limit(5000)).data : (q.data as unknown)) as { email: string; unsubscribed: boolean | null; invite_sent_at?: string | null; invite_followup_at?: string | null }[] | null;
    for (const r of rows ?? []) {
      const s = leadState[r.email.trim().toLowerCase()];
      if (!s) continue;
      if (r.unsubscribed) s.unsubscribed = true;
      if (r.invite_sent_at && (!s.invitedAt || r.invite_sent_at > s.invitedAt)) s.invitedAt = r.invite_sent_at;
      if (r.invite_followup_at) s.followUpAt = r.invite_followup_at;
    }
  }

  // Visitors (2 Nov 2026): page views in the period, and who's on the site now.
  let pvQ = db.from("page_views").select("created_at, sid, path, ref, device, first, source").order("created_at", { ascending: false }).limit(50000);
  if (since) pvQ = pvQ.gte("created_at", new Date(since).toISOString());
  const pv = await pvQ;
  const visitsMissing = !!pv.error && /does not exist|schema cache/i.test(pv.error.message);
  const views = fromSource((pv.data ?? []) as ViewRow[], f);
  let ckQ = db.from("check_events").select("sid").eq("event", "check_started").limit(50000);
  if (since) ckQ = ckQ.gte("created_at", new Date(since).toISOString());
  const checkSids = new Set(((await ckQ).data ?? []).map((r: { sid: string }) => r.sid));
  const lv = await db.from("live_sessions").select("sid, path, last_seen").gte("last_seen", new Date(now.getTime() - LIVE_WINDOW_MS).toISOString()).limit(5000);
  const live = lv.error ? { ok: false, message: "Run the latest SQL to turn this on." } : { ok: true, ...liveNow(lv.data ?? [], now.getTime()) };
  // Google reviews (2 Nov 2026).
  const rvm = await db.from("subscribers").select("review_asks, review_clicked_at").or("review_asks.gt.0,review_clicked_at.not.is.null").limit(10000);
  let rcQ = db.from("review_clicks").select("source").limit(50000);
  if (since) rcQ = rcQ.gte("created_at", new Date(since).toISOString());
  const rc = await rcQ;
  const reviewMissing = !!(rvm.error || rc.error);
  const srcCount = new Map<string, number>();
  for (const r of (rc.data ?? []) as { source: string }[]) srcCount.set(r.source, (srcCount.get(r.source) ?? 0) + 1);
  const rvRows = (rvm.data ?? []) as { review_asks: number | null; review_clicked_at: string | null }[];
  const reviews = {
    asked: rvRows.filter((r) => (r.review_asks ?? 0) > 0).length,
    clicked: rvRows.filter((r) => r.review_clicked_at).length,
    clickedAfterAsk: rvRows.filter((r) => (r.review_asks ?? 0) > 0 && r.review_clicked_at).length,
    bySource: Array.from(srcCount.entries()).map(([source, n]) => ({ source, n })).sort((a, b) => b.n - a.n),
  };
  const periodLabel = f.period === "all" ? "all time" : `last ${PERIODS.find((p) => p.id === f.period)?.label ?? ""}`;

  // 7 Nov 2026: say so when the database is behind the code (a missing column
  // used to drop fields on save without a word).
  const health = await schemaHealth(db);
  const behind = health.missingColumns.length + health.missingTables.length > 0;
  return (
    <DashboardCharts stats={stats} subscriberStats={subscriberStats} funnel={funnel} filters={f} leadState={leadState}
      top={<>
        {behind && (
          <div className={styles.schemaWarn} role="alert">
            <b>Database needs an update.</b> Run <code>supabase/schema.sql</code> in the Supabase SQL editor (it only adds what&apos;s missing; safe to run again).
            {health.missingColumns.length > 0 && <> Missing columns on subscribers: <code>{health.missingColumns.join(", ")}</code>.</>}
            {health.missingTables.length > 0 && <> Missing tables: <code>{health.missingTables.join(", ")}</code>.</>}
            {" "}Until then, bills still save but those fields are dropped.
          </div>
        )}
        <VisitorsSection report={pv.error ? null : visitReport(views, checkSids)} live={live} periodLabel={periodLabel} missing={visitsMissing} />
      </>}>
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
        leadState={leadState}
      />
      <ReviewsSection {...reviews} ready={!!reviewUrl()} missing={reviewMissing} />
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

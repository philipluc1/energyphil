import { computeDashboardStats, computeFunnelStats, computeSubscriberStats, LeadRow, SubscriberRow, type CheckEventRow, type MemberSourceRow } from "@/lib/dashboardStats";
import { partnerName } from "@/lib/partners";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DashboardCharts from "./DashboardCharts";
import styles from "./dashboard.module.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";

// Always hit the database fresh — this is a live admin view, never cached.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select(
      "id, created_at, email, distributor, current_bill, best_retailer, best_plan_name, best_total, estimated_saving, estimated_saving_pct",
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return (
      <div className={styles.wrap}>
        <div className={styles.notice}>Couldn&apos;t load leads: {error.message}</div>
      </div>
    );
  }

  // Shared "now" so the leads and subscriber 30-day windows line up exactly.
  const now = new Date();

  const leads = (data ?? []) as LeadRow[];
  const stats = computeDashboardStats(leads, now);

  // Subscribers table may not exist yet if schema.sql hasn't been re-run —
  // don't let that break the rest of the dashboard.
  const { data: subData } = await supabaseAdmin
    .from("subscribers")
    .select("id, created_at, email, plan, status, amount_cents, currency, current_period_end")
    .order("created_at", { ascending: false })
    .limit(2000);
  const subscriberStats = computeSubscriberStats((subData ?? []) as SubscriberRow[], now);

  // Launch funnel: anonymous check counts (check_events) against new members,
  // by where people came from. Both queries tolerate an older database
  // (schema.sql not re-run yet): the section then shows what it can.
  const { data: evData } = await supabaseAdmin
    .from("check_events")
    .select("created_at, event, source")
    .order("created_at", { ascending: false })
    .limit(50000);
  const { data: srcData, error: srcErr } = await supabaseAdmin
    .from("subscribers")
    .select("created_at, status, source")
    .order("created_at", { ascending: false })
    .limit(5000);
  const memberRows: MemberSourceRow[] = srcErr
    ? ((subData ?? []) as SubscriberRow[]).map((r) => ({ created_at: r.created_at, status: r.status, source: null }))
    : ((srcData ?? []) as MemberSourceRow[]);
  const funnel = computeFunnelStats((evData ?? []) as CheckEventRow[], memberRows, now, partnerName);

  return <DashboardCharts stats={stats} subscriberStats={subscriberStats} funnel={funnel} />;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";
import { latestPerEmail, monthlyValueCents, type MemberRow } from "@/lib/adminReports";
import AdminHeader from "../AdminHeader";
import MembersList, { type MemberListItem } from "./MembersList";
import styles from "../dashboard.module.css";

// Owner dashboard: every member, one row per person, searchable (2 Nov 2026).
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  if (!(await dashCookieValid((await cookies()).get(DASH_COOKIE)?.value))) redirect("/dashboard/login");
  if (!supabaseAdmin) {
    return <div className={styles.wrap}><AdminHeader /><div className={styles.notice}>The database isn&apos;t connected (SUPABASE_SECRET_KEY in Vercel).</div></div>;
  }
  const BASE = "id, created_at, email, plan, status, amount_cents, current_period_end, customer_name, source, suburb, postcode, current_retailer";
  const full = await supabaseAdmin.from("subscribers").select(`${BASE}, cancel_at`).order("created_at", { ascending: false }).limit(10000);
  const rows: unknown[] | null = full.error
    ? (await supabaseAdmin.from("subscribers").select("id, created_at, email, plan, status, amount_cents, current_period_end, source").order("created_at", { ascending: false }).limit(10000)).data
    : full.data;
  type Row = MemberRow & { suburb?: string | null; postcode?: string | null; current_retailer?: string | null };
  const people = latestPerEmail((rows ?? []) as Row[]) as Row[];
  const now = new Date().getTime();
  const items: MemberListItem[] = people.map((m) => ({
    id: m.id,
    email: m.email,
    name: m.customer_name ?? null,
    place: [m.suburb, m.postcode].filter(Boolean).join(" ") || null,
    retailer: m.current_retailer ?? null,
    plan: m.plan,
    state: m.status === "past_due" ? "failed" : m.status !== "active" ? "cancelled" : m.cancel_at && new Date(m.cancel_at).getTime() > now ? "ending" : "active",
    endsAt: m.cancel_at ?? m.current_period_end,
    joined: m.created_at,
    monthlyCents: m.status === "active" ? monthlyValueCents(m.plan, m.amount_cents) : 0,
    source: m.source ?? null,
  }));
  return (
    <div className={styles.wrap}>
      <AdminHeader />
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Members</span>
        <span className={styles.sectionNote}>{items.length} people. Tap one to see everything, edit, cancel or delete.</span>
      </div>
      <MembersList items={items} />
    </div>
  );
}

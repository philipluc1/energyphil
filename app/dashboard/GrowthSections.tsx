import Link from "next/link";
import { COHORT_OFFSETS, monthLabel, type AbandonedLead, type ChurnMonth, type CohortRow, type Revenue } from "@/lib/adminReports";
import { findPlan } from "@/lib/pricingPlans";
import styles from "./dashboard.module.css";

// Owner dashboard (2 Nov 2026): recurring revenue, churn, cohorts, why people
// cancel, and who got a result or reached checkout but didn't join.

export interface AbandonedCheckout {
  email: string;
  created: string;
  plan: string | null;
}

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" });
const planName = (id: string) => findPlan(id)?.name ?? id;
const span = (d: number) => (d >= 365 ? "12 months" : `${d} days`);

function heat(x: number | null): string | undefined {
  if (x === null) return undefined;
  // Green when most stay, amber when about half do, red below that.
  return x >= 0.8 ? styles.heatGood : x >= 0.5 ? styles.heatMid : styles.heatBad;
}

export default function GrowthSections({
  rev, churn, cohorts, reasons, abandoned, abandonedDays = 60, checkouts, checkoutDays = 30, checkoutsNote,
}: {
  rev: Revenue;
  churn: ChurnMonth[];
  cohorts: CohortRow[];
  reasons: { reason: string; count: number }[];
  abandoned: AbandonedLead[];
  abandonedDays?: number;
  checkouts: AbandonedCheckout[];
  checkoutDays?: number;
  checkoutsNote: string | null;
}) {
  const thisMonth = churn[churn.length - 1];
  const contactable = abandoned.filter((a) => !a.unsubscribed);
  return (
    <>
      <div data-sec="revenue">
      {/* ---------------- Revenue and retention ---------------- */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Revenue and retention</span>
        <span className={styles.sectionNote}>Paying members today, who leaves and who stays</span>
      </div>
      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{dollars(rev.mrrCents)}</div>
          <div className={styles.statLabel}>Recurring revenue a month ({dollars(rev.arrCents)} a year)</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{rev.active}</div>
          <div className={styles.statLabel}>Paying members</div>
        </div>
        <div className={`${styles.statCard} ${rev.cancelling ? styles.statWarn : ""}`}>
          <div className={styles.statValue}>{rev.cancelling}</div>
          <div className={styles.statLabel}>Set to cancel at the end of their period</div>
        </div>
        <div className={`${styles.statCard} ${rev.pastDue ? styles.statWarn : ""}`}>
          <div className={styles.statValue}>{rev.pastDue}</div>
          <div className={styles.statLabel}>Payment failed (Stripe is retrying)</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Joins and cancellations by month</div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Month</th><th>Joined</th><th>Cancelled</th><th>Churn</th></tr></thead>
              <tbody>
                {[...churn].reverse().map((c) => (
                  <tr key={c.month}>
                    <td>{monthLabel(c.month)}{c === thisMonth ? " (so far)" : ""}</td>
                    <td>{c.joined}</td>
                    <td>{c.cancelled}</td>
                    <td title={`${c.cancelled} of ${c.atStart} members at the start of the month`}>{pct(c.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.cardNote}>Churn is cancellations in the month divided by members at the start of it.</p>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Why people cancel</div>
          {reasons.length === 0 ? (
            <p className={styles.emptyNote}>No cancellations yet.</p>
          ) : (
            <ul className={styles.barList}>
              {reasons.map((r) => (
                <li key={r.reason}>
                  <span>{r.reason}</span>
                  <span className={styles.barTrack}><span style={{ width: `${(r.count / reasons[0].count) * 100}%` }} /></span>
                  <b>{r.count}</b>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.cardNote}>From the reason members pick when they cancel in Stripe&apos;s billing page. Plan by plan: {rev.byPlan.map((p) => `${planName(p.plan)} ${p.count} (${dollars(p.mrrCents)}/mo)`).join(", ") || "none yet"}.</p>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.chartTitle}>Cohorts: of the members who joined each month, how many are still paying</div>
        {cohorts.length === 0 ? (
          <p className={styles.emptyNote}>No members yet.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.cohort}`}>
              <thead>
                <tr><th>Joined in</th><th>Members</th>{COHORT_OFFSETS.map((n) => <th key={n}>After {n} month{n === 1 ? "" : "s"}</th>)}</tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.month}>
                    <td>{monthLabel(c.month)}</td>
                    <td>{c.joined}</td>
                    {c.retained.map((x, i) => <td key={i} className={heat(x)}>{x === null ? <span className={styles.notYet}>not yet</span> : pct(x)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.cardNote}>Each person counts once, in the month they first joined. &ldquo;Not yet&rdquo; means that group hasn&apos;t been members that long.</p>
      </div>

      </div>
      <div data-sec="didnt">
      {/* ---------------- Didn't join ---------------- */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Didn&apos;t join</span>
        <span className={styles.sectionNote}>Left an email for their result, or started paying, but aren&apos;t members</span>
      </div>
      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{abandoned.length}</div>
          <div className={styles.statLabel}>Got a result in the last {span(abandonedDays)}, didn&apos;t join</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{contactable.length}</div>
          <div className={styles.statLabel}>Of those, still happy to get emails</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{dollars(Math.round(contactable.reduce((t, a) => t + Math.max(0, a.saving ?? 0), 0) * 100))}</div>
          <div className={styles.statLabel}>Savings a year they&apos;re leaving on the table</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{checkouts.length}</div>
          <div className={styles.statLabel}>Started checkout, didn&apos;t pay ({span(checkoutDays)})</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Got a result, didn&apos;t join</div>
          {abandoned.length === 0 ? (
            <p className={styles.emptyNote}>Nobody yet.</p>
          ) : (
            <div className={`${styles.tableScroll} ${styles.tallScroll}`}>
              <table className={styles.table}>
                <thead><tr><th>Email</th><th>When</th><th>Could save</th><th>Network</th></tr></thead>
                <tbody>
                  {abandoned.slice(0, 200).map((a) => (
                    <tr key={a.email} className={a.unsubscribed ? styles.rowMuted : undefined}>
                      <td>{a.email}{a.checks > 1 ? <span className={styles.pillSoft}>{a.checks} checks</span> : null}{a.unsubscribed ? <span className={styles.pillWarn}>unsubscribed</span> : null}</td>
                      <td>{day(a.created_at)}</td>
                      <td>{a.saving !== null && a.saving > 0 ? `$${Math.round(a.saving).toLocaleString("en-AU")}/yr` : "–"}</td>
                      <td>{a.distributor ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.cardNote}>They get our follow-up emails automatically: one the next day, then days 3 and 7 if they ticked price alerts. Don&apos;t email anyone marked unsubscribed.</p>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Started checkout, didn&apos;t pay</div>
          {checkoutsNote ? (
            <p className={styles.emptyNote}>{checkoutsNote}</p>
          ) : checkouts.length === 0 ? (
            <p className={styles.emptyNote}>Nobody in the last {span(checkoutDays)}.</p>
          ) : (
            <div className={`${styles.tableScroll} ${styles.tallScroll}`}>
              <table className={styles.table}>
                <thead><tr><th>Email</th><th>When</th><th>Plan</th></tr></thead>
                <tbody>
                  {checkouts.map((c) => (
                    <tr key={c.email + c.created}><td>{c.email}</td><td>{day(c.created)}</td><td>{c.plan ? planName(c.plan) : "–"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.cardNote}>From Stripe: checkouts that expired unpaid, for people who aren&apos;t members. They didn&apos;t ask for marketing, so a single &ldquo;anything we can help with?&rdquo; note is the limit.</p>
        </div>
      </div>

      <p className={styles.cardNote}><Link href="/dashboard/members">Manage members →</Link></p>
      </div>
    </>
  );
}

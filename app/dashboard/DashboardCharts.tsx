"use client";

import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardStats, SubscriberStats } from "@/lib/dashboardStats";
import { useColorScheme } from "@/lib/useColorScheme";
import { findPlan, fmtPrice } from "@/lib/pricingPlans";
import styles from "./dashboard.module.css";

const PALETTE = {
  light: {
    line: "#1b2a4a",
    fill: "rgba(27,42,74,0.12)",
    bar: "#f0a202",
    bar2: "#1b7a7a",
    grid: "#d9dfea",
    text: "#12141c",
  },
  dark: {
    line: "#93acdd",
    fill: "rgba(147,172,221,0.16)",
    bar: "#f0a202",
    bar2: "#5fc9c9",
    grid: "#262f47",
    text: "#eceff7",
  },
};

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(n: number): string {
  return (n * 100).toLocaleString("en-AU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}
function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DashboardCharts({
  stats,
  subscriberStats,
}: {
  stats: DashboardStats;
  subscriberStats?: SubscriberStats;
}) {
  const scheme = useColorScheme();
  const colors = PALETTE[scheme];
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/dashboard-logout", { method: "POST" });
    router.push("/dashboard/login");
  }

  const perDay = stats.perDay.map((d) => ({ ...d, label: fmtDateShort(d.date) }));
  const revenuePerDay = (subscriberStats?.revenuePerDay ?? []).map((d) => ({
    ...d,
    label: fmtDateShort(d.date),
    amount: d.amountCents / 100,
  }));
  const avgSavingByDistributor = stats.avgSavingByDistributor.map((d) => ({ ...d, avgSaving: Math.round(d.avgSaving) }));
  const avgBestTotalByDistributor = stats.avgBestTotalByDistributor.map((d) => ({
    ...d,
    avgTotal: Math.round(d.avgTotal),
  }));

  const conversionRate =
    subscriberStats && stats.totalLeads > 0 ? subscriberStats.totalSubscribers / stats.totalLeads : null;

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.brand}>
          VIC Energy<span className={styles.accent}>Check</span>
          <span className={styles.brandSub}>Dashboard</span>
        </div>
        <button type="button" className={styles.logoutBtn} onClick={onLogout}>
          Log out
        </button>
      </header>

      {/* ---------------- Business performance ---------------- */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Business performance</span>
        <span className={styles.sectionNote}>Signups, revenue and conversion</span>
      </div>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalLeads}</div>
          <div className={styles.statLabel}>Total leads</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{conversionRate !== null ? fmtPct(conversionRate) : "—"}</div>
          <div className={styles.statLabel}>Leads → subscribers</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{subscriberStats ? subscriberStats.activeSubscribers : "—"}</div>
          <div className={styles.statLabel}>Active subscribers</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{subscriberStats ? fmtPrice(subscriberStats.totalCollectedCents) : "—"}</div>
          <div className={styles.statLabel}>Collected at checkout</div>
        </div>
      </div>

      {subscriberStats && (
        <div className={styles.chartCard} style={{ marginBottom: 18 }}>
          <div className={styles.chartTitle}>Revenue at checkout, last 30 days</div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenuePerDay} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: colors.text }}
                  tickLine={false}
                  axisLine={{ stroke: colors.grid }}
                  interval={4}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: colors.text }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v) => fmtCurrency(Number(v))}
                />
                <Tooltip
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.date ?? label}
                  formatter={(value) => [fmtCurrency(Number(value)), "Revenue"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="amount" stroke={colors.line} fill={colors.fill} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.emptyNote} style={{ marginTop: 10, marginBottom: 0 }}>
            First payment only — renewal payments on monthly/quarterly/half-yearly plans aren&apos;t tracked here yet.
          </p>
        </div>
      )}

      {subscriberStats && (
        <div className={styles.tableCard} style={{ marginBottom: 28 }}>
          <div className={styles.chartTitle}>Recent subscribers</div>
          {subscriberStats.recent.length === 0 ? (
            <p className={styles.emptyNote}>No subscribers yet — they&apos;ll show up here once someone pays.</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriberStats.recent.map((sub) => (
                    <tr key={sub.id}>
                      <td>{fmtDateTime(sub.created_at)}</td>
                      <td>{sub.email}</td>
                      <td>{findPlan(sub.plan)?.name ?? sub.plan}</td>
                      <td>{sub.status}</td>
                      <td>{sub.amount_cents !== null ? fmtPrice(sub.amount_cents) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Customer savings ---------------- */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Customer savings</span>
        <span className={styles.sectionNote}>What the tool is finding for people</span>
      </div>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.leadsThisWeek}</div>
          <div className={styles.statLabel}>Leads this week</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.avgSaving !== null ? fmtCurrency(stats.avgSaving) : "—"}</div>
          <div className={styles.statLabel}>Avg. saving found</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.avgSavingPct !== null ? fmtPct(stats.avgSavingPct) : "—"}</div>
          <div className={styles.statLabel}>Avg. saving %</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{fmtCurrency(stats.totalSavingsFound)}</div>
          <div className={styles.statLabel}>Total $ found, all-time</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Leads, last 30 days</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={perDay} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: colors.text }}
                  tickLine={false}
                  axisLine={{ stroke: colors.grid }}
                  interval={4}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.date ?? label}
                  formatter={(value) => [Number(value), "Leads"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="count" stroke={colors.line} fill={colors.fill} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Avg. saving found, by network</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={avgSavingByDistributor} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: colors.text }} tickLine={false} axisLine={{ stroke: colors.grid }} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: colors.text }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tickFormatter={(v) => fmtCurrency(Number(v))}
                />
                <Tooltip formatter={(value) => [fmtCurrency(Number(value)), "Avg. saving"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="avgSaving" fill={colors.bar2} radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.tableCard} style={{ marginBottom: 28 }}>
        <div className={styles.chartTitle}>Recent leads</div>
        {stats.recent.length === 0 ? (
          <p className={styles.emptyNote}>No leads saved yet — they&apos;ll show up here as customers sign up.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Email</th>
                  <th>Network</th>
                  <th>Best plan found</th>
                  <th>Est. saving</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((lead) => (
                  <tr key={lead.id}>
                    <td>{fmtDateTime(lead.created_at)}</td>
                    <td>{lead.email}</td>
                    <td>{lead.distributor}</td>
                    <td>
                      {lead.best_retailer ? (
                        <>
                          {lead.best_retailer}
                          <span className={styles.planName}>{lead.best_plan_name}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {lead.estimated_saving !== null ? (
                        <>
                          {fmtCurrency(lead.estimated_saving)}
                          {lead.estimated_saving_pct !== null && (
                            <span className={styles.planName}>{fmtPct(lead.estimated_saving_pct)}</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- Market insights ---------------- */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Market insights</span>
        <span className={styles.sectionNote}>How networks and retailers compare</span>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Leads by network</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byDistributor} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: colors.text }} tickLine={false} axisLine={{ stroke: colors.grid }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} width={28} />
                <Tooltip formatter={(value) => [Number(value), "Leads"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill={colors.bar} radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Who comes out cheapest most often</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.winsByRetailer} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: colors.text }} tickLine={false} axisLine={{ stroke: colors.grid }} interval={0} angle={-25} textAnchor="end" height={54} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} width={28} />
                <Tooltip formatter={(value) => [Number(value), "Times cheapest"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill={colors.bar2} radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.chartCard} style={{ marginBottom: 18 }}>
        <div className={styles.chartTitle}>Avg. cheapest-match price, by network</div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={avgBestTotalByDistributor} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: colors.text }} tickLine={false} axisLine={{ stroke: colors.grid }} />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: colors.text }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => fmtCurrency(Number(v))}
              />
              <Tooltip formatter={(value) => [fmtCurrency(Number(value)), "Avg. cheapest price"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="avgTotal" fill={colors.bar} radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className={styles.emptyNote} style={{ marginTop: 10, marginBottom: 0 }}>
          Lower isn&apos;t necessarily &ldquo;better service&rdquo; — base VDO rates vary by network area, so this
          mostly reflects which networks tend to have cheaper underlying tariffs.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useColorScheme } from "@/lib/useColorScheme";
import type { ChannelRow, FunnelWeek, GrowthPoint, MixRow, MrrPoint, PlanRow, RenewalWindow, RiskRow, ValueDelivered } from "@/lib/ownerAnalytics";
import { SPEND_CHANNELS } from "@/lib/ownerAnalytics";
import styles from "./dashboard.module.css";

// Owner dashboard (9 Nov 2026): members growth, funnel and ad payback, plan vs
// actual, revenue and cash ahead, value delivered and members at risk. All
// figures are worked out on the server (lib/ownerAnalytics.ts); this draws them.

const C = {
  light: { yearly: "#1b2a4a", monthly: "#1b7a7a", cancel: "#c2410c", line: "#f0a202", checks: "#7c8aa5", grid: "#d9dfea", text: "#12141c" },
  dark: { yearly: "#93acdd", monthly: "#5fc9c9", cancel: "#f97316", line: "#f0a202", checks: "#8f9bb5", grid: "#262f47", text: "#eceff7" },
};
const $ = (n: number | null | undefined, dp = 0) => (n === null || n === undefined ? "—" : "$" + n.toLocaleString("en-AU", { minimumFractionDigits: dp, maximumFractionDigits: dp }));
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : (n * 100).toLocaleString("en-AU", { maximumFractionDigits: 1 }) + "%");
const num = (n: number) => Math.round(n).toLocaleString("en-AU");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "2-digit", timeZone: "Australia/Melbourne" });
/** Drop empty periods before anything happened (e.g. months before launch), keeping at least `min`. */
function trimLeading<T>(rows: T[], empty: (r: T) => boolean, min = 3): T[] {
  let i = 0;
  while (i < rows.length - min && empty(rows[i])) i++;
  return rows.slice(i);
}
const PLAN = (p: string) => (p === "annual" ? "Yearly" : p === "monthly" ? "Monthly" : p);

export interface OwnerAnalyticsProps {
  growth: { week: GrowthPoint[]; month: GrowthPoint[] };
  funnel: FunnelWeek[];
  channels: ChannelRow[];
  breakEven: number;
  periodLabel: string;
  spendMonths: string[];
  spendMissing: boolean;
  plan: PlanRow[];
  planSource: string;
  mrr: MrrPoint[];
  mix: MixRow[];
  renewals: RenewalWindow[];
  reads: { key: string; label: string; reads: number; cost: number }[];
  value: ValueDelivered;
  risk: RiskRow[];
}

export default function OwnerAnalytics(p: OwnerAnalyticsProps) {
  const scheme = useColorScheme();
  const c = C[scheme === "dark" ? "dark" : "light"];
  return (
    <>
      <Growth {...p} c={c} />
      <Funnel {...p} c={c} />
      <Plan {...p} />
      <Cash {...p} c={c} />
      <Value {...p} c={c} />
    </>
  );
}

type Col = (typeof C)["light"];
const axis = (c: Col) => ({ tick: { fontSize: 11, fill: c.text }, tickLine: false, axisLine: { stroke: c.grid } });

function Head({ title, note }: { title: string; note: string }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionTitle}>{title}</span>
      <span className={styles.sectionNote}>{note}</span>
    </div>
  );
}
function Stat({ v, l, warn }: { v: string; l: string; warn?: boolean }) {
  return <div className={`${styles.statCard} ${warn ? styles.statWarn : ""}`}><div className={styles.statValue}>{v}</div><div className={styles.statLabel}>{l}</div></div>;
}

// ---------------- Members growth ----------------
function Growth({ growth, c }: OwnerAnalyticsProps & { c: Col }) {
  const [unit, setUnit] = useState<"week" | "month">("week");
  const [showChecks, setShowChecks] = useState(false);
  const data = trimLeading(growth[unit], (r) => r.paying === 0 && r.newYearly + r.newMonthly === 0 && r.checks === 0);
  const last = data[data.length - 1];
  const joined = last ? last.newYearly + last.newMonthly : 0;
  return (
    <div data-sec="growth">
      <Head title="Members growth" note="New members, cancellations and total paying members over time" />
      <div className={styles.statRow}>
        <Stat v={num(last?.paying ?? 0)} l="Paying members now" />
        <Stat v={num(joined)} l={`Joined this ${unit}`} />
        <Stat v={num(Math.abs(last?.cancelled ?? 0))} l={`Cancelled this ${unit}`} warn={(last?.cancelled ?? 0) < 0} />
        <Stat v={(joined + (last?.cancelled ?? 0) >= 0 ? "+" : "") + num(joined + (last?.cancelled ?? 0))} l={`Net change this ${unit}`} />
      </div>
      <div className={styles.chartCard} style={{ marginBottom: 18 }}>
        <div className={styles.toolRow}>
          <div className={styles.chartTitle} style={{ margin: 0 }}>By {unit}, last {data.length} {unit}s</div>
          <div className={styles.segRow}>
            {(["week", "month"] as const).map((u) => <button key={u} type="button" className={unit === u ? styles.chipOn : styles.chip} onClick={() => setUnit(u)}>{u === "week" ? "Week" : "Month"}</button>)}
            <button type="button" className={showChecks ? styles.chipOn : styles.chip} onClick={() => setShowChecks((s) => !s)}>{showChecks ? "Hide free checks" : "Show free checks"}</button>
          </div>
        </div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: 0 }} stackOffset="sign">
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="label" {...axis(c)} interval="preserveStartEnd" />
              <YAxis yAxisId="n" allowDecimals={false} {...axis(c)} axisLine={false} width={36} tickFormatter={(v) => String(Math.abs(Number(v)))} />
              <YAxis yAxisId="t" orientation="right" allowDecimals={false} {...axis(c)} axisLine={false} width={40} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v, name) => [Math.abs(Number(v)).toLocaleString("en-AU"), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine yAxisId="n" y={0} stroke={c.grid} />
              <Bar yAxisId="n" dataKey="newYearly" name="New, yearly" stackId="s" fill={c.yearly} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="n" dataKey="newMonthly" name="New, monthly" stackId="s" fill={c.monthly} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="n" dataKey="cancelled" name="Cancelled" stackId="s" fill={c.cancel} radius={[0, 0, 3, 3]} />
              <Line yAxisId="t" type="monotone" dataKey="paying" name="Paying members (right)" stroke={c.line} strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {showChecks && <div className={styles.chartTitle} style={{ margin: "10px 0 0" }}>Free checks finished, same {unit}s</div>}
        {showChecks && (
          <div style={{ width: "100%", height: 130, marginTop: 6 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 6, right: 44, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="label" {...axis(c)} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} {...axis(c)} axisLine={false} width={36} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [Number(v).toLocaleString("en-AU"), "Free checks finished"]} />
                <Bar dataKey="checks" name="Free checks finished" fill={c.checks} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className={styles.cardNote}>Bars: members who joined (yearly and monthly) and who left (below the line, counted when their membership actually ended). Line: everyone paying at the end of each {unit}. The plan and &ldquo;came from&rdquo; filters apply; the period filter doesn&apos;t.</p>
      </div>
    </div>
  );
}

// ---------------- Funnel and ad payback ----------------
function Funnel({ funnel, channels, breakEven, periodLabel, spendMonths, spendMissing, c }: OwnerAnalyticsProps & { c: Col }) {
  const conv = funnel.map((w) => ({ label: w.label, conversion: w.conversion === null ? null : +(w.conversion * 100).toFixed(1) }));
  return (
    <div data-sec="funnel">
      <Head title="Funnel and ad payback" note="Where people drop out, and what each channel costs" />
      <div className={styles.chartGrid}>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Week by week</div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Week of</th><th>Visitors</th><th>Started a check</th><th>Finished</th><th>Emailed result</th><th>Checkout</th><th>Paid</th><th>Finished → paid</th></tr></thead>
              <tbody>
                {[...funnel].reverse().map((w) => (
                  <tr key={w.key}><td>{w.label}</td><td>{w.visitors}</td><td>{w.started}</td><td>{w.completed}</td><td>{w.emailed}</td><td>{w.checkout}</td><td>{w.paid}</td><td>{pct(w.conversion)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Finished checks that became members, by week</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conv} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="label" {...axis(c)} interval="preserveStartEnd" />
                <YAxis unit="%" {...axis(c)} axisLine={false} width={44} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v}%`, "Conversion"]} />
                <ReferenceLine y={3} stroke={c.checks} strokeDasharray="4 4" label={{ value: "Plan 3%", position: "insideTopRight", fontSize: 11, fill: c.text }} />
                <Line type="linear" dataKey="conversion" stroke={c.yearly} strokeWidth={2.5} connectNulls dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.cardNote}>The financial model assumes 3%. A few weeks of real numbers here tell you whether that holds.</p>
        </div>
      </div>
      <div className={styles.tableCard}>
        <div className={styles.chartTitle}>By channel ({periodLabel})</div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th>Channel</th><th>Free checks</th><th>Members</th><th>Conversion</th><th>Ad spend</th><th>Per free check</th><th>Per member</th><th>Pays back in a year?</th></tr></thead>
            <tbody>
              {channels.length === 0 && <tr><td colSpan={8}>No checks or members yet.</td></tr>}
              {channels.map((r) => (
                <tr key={r.channel}>
                  <td>{r.channel}</td><td>{r.checks}</td><td>{r.members}</td><td>{pct(r.conversion)}</td>
                  <td>{r.spend === null ? "—" : $(r.spend)}</td><td>{$(r.costPerCheck, 2)}</td><td>{$(r.costPerMember)}</td>
                  <td>{r.paysBackInYear === null ? "—" : r.paysBackInYear ? <span className={styles.pillGood}>Yes</span> : <span className={styles.pillBad}>No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.cardNote}>
          A new member leaves about <b>{$(breakEven)}</b> in their first year at regular prices (after GST and Stripe, 70% yearly), so a channel pays back within a year when a member costs less than that.
          Ads are matched by the <code>utm_source</code> on the link (meta, chatgpt, google).
        </p>
        <SpendForm months={spendMonths} missing={spendMissing} />
      </div>
    </div>
  );
}

function SpendForm({ months, missing }: { months: string[]; missing: boolean }) {
  const router = useRouter();
  const [month, setMonth] = useState(months[months.length - 1] ?? "");
  const [channel, setChannel] = useState<string>(SPEND_CHANNELS[0]);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/ad-spend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month, channel, amount: Number(amount) }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (body?.ok) { setMsg(`Saved: ${channel}, ${$(Number(amount))}.`); setAmount(""); router.refresh(); }
    else setMsg(body?.message ?? "Couldn't save. Try again.");
  }
  return (
    <form className={styles.spendForm} onSubmit={save}>
      <b>Record ad spend</b>
      <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
        {months.map((m) => <option key={m} value={m}>{new Date(`${m}-15T00:00:00Z`).toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" })}</option>)}
      </select>
      <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
        {SPEND_CHANNELS.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
      </select>
      <input inputMode="decimal" placeholder="$ spent" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Amount in dollars" />
      <button type="submit" className={styles.chipOn} disabled={busy || !amount}>{busy ? "Saving…" : "Save"}</button>
      <span className={styles.cardNote} style={{ margin: 0 }}>{missing ? "Run supabase/schema.sql first (adds ad_spend)." : msg ?? "The month's total for that channel; saving again replaces it."}</span>
    </form>
  );
}

// ---------------- Plan vs actual ----------------
function Plan({ plan, planSource }: OwnerAnalyticsProps) {
  const pill = (s: PlanRow["status"]) => <span className={s === "ahead" ? styles.pillGood : s === "close" ? styles.pillWarn : styles.pillBad}>{s === "ahead" ? "On or ahead" : s === "close" ? "Close" : "Behind"}</span>;
  const pair = (a: number, t: number, money = false) => <>{money ? $(a) : num(a)} <span className={styles.vsPlan}>/ {money ? $(t) : num(t)}</span></>;
  return (
    <div data-sec="plan">
      <Head title="Plan vs actual" note={`Real numbers against the ${planSource}`} />
      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th>Month</th><th>Free checks</th><th>New members</th><th>Paying members</th><th>Payments (inc GST)</th><th>Members joining</th></tr></thead>
            <tbody>
              {plan.length === 0 && <tr><td colSpan={6}>The plan starts in November 2026.</td></tr>}
              {[...plan].reverse().map((r) => (
                <tr key={r.month}>
                  <td>{r.label}{r.partial ? " (so far)" : ""}</td>
                  <td>{pair(r.checks, r.target.checks)}</td>
                  <td>{pair(r.newMembers, r.target.newMembers)}</td>
                  <td>{pair(r.active, r.target.active)}</td>
                  <td>{pair(r.salesIncGst, r.target.salesIncGst, true)}</td>
                  <td>{pill(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.cardNote}>Actual / plan. The status compares members joining with the plan (for this month, the plan so far by date): within 80% counts as close. Payments are estimated from memberships (monthly plans each month, yearly plans when they join or renew). Six months in (April 2027) is the check-in the model was built for.</p>
      </div>
    </div>
  );
}

// ---------------- Revenue and cash ahead ----------------
function Cash({ mrr: mrrAll, mix, renewals, reads: readsAll, c }: OwnerAnalyticsProps & { c: Col }) {
  const mrr = trimLeading(mrrAll, (r) => r.mrr === 0);
  const reads = trimLeading(readsAll, (r) => r.reads === 0, 1);
  const now = mrr[mrr.length - 1];
  const totalMix = mix.reduce((t, m) => t + m.members, 0);
  return (
    <div data-sec="cash">
      <Head title="Revenue and cash ahead" note="Recurring revenue, what members pay, and payments due" />
      <div className={styles.statRow}>
        <Stat v={$(now?.mrr ?? 0)} l={`Recurring revenue a month (${$((now?.mrr ?? 0) * 12)} a year)`} />
        {renewals.map((w) => <Stat key={w.days} v={$(w.total)} l={`Due in the next ${w.days} days: ${w.yearlyCount} yearly renewal${w.yearlyCount === 1 ? "" : "s"} (${$(w.yearly)}), ${w.monthlyPayments} monthly payment${w.monthlyPayments === 1 ? "" : "s"} (${$(w.monthly)})`} />)}
      </div>
      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Recurring revenue a month, by plan</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrr} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="label" {...axis(c)} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v) => `$${v}`} {...axis(c)} axisLine={false} width={48} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v, n) => [$(Number(v)), String(n)]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="yearly" name="Yearly (÷12)" stackId="m" stroke={c.yearly} fill={c.yearly} fillOpacity={0.5} />
                <Area type="monotone" dataKey="monthly" name="Monthly" stackId="m" stroke={c.monthly} fill={c.monthly} fillOpacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.cardNote}>Yearly memberships counted as a twelfth a month. Members set to cancel are excluded from &ldquo;due&rdquo; above.</p>
        </div>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Paying members by plan and price</div>
          <ul className={styles.barList}>
            {mix.map((m) => (
              <li key={m.name}>
                <span>{m.name}</span>
                <span className={styles.barTrack}><span style={{ width: `${totalMix ? (m.members / totalMix) * 100 : 0}%` }} /></span>
                <b>{m.members}</b>
              </li>
            ))}
          </ul>
          <p className={styles.cardNote}>New Year special = joined before 1 Feb 2027 ($45 / $7), locked in while they stay.</p>
          <div className={styles.chartTitle} style={{ marginTop: 16 }}>Bill reads and their AI cost</div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Month</th><th>Bill reads</th><th>AI cost</th></tr></thead>
              <tbody>{[...reads].reverse().slice(0, 6).map((r) => <tr key={r.key}><td>{r.label}</td><td>{r.reads}</td><td>{$(r.cost, 2)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className={styles.cardNote}>About 2c a read. Emails sent: see <a href="https://resend.com/emails" target="_blank" rel="noopener">Resend</a> (free to 3,000 a month).</p>
        </div>
      </div>
    </div>
  );
}

// ---------------- Value delivered and churn risk ----------------
function Value({ value, risk, c }: OwnerAnalyticsProps & { c: Col }) {
  const share = (n: number) => (value.paying ? ` (${Math.round((n / value.paying) * 100)}%)` : "");
  return (
    <div data-sec="value">
      <Head title="Value delivered and churn risk" note="Are members getting what they pay for, and who might leave" />
      <div className={styles.statRow}>
        <Stat v={`${value.forwardingSetUp} of ${value.paying}`} l={`Set up bill forwarding${share(value.forwardingSetUp)}`} warn={value.paying > 0 && value.forwardingSetUp / value.paying < 0.5} />
        <Stat v={`${value.forwardedABill}`} l={`Have forwarded a bill${share(value.forwardedABill)}`} />
        <Stat v={`${value.thingsCaught}`} l={`Things caught on bills: ${$(value.feesToAskBack)} to ask back, ${$(value.onOfferYear)} a year on offer`} />
        <Stat v={`${value.alerts30} · ${value.switched}`} l="Saving alerts sent (30 days) · members who've switched" />
      </div>
      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Bills received, by week</div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={value.billsByWeek} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="label" {...axis(c)} />
                <YAxis allowDecimals={false} {...axis(c)} axisLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [Number(v), "Bills"]} />
                <Bar dataKey="bills" fill={c.monthly} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.cardNote}>Uploaded or forwarded. Members who keep sending bills stay; this is the habit to grow.</p>
        </div>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Members worth a look ({risk.length})</div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Member</th><th>Plan</th><th>Joined</th><th>Why</th></tr></thead>
              <tbody>
                {risk.length === 0 && <tr><td colSpan={4}>No one right now.</td></tr>}
                {risk.slice(0, 40).map((r) => (
                  <tr key={r.email}><td title={r.email}>{r.name ?? r.email}</td><td>{PLAN(r.plan)}</td><td>{day(r.joined)}</td><td>{r.reasons.join(" · ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.cardNote}>Payment failed or set to cancel first, then no bill yet (or none in 4 months), forwarding not set up after two weeks, and yearly renewals in the next 30 days. A friendly nudge to set up forwarding is the cheapest save.</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { findPlan, fmtPrice } from "@/lib/pricingPlans";
import { accumulatedSavings, mergeChecks, monthlySavings, type SavedCheck } from "@/lib/savings";
import { findPlanRow, planRateRows } from "@/lib/plans";
import SiteHeader from "../components/SiteHeader";
import EnergyTips from "../components/EnergyTips";
import SavingsChart from "../components/SavingsChart";
import styles from "./account.module.css";

// Passwordless sign-in: there's no separate "create an account" step — the
// first time someone enters their email here, Supabase Auth creates the
// account and emails them a one-click link; every time after, the same form
// just signs them back in. Once signed in, the RLS policy added in
// supabase/schema.sql ("subscriber can view own record") lets this page read
// their own row straight out of the subscribers table — nobody else's.

interface SubscriberSummary {
  plan: string;
  status: string;
  amount_cents: number | null;
  currency: string;
  current_period_end: string | null;
  created_at: string;
  // Added for the "your tariff" card below — the plan this subscriber was
  // last matched to, and the network/solar context needed to price it the
  // same way /check does.
  distributor: string | null;
  baseline_retailer: string | null;
  baseline_plan_name: string | null;
  billing_days: number | null;
  has_solar: boolean | null;
  solar_export_kwh: number | null;
}

interface EpisodeRow {
  started_at: string;
  ended_at: string | null;
  daily_rate: number;
  best_retailer: string | null;
  best_plan_name: string | null;
}

type Stage = "loading" | "signedOut" | "signedIn";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDollars(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "canceled") return "Canceled";
  if (status === "past_due") return "Payment past due";
  return status;
}

export default function AccountPage() {
  // Lazy initial value rather than a synchronous setState in the effect
  // below — when Supabase isn't configured there's never a session to wait
  // on, so the signed-out state is known up front.
  const [stage, setStage] = useState<Stage>(() => (supabase ? "loading" : "signedOut"));
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [sending, setSending] = useState(false);

  const [sub, setSub] = useState<SubscriberSummary | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [checks, setChecks] = useState<SavedCheck[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setUserEmail(data.session.user.email);
        setStage("signedIn");
      } else {
        setStage("signedOut");
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        setStage("signedIn");
      } else {
        setUserEmail(null);
        setSub(null);
        setStage("signedOut");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (stage !== "signedIn" || !supabase) return;
    let cancelled = false;

    async function loadSubscription() {
      setSubLoading(true);
      setSubError("");
      const { data, error } = await supabase!
        .from("subscribers")
        .select(
          "plan, status, amount_cents, currency, current_period_end, created_at, distributor, baseline_retailer, baseline_plan_name, billing_days, has_solar, solar_export_kwh",
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setSubError("Couldn't load your dashboard — please try refreshing.");
      } else {
        setSub(data as SubscriberSummary | null);
      }
      setSubLoading(false);
    }

    loadSubscription();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  // Savings history is its own fetch (its own table), independent of
  // whether there's a current subscription — past savings still count even
  // if they've since canceled.
  useEffect(() => {
    if (stage !== "signedIn" || !supabase) return;
    let cancelled = false;

    async function loadEpisodes() {
      setEpisodesLoading(true);
      const { data, error } = await supabase!
        .from("savings_episodes")
        .select("started_at, ended_at, daily_rate, best_retailer, best_plan_name")
        .order("started_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        // Fails quietly rather than showing customers a scary error — the
        // most likely cause is simply that the savings_episodes table/SQL
        // migration hasn't been run yet, which just means no history to show.
        console.error("Couldn't load savings history", error);
        setEpisodes([]);
      } else {
        setEpisodes((data ?? []) as EpisodeRow[]);
      }
      const { data: chk } = await supabase!
        .from("bill_checks")
        .select("month, billing_days, saving, source")
        .order("month", { ascending: true });
      if (!cancelled) {
        // One check per month: prefer a bill-based or manual check over the automatic one.
        const rank: Record<string, number> = { bill: 3, manual: 2, auto: 1 };
        const best = new Map<string, { c: SavedCheck; r: number }>();
        for (const row of (chk ?? []) as (SavedCheck & { source: string })[]) {
          const key = row.month.slice(0, 7);
          const r = rank[row.source] ?? 0;
          if (!best.has(key) || best.get(key)!.r < r) best.set(key, { c: row, r });
        }
        setChecks([...best.values()].map((v) => v.c));
      }
      setEpisodesLoading(false);
    }

    loadEpisodes();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  const accumulated = useMemo(
    () =>
      accumulatedSavings(
        episodes.map((ep) => ({ startedAt: ep.started_at, endedAt: ep.ended_at, dailyRate: ep.daily_rate })),
      ),
    [episodes],
  );

  const months = useMemo(
    () =>
      mergeChecks(
        monthlySavings(
          episodes.map((ep) => ({ startedAt: ep.started_at, endedAt: ep.ended_at, dailyRate: ep.daily_rate })),
        ),
        checks,
      ),
    [episodes, checks],
  );

  // The exact plan row for "your tariff" below — looked up fresh from the
  // current rate card each render, so if a retailer has changed its rates
  // since this subscriber's last check, the breakdown reflects that rather
  // than a stale snapshot. Null means the plan name/retailer/network combo
  // we matched them to no longer appears (retired or renamed since).
  const tariffPlan = useMemo(() => {
    if (!sub?.baseline_retailer || !sub?.baseline_plan_name || !sub?.distributor) return null;
    return findPlanRow(sub.baseline_retailer, sub.baseline_plan_name, sub.distributor);
  }, [sub]);
  const tariffRows = useMemo(
    () => (tariffPlan ? planRateRows(tariffPlan, sub?.has_solar ? sub?.solar_export_kwh ?? 0 : 0) : []),
    [tariffPlan, sub],
  );

  async function handleSendLink(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSending(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });
    setSending(false);
    if (error) {
      setLoginError("Couldn't send that link — please check the email and try again.");
      return;
    }
    setLinkSent(true);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSub(null);
    setEpisodes([]);
    setLinkSent(false);
    setLoginEmail("");
  }

  async function handleManageBilling() {
    if (!supabase) return;
    setPortalLoading(true);
    setPortalError("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setPortalError("Please log in again.");
      setPortalLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({ ok: false, message: "Something went wrong." }));
      if (!body.ok) {
        setPortalError(body.message || "Couldn't open billing management.");
        setPortalLoading(false);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setPortalError("Something went wrong — please try again.");
      setPortalLoading(false);
    }
  }

  return (
    <>
      <SiteHeader active="account" />
      <div className={styles.wrap}>
        <div className={`${styles.card} ${stage === "signedIn" ? styles.cardWide : ""}`}>
          <h1>My Dashboard</h1>

          {!supabaseConfigured && <p className={styles.note}>Accounts aren&apos;t switched on yet — check back soon.</p>}

          {supabaseConfigured && stage === "loading" && <p className={styles.note}>Loading…</p>}

          {supabaseConfigured && stage === "signedOut" && (
            <>
              <p className={styles.lede}>
                Enter your email and we&apos;ll send a sign-in link. No password.
              </p>
              {linkSent ? (
                <p className={styles.success}>
                  Link sent to <strong>{loginEmail}</strong> — check your inbox.
                </p>
              ) : (
                <form className={styles.form} onSubmit={handleSendLink}>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                  <button type="submit" className={styles.btnPrimary} disabled={sending}>
                    {sending ? "Sending…" : "Send me a login link"}
                  </button>
                </form>
              )}
              {loginError && <p className={styles.error}>{loginError}</p>}
            </>
          )}

          {supabaseConfigured && stage === "signedIn" && (
            <>
              <p className={styles.signedInAs}>Signed in as {userEmail}</p>

              <div className={styles.savingsBox}>
                <div className={styles.savingsLabel}>Saved so far</div>
                <div className={styles.savingsTotal}>{episodesLoading ? "…" : fmtDollars(accumulated.total)}</div>
                {accumulated.sinceDate && (
                  <div className={styles.savingsSince}>Since {fmtDate(accumulated.sinceDate)} · estimate</div>
                )}
              </div>

              <div className={styles.chartBox}>
                <div className={styles.chartTitle}>Savings by month</div>
                {!episodesLoading && months.length === 0 ? (
                  <p className={styles.note}>Your monthly savings will show here.</p>
                ) : (
                  <SavingsChart months={months} />
                )}
                {months.some((m) => m.partial) && <div className={styles.chartNote}>Faded column = month in progress</div>}
                {months.length > 0 && <div className={styles.chartNote}>Months with a saved check use it. Others are estimates.</div>}
              </div>

              <div className={styles.checkBox}>
                <div>
                  <div className={styles.checkTitle}>Check this month&apos;s bill</div>
                  <div className={styles.checkSub}>Upload a photo or PDF — takes a minute.</div>
                </div>
                <Link href="/check" className={styles.btnPrimary}>
                  Upload bill
                </Link>
              </div>

              {subLoading && <p className={styles.note}>Loading your plan…</p>}
              {subError && <p className={styles.error}>{subError}</p>}

              {!subLoading && !subError && !sub && (
                <div className={styles.planBox}>
                  <p>You&apos;re not subscribed yet.</p>
                  <Link href="/check#pricing" className={styles.linkBtn}>
                    See plans →
                  </Link>
                </div>
              )}

              {!subLoading && sub && (
                <div className={styles.planBox}>
                  <div className={styles.planName}>{findPlan(sub.plan)?.name ?? sub.plan}</div>
                  <div className={styles.planMeta}>
                    {sub.amount_cents !== null ? fmtPrice(sub.amount_cents) : "—"}
                    {" · "}
                    <span className={sub.status === "active" ? styles.statusActive : styles.statusOther}>
                      {statusLabel(sub.status)}
                    </span>
                  </div>
                  {sub.current_period_end && (
                    <div className={styles.renewNote}>
                      {sub.status === "active" ? "Renews" : "Ends"} {fmtDate(sub.current_period_end)}
                    </div>
                  )}
                  <button type="button" className={styles.btnPrimary} onClick={handleManageBilling} disabled={portalLoading}>
                    {portalLoading ? "Opening…" : "Manage or cancel"}
                  </button>
                  {portalError && <p className={styles.error}>{portalError}</p>}
                </div>
              )}

              {!subLoading && sub && sub.baseline_retailer && sub.baseline_plan_name && (
                <details className={styles.tariffBox}>
                  <summary className={styles.tariffLabel}>Your matched plan &amp; rates</summary>
                  {tariffPlan ? (
                    <>
                      <div className={styles.tariffPlanName}>
                        {sub.baseline_retailer} — {sub.baseline_plan_name}
                      </div>
                      <div className={styles.tariffMeta}>{sub.distributor} network</div>
                      <div className={styles.tariffRows}>
                        {tariffRows.map((r) => (
                          <div className={styles.tariffRow} key={r.label}>
                            <span className={styles.tariffRowLabel}>{r.label}</span>
                            <span className={styles.tariffRowValue}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                      <p className={styles.tariffNote}>Matched at your last check. Confirm against your bill.</p>
                    </>
                  ) : (
                    <p className={styles.note}>
                      {sub.baseline_retailer} — {sub.baseline_plan_name} is no longer listed. Upload a new bill for
                      today&apos;s rates.
                    </p>
                  )}
                </details>
              )}

              <EnergyTips />

              <button type="button" className={`${styles.logoutBtn} ${styles.logoutBtnSpaced}`} onClick={handleLogout}>
                Log out
              </button>
            </>
          )}

          <div className={styles.footerLinks}>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/cancellation-policy">Cancellation Policy</Link>
            <Link href="/default-offer">About the VDO</Link>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { findPlan, fmtPrice } from "@/lib/pricingPlans";
import { accumulatedSavings } from "@/lib/savings";
import SiteHeader from "../components/SiteHeader";
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
        .select("plan, status, amount_cents, currency, current_period_end, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setSubError("Couldn't load your account — please try refreshing.");
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
        <div className={styles.card}>
          <h1>Your account</h1>

          {!supabaseConfigured && <p className={styles.note}>Accounts aren&apos;t switched on yet — check back soon.</p>}

          {supabaseConfigured && stage === "loading" && <p className={styles.note}>Loading…</p>}

          {supabaseConfigured && stage === "signedOut" && (
            <>
              <p className={styles.lede}>
                Enter your email and we&apos;ll send you a one-click link to sign in — no password needed. First
                time here? This creates your account too.
              </p>
              {linkSent ? (
                <p className={styles.success}>
                  Check your inbox — we&apos;ve sent a sign-in link to <strong>{loginEmail}</strong>.
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

              {subLoading && <p className={styles.note}>Loading your plan…</p>}
              {subError && <p className={styles.error}>{subError}</p>}

              {!subLoading && !subError && !sub && (
                <div className={styles.planBox}>
                  <p>You&apos;re not currently subscribed to ongoing monitoring.</p>
                  <Link href="/check#pricing" className={styles.linkBtn}>
                    See monitoring plans →
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
                    <div className={styles.renewNote}>Renews {fmtDate(sub.current_period_end)}</div>
                  )}
                  <button type="button" className={styles.btnPrimary} onClick={handleManageBilling} disabled={portalLoading}>
                    {portalLoading ? "Opening…" : "Manage billing"}
                  </button>
                  {portalError && <p className={styles.error}>{portalError}</p>}
                </div>
              )}

              {episodesLoading && <p className={styles.note}>Loading your savings history…</p>}

              {!episodesLoading && episodes.length > 0 && (
                <div className={styles.savingsBox}>
                  <div className={styles.savingsLabel}>Savings so far</div>
                  <div className={styles.savingsTotal}>{fmtDollars(accumulated.total)}</div>
                  {accumulated.sinceDate && (
                    <div className={styles.savingsSince}>Estimated since {fmtDate(accumulated.sinceDate)}</div>
                  )}
                  <p className={styles.savingsCaveat}>
                    An estimate, not a guarantee — based on you switching to the plan we matched you to each
                    time, and staying on it. We can&apos;t see whether you actually switched.
                  </p>

                  <div className={styles.savingsHistoryLabel}>History</div>
                  <ul className={styles.savingsHistoryList}>
                    {[...episodes].reverse().map((ep, i) => (
                      <li key={ep.started_at} className={styles.savingsHistoryItem}>
                        <span className={styles.savingsHistoryDate}>{fmtDate(ep.started_at)}</span>
                        <span className={styles.savingsHistoryText}>
                          {i === episodes.length - 1 ? "Started monitoring" : "Found something cheaper"}
                          {ep.best_retailer ? ` — ${ep.best_retailer}` : ""}
                          {ep.best_plan_name ? ` (${ep.best_plan_name})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!episodesLoading && episodes.length === 0 && sub && (
                <p className={styles.note}>
                  Your savings history will start building up here from your next price check.
                </p>
              )}

              <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

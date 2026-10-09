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
import FunEquivalents from "../components/FunEquivalents";
import ProfilePanels, { type ProfileData } from "../components/ProfilePanels";
import { DEFAULT_PROFILE, estimateUsage } from "@/lib/profileUsage";
import { PRICE_CHANGE_CLAUSE } from "@/lib/dataPolicy";
import BillPhotoUpload from "../components/BillPhotoUpload";
import type { ExtractedBill } from "@/lib/billExtraction";
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
  switched_at: string | null;
  switched_to: string | null;
  customer_name: string | null;
  address: string | null;
  suburb: string | null;
  postcode: string | null;
  nmi: string | null;
  current_retailer: string | null;
  current_plan_name: string | null;
  tariff_type: string | null;
  usage_mode: string | null;
  peak_kwh: number | null;
  shoulder_kwh: number | null;
  offpeak_kwh: number | null;
  anytime_kwh: number | null;
  controlled_load_kwh: number | null;
  home_profile: Record<string, unknown> | null;
  gas_zone: string | null;
  gas_billing_days: number | null;
  gas_mj: number | null;
  gas_reference_total: number | null;
  gas_current_plan_name: string | null;
  gas_best_retailer: string | null;
  gas_best_plan_name: string | null;
  gas_best_total: number | null;
  gas_updated_at: string | null;
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
  const [cooldown, setCooldown] = useState(0);

  const [sub, setSub] = useState<SubscriberSummary | null>(null);
  const [billMsg, setBillMsg] = useState("");
  const [switchDate, setSwitchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [switchBusy, setSwitchBusy] = useState(false);
  // What a non-member told us in the free check, kept in this browser.
  const [localCheck, setLocalCheck] = useState<ProfileData | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("utilo.check.v1");
        if (!raw) return;
        const d = JSON.parse(raw);
        const profile = { ...DEFAULT_PROFILE, ...(d.profile ?? {}) };
        const days = typeof d.days === "number" ? d.days : 91;
        const est = d.usageSource === "bill" ? null : estimateUsage(profile, days);
        setLocalCheck({
          customer_name: d.customerName || null,
          address: d.address || null,
          suburb: d.suburb || null,
          postcode: d.postcode || null,
          distributor: d.distributor || null,
          nmi: null,
          current_retailer: d.currentRetailer || null,
          current_plan_name: null,
          tariff_type: null,
          usage_mode: est ? "detailed" : d.mode || null,
          billing_days: days,
          peak_kwh: est ? est.peak : d.mode === "detailed" ? d.peak ?? null : null,
          shoulder_kwh: est ? est.shoulder : d.mode === "detailed" ? d.shoulder ?? null : null,
          offpeak_kwh: est ? est.offpeak : d.mode === "detailed" ? d.offpeak ?? null : null,
          anytime_kwh: est ? 0 : d.mode === "simple" ? d.anytime ?? null : null,
          controlled_load_kwh: est ? est.cl : d.cl ?? null,
          has_solar: est ? profile.hasSolar : typeof d.hasSolar === "boolean" ? d.hasSolar : null,
          solar_export_kwh: est ? est.solarExportKwh : null,
          baseline_retailer: null,
          baseline_plan_name: null,
          home_profile: est ? profile : null,
          source: est ? "answers" : "bill",
        });
      } catch {
        /* nothing saved */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
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
          "plan, status, amount_cents, currency, current_period_end, created_at, distributor, baseline_retailer, baseline_plan_name, billing_days, has_solar, solar_export_kwh, switched_at, switched_to, customer_name, address, suburb, postcode, nmi, current_retailer, current_plan_name, tariff_type, usage_mode, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, home_profile, gas_zone, gas_billing_days, gas_mj, gas_reference_total, gas_current_plan_name, gas_best_retailer, gas_best_plan_name, gas_best_total, gas_updated_at",
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

  // Only count savings from the day the member says they switched. Before
  // that, the figure is what they *would* have saved, and is labelled so.
  const switchedAt = sub?.switched_at ?? null;
  const countedEpisodes = useMemo(
    () =>
      switchedAt
        ? episodes
            .filter((ep) => !ep.ended_at || ep.ended_at > switchedAt)
            .map((ep) => (ep.started_at < switchedAt ? { ...ep, started_at: switchedAt } : ep))
        : episodes,
    [episodes, switchedAt],
  );
  const accumulated = useMemo(
    () =>
      accumulatedSavings(
        countedEpisodes.map((ep) => ({ startedAt: ep.started_at, endedAt: ep.ended_at, dailyRate: ep.daily_rate })),
      ),
    [countedEpisodes],
  );

  const thisMonth = new Date().toISOString().slice(0, 7);
  const doneThisMonth = checks.some((c) => c.month.startsWith(thisMonth));
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

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSendLink(e?: FormEvent) {
    e?.preventDefault();
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
    setCooldown(30);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSub(null);
    setEpisodes([]);
    setLinkSent(false);
    setLoginEmail("");
  }

  async function confirmSwitch(switched: boolean) {
    if (!supabase) return;
    setSwitchBusy(true);
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/confirm-switch", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ switched, date: switchDate }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setSwitchBusy(false);
    if (body?.ok) setSub((p) => (p ? { ...p, switched_at: body.switched_at, switched_to: body.switched_to } : p));
  }

  async function handleBill(bill: ExtractedBill) {
    setBillMsg("Working out your best plan…");
    const { data } = await supabase!.auth.getSession();
    const res = await fetch("/api/apply-bill", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify(bill),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.ok) {
      setBillMsg(
        body.fuel === "gas"
          ? body.retailer ? `Best gas match: ${body.retailer} — ${body.plan}. Reloading…` : `${body.message ?? "Gas details saved."} Reloading…`
          : `Best match: ${body.retailer} — ${body.plan}${body.gas?.retailer ? `; gas: ${body.gas.retailer}` : ""}. Reloading your dashboard…`,
      );
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setBillMsg(body?.message || "We couldn't use that bill.");
    }
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
                <div className={styles.inbox}>
                  <div className={styles.inboxIcon} aria-hidden="true">✉</div>
                  <h2>Check your inbox</h2>
                  <p>
                    We sent a sign-in link to <strong>{loginEmail}</strong>. Open it on this device and you&apos;re in.
                  </p>
                  <div className={styles.inboxBtns}>
                    <a className={styles.btnPrimary} href="https://mail.google.com" target="_blank" rel="noopener noreferrer">Open Gmail</a>
                    <a className={styles.btnGhost} href="https://outlook.live.com/mail" target="_blank" rel="noopener noreferrer">Open Outlook</a>
                  </div>
                  <p className={styles.note}>Nothing there? Check spam or promotions.</p>
                  <button type="button" className={styles.linkBtn} disabled={sending || cooldown > 0} onClick={() => handleSendLink()}>
                    {sending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend the link"}
                  </button>
                  <button type="button" className={styles.linkBtn} onClick={() => setLinkSent(false)}>Use a different email</button>
                </div>
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

              <div className={`${styles.checkBox} ${styles.toneAmber}`}>
                <div>
                  <div className={styles.checkTitle}>{doneThisMonth ? "This month's check is done" : "Next step: check this month's bill"}</div>
                  <div className={styles.checkSub}>
                    {doneThisMonth
                      ? "We'll check again next month. Got a newer bill? Upload it below."
                      : sub && sub.status === "active"
                        ? "Upload a photo or PDF below. It takes about a minute."
                        : "Members get a bill read and a saved check every month. Start with the free check."}
                  </div>
                </div>
                {!doneThisMonth && (
                  sub && sub.status === "active"
                    ? <a href="#read-bill" className={styles.btnPrimary}>Upload bill</a>
                    : <Link href="/check" className={styles.btnPrimary}>Run a free check</Link>
                )}
              </div>

              {sub && sub.status === "active" && sub.baseline_retailer && (
                <div className={`${styles.planBox} ${styles.toneTeal}`}>
                  {switchedAt ? (
                    <>
                      <div className={styles.planName}>You switched to {sub.switched_to ?? sub.baseline_retailer}</div>
                      <p className={styles.note}>On {fmtDate(switchedAt)}. Savings count from that day.</p>
                      <p className={styles.note}>{PRICE_CHANGE_CLAUSE} We won&apos;t suggest another move in the first two months unless it&apos;s a big one.</p>
                      <button type="button" className={styles.linkBtn} disabled={switchBusy} onClick={() => confirmSwitch(false)}>
                        That&apos;s wrong, I haven&apos;t switched
                      </button>
                    </>
                  ) : (
                    <>
                      <div className={styles.planName}>Did you switch to {sub.baseline_retailer}?</div>
                      <p className={styles.note}>We only count savings from the day you actually switch.</p>
                      <div className={styles.switchRow}>
                        <label>
                          Switched on{" "}
                          <input type="date" value={switchDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setSwitchDate(e.target.value)} />
                        </label>
                        <button type="button" className={styles.btnPrimary} disabled={switchBusy} onClick={() => confirmSwitch(true)}>
                          {switchBusy ? "Saving…" : "Yes, I switched"}
                        </button>
                        <Link href="/check" className={styles.linkBtn}>Not yet, show me the plan</Link>
                      </div>
                    </>
                  )}
                </div>
              )}

              {sub && sub.status === "active" && (<>
              <div className={styles.savingsBox}>
                <div className={styles.savingsLabel}>{switchedAt ? "Saved since you switched" : "What you'd save by switching"}</div>
                <div className={styles.savingsTotal}>{episodesLoading ? "…" : fmtDollars(accumulated.total)}</div>
                {accumulated.sinceDate && (
                  <div className={styles.savingsSince}>
                    {switchedAt ? `Since ${fmtDate(switchedAt)}` : `If you'd switched on ${fmtDate(accumulated.sinceDate)}`} · estimate
                  </div>
                )}
                {!episodesLoading && <FunEquivalents dollars={accumulated.total} dark />}
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

              </>)}

              {!subLoading && sub && <ProfilePanels d={{ ...sub, source: sub.nmi || sub.current_plan_name ? "bill" : "answers" }} />}
              {!subLoading && sub && sub.status === "active" && (
                <div className={`${styles.planBox} ${styles.toneTeal}`}>
                  <div className={styles.planName}>Gas</div>
                  {sub.gas_zone && sub.gas_mj ? (
                    <>
                      <p className={styles.note}>
                        {sub.gas_zone} · {Math.round(sub.gas_mj).toLocaleString("en-AU")} MJ over {sub.gas_billing_days ?? "?"} days
                        {sub.gas_current_plan_name ? ` · now on "${sub.gas_current_plan_name}"` : ""}
                      </p>
                      {sub.gas_best_retailer && sub.gas_best_total !== null ? (
                        <>
                          <p className={styles.note}>
                            Cheapest gas match: <strong>{sub.gas_best_retailer} — {sub.gas_best_plan_name}</strong> at {fmtDollars(sub.gas_best_total)} for the period
                            {sub.gas_reference_total !== null && sub.gas_reference_total - sub.gas_best_total > 1
                              ? `, about ${fmtDollars(sub.gas_reference_total - sub.gas_best_total)} less than your bill.`
                              : "."}
                          </p>
                          {sub.gas_best_retailer === sub.baseline_retailer ? (
                            <p className={styles.note}>Same retailer as your best electricity plan, so ask {sub.gas_best_retailer} about a dual-fuel discount.</p>
                          ) : (
                            <p className={styles.note}>
                              Different retailer from your best electricity plan ({sub.baseline_retailer ?? "not set"}). That&apos;s fine: you can have gas and electricity with different companies. If you&apos;d rather keep one retailer, check whether their dual-fuel discount beats the gap.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className={styles.note}>Your gas details are saved. The comparison switches on with our next gas price pull.</p>
                      )}
                    </>
                  ) : (
                    <p className={styles.note}>
                      No gas bill yet. Upload one below (a dual-fuel bill works too) or <Link href="/gas">run the free gas check</Link>.
                    </p>
                  )}
                </div>
              )}


              {subLoading && <p className={styles.note}>Loading your plan…</p>}
              {subError && <p className={styles.error}>{subError}</p>}

              {!subLoading && !sub && localCheck && <ProfilePanels d={localCheck} />}

              {!subLoading && !subError && !sub && (
                <div className={styles.planBox}>
                  <p>You&apos;re not subscribed yet.</p>
                  <Link href="/check#pricing" className={styles.linkBtn}>
                    See plans →
                  </Link>
                </div>
              )}

              {!subLoading && sub && (
                <div className={`${styles.planBox} ${styles.toneNavy}`}>
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

              {!subLoading && sub && sub.status === "active" && (
                <div className={`${styles.planBox} ${styles.toneViolet}`} id="read-bill">
                  <div className={styles.planName}>Read a new bill</div>
                  <p className={styles.note}>Take a photo or upload a PDF. We&apos;ll update your numbers and recheck your plan.</p>
                  {billMsg && <p className={styles.note}>{billMsg}</p>}
                  <BillPhotoUpload onApply={handleBill} />
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
            <Link href="/cancellation-policy">Cancellation Policy</Link> · <Link href="/terms">Terms</Link>
            <Link href="/default-offer">About the VDO</Link>
          </div>
        </div>
      </div>
    </>
  );
}

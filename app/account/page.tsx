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
import DashTabs, { type TabDef } from "../components/DashTabs";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import { useCountUp } from "@/lib/useCountUp";
import { useColorScheme } from "@/lib/useColorScheme";
import { DASH_THEMES, DEFAULT_DASH_THEME, isDashTheme, type DashThemeId } from "@/lib/dashThemes";
import ProfilePanels, { type ProfileData } from "../components/ProfilePanels";
import type { LatestCheck } from "../components/LatestCheckCard";
import LearnCard from "../components/LearnCard";
import { VerdictCard, CompareSection, summariseComparison, type ComparisonInput, type Period } from "../components/DashboardComparison";
import PlanBand from "../components/PlanBand";
import PlanCards from "../components/PlanCards";
import UpgradePlans from "../components/UpgradePlans";
import type { Distributor } from "@/lib/plans";
import { DEFAULT_PROFILE, estimateUsage } from "@/lib/profileUsage";
import { PRICE_CHANGE_CLAUSE } from "@/lib/dataPolicy";
import BillPhotoUpload from "../components/BillPhotoUpload";
import type { CurrentRates, ExtractedBill } from "@/lib/billExtraction";
import SwitchReminder from "../components/SwitchReminder";
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
  reference_total: number | null;
  current_rates?: CurrentRates | null;
  current_price_type?: string | null;
  current_price_fixed_until?: string | null;
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

function fmtWhole(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

type Tab = "compare" | "home" | "savings" | "membership";
// Old links (#read-bill, #join) still land on the right tab.
const TAB_FROM_HASH: Record<string, Tab> = {
  compare: "compare", home: "home", savings: "savings", "read-bill": "savings", membership: "membership", join: "membership",
};

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
  const [latest, setLatest] = useState<LatestCheck | null>(null);
  const [localPricing, setLocalPricing] = useState<{ planName: string | null; rates: CurrentRates | null; priceType: "fixed" | "variable" | null; fixedUntil: string | null } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        try {
          const r = JSON.parse(window.localStorage.getItem("utilo.result.v1") ?? "null");
          if (r && typeof r.bestTotal === "number") setLatest(r as LatestCheck);
        } catch { /* none */ }
        try {
          const lp = JSON.parse(window.localStorage.getItem("utilo.pricing.v1") ?? "null");
          if (lp && typeof lp === "object") setLocalPricing(lp);
        } catch { /* none */ }
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
          baseline_retailer: (() => { try { return JSON.parse(window.localStorage.getItem("utilo.result.v1") ?? "null")?.bestRetailer ?? null; } catch { return null; } })(),
          baseline_plan_name: (() => { try { return JSON.parse(window.localStorage.getItem("utilo.result.v1") ?? "null")?.bestPlan ?? null; } catch { return null; } })(),
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
  const [syncReason, setSyncReason] = useState("");
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
      const BASE_COLS =
          "plan, status, amount_cents, currency, current_period_end, created_at, distributor, baseline_retailer, baseline_plan_name, billing_days, has_solar, solar_export_kwh, switched_at, switched_to, customer_name, address, suburb, postcode, nmi, current_retailer, current_plan_name, tariff_type, usage_mode, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, home_profile, gas_zone, gas_billing_days, gas_mj, gas_reference_total, gas_current_plan_name, gas_best_retailer, gas_best_plan_name, gas_best_total, gas_updated_at, reference_total";
      const PRICING_COLS = ", current_rates, current_price_type, current_price_fixed_until";
      const pick = (cols: string) =>
        supabase!.from("subscribers").select(cols).order("created_at", { ascending: false }).limit(1).maybeSingle();
      let { data, error } = await pick(BASE_COLS + PRICING_COLS);
      // Database without the newest pricing columns yet? Load everything else.
      if (error && /column|schema cache/i.test(error.message ?? "")) ({ data, error } = await pick(BASE_COLS));
      if (cancelled) return;
      if (error) {
        setSubError("Couldn't load your dashboard — please try refreshing.");
        setSubLoading(false);
        return;
      }
      let row = data as SubscriberSummary | null;
      // No membership on file? Ask the server to check Stripe for a paid
      // checkout and create it (covers a missed webhook), then reload once.
      if (!row || row.status !== "active") {
        const session = (await supabase!.auth.getSession()).data.session;
        const res = await fetch("/api/sync-membership", { method: "POST", headers: { authorization: `Bearer ${session?.access_token ?? ""}` } }).catch(() => null);
        const body = await res?.json().catch(() => null);
        if (!cancelled && body?.reason) setSyncReason(body.reason);
        if (!cancelled && !body?.ok && body?.message) setSyncReason(body.message);
        if (!cancelled && body?.created) {
          const again = await supabase!
            .from("subscribers")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (again.data) row = again.data as SubscriberSummary;
        }
      }
      if (cancelled) return;
      setSub(row);
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

  const [tab, setTab] = useState<Tab>("compare");
  // Colour theme: the default, or ?theme=slate|mint|brand to preview another.
  const [themeId, setThemeId] = useState<DashThemeId>(DEFAULT_DASH_THEME);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("theme");
    if (isDashTheme(t)) { const h = setTimeout(() => setThemeId(t), 0); return () => clearTimeout(h); }
  }, []);
  const scheme = useColorScheme();
  const themeMode = DASH_THEMES[themeId][scheme];
  // The page background behind the dashboard follows the theme too.
  useEffect(() => {
    if (stage !== "signedIn") return;
    const prev = document.body.style.background;
    document.body.style.background = themeMode.pageBg;
    document.body.style.backgroundAttachment = "fixed";
    return () => { document.body.style.background = prev; };
  }, [stage, themeMode]);
  const [period, setPeriod] = useState<Period>("year");
  const [showSwitchForm, setShowSwitchForm] = useState(false);
  const isMember = !!sub && sub.status === "active";

  function changeTab(t: Tab) {
    setTab(t);
    try { window.history.replaceState(null, "", `#${t}`); } catch { /* ignore */ }
  }
  // Follow #hash links (header pill, "Upload your bill", emails) to a tab.
  useEffect(() => {
    const apply = () => {
      const t = TAB_FROM_HASH[window.location.hash.slice(1)];
      if (!t) return;
      setTab(t);
      const bar = document.getElementById("dash-tabs");
      const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      if (bar) window.scrollTo({ top: bar.getBoundingClientRect().top + window.scrollY - header - 8, behavior: "smooth" });
    };
    const first = setTimeout(apply, 0);
    window.addEventListener("hashchange", apply);
    return () => { clearTimeout(first); window.removeEventListener("hashchange", apply); };
  }, []);

  // One comparison input for the whole dashboard, so the verdict, the table
  // and the Savings tab always quote the same numbers.
  const cmpInput: ComparisonInput | null = useMemo(() => {
    if (isMember && sub!.distributor && sub!.billing_days) {
      const fromBill = !!(sub!.nmi || sub!.current_plan_name);
      return {
        distributor: sub!.distributor as Distributor,
        days: sub!.billing_days,
        peak: sub!.peak_kwh ?? 0, shoulder: sub!.shoulder_kwh ?? 0, offpeak: sub!.offpeak_kwh ?? 0, anytime: sub!.anytime_kwh ?? 0, cl: sub!.controlled_load_kwh ?? 0,
        solarExportKwh: sub!.has_solar ? sub!.solar_export_kwh ?? 0 : 0,
        billTotal: fromBill ? sub!.reference_total : null,
        currentRetailer: sub!.current_retailer, currentPlanName: sub!.current_plan_name,
        source: fromBill ? "bill" : "answers",
        nmi: sub!.nmi,
        currentRates: sub!.current_rates ?? null,
        currentPriceType: sub!.current_price_type === "fixed" || sub!.current_price_type === "variable" ? sub!.current_price_type : null,
        currentFixedUntil: sub!.current_price_fixed_until ?? null,
      };
    }
    if (!isMember && localCheck && localCheck.distributor && localCheck.billing_days) {
      return {
        distributor: localCheck.distributor as Distributor,
        days: localCheck.billing_days,
        peak: localCheck.peak_kwh ?? 0, shoulder: localCheck.shoulder_kwh ?? 0, offpeak: localCheck.offpeak_kwh ?? 0, anytime: localCheck.anytime_kwh ?? 0, cl: localCheck.controlled_load_kwh ?? 0,
        solarExportKwh: localCheck.has_solar ? localCheck.solar_export_kwh ?? 0 : 0,
        billTotal: latest && latest.haveBill ? latest.bench : null,
        currentRetailer: localCheck.current_retailer, currentPlanName: localPricing?.planName ?? null,
        source: localCheck.source ?? "answers",
        currentRates: localPricing?.rates ?? null,
        currentPriceType: localPricing?.priceType ?? null,
        currentFixedUntil: localPricing?.fixedUntil ?? null,
      };
    }
    return null;
  }, [isMember, sub, localCheck, latest, localPricing]);
  const summary = useMemo(() => (cmpInput ? summariseComparison(cmpInput) : null), [cmpInput]);
  const savedShown = useCountUp(accumulated.total);
  const firstName = ((isMember ? sub!.customer_name : localCheck?.customer_name) ?? "").trim().split(/\s+/)[0] || "";

  const tabs: TabDef<Tab>[] = [
    { id: "compare", label: "Compare" },
    { id: "home", label: "My home" },
    { id: "savings", label: "Savings", dot: isMember && !doneThisMonth },
    { id: "membership", label: "Membership" },
  ];

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
        <div
          className={`${styles.card} ${stage === "signedIn" ? styles.cardDash : ""}`}
          style={stage === "signedIn" ? (themeMode.vars as React.CSSProperties) : undefined}
        >
          {stage !== "signedIn" && <h1>My Dashboard</h1>}

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
              <div className={styles.dashHead}>
                <div>
                  <h1 className={styles.dashTitle}>{firstName ? `Hi ${firstName}` : "My Dashboard"}</h1>
                  <p className={styles.signedInAs}>Signed in as {userEmail}</p>
                </div>
                {isMember ? (
                  <a href="#membership" className={styles.memberPill}>{findPlan(sub!.plan)?.name ?? sub!.plan} member · Active</a>
                ) : (
                  !subLoading && <a href="#membership" className={styles.freePill}>Free account · See plans</a>
                )}
              </div>

              {subLoading && <p className={styles.note}>Loading your plan…</p>}
              {subError && <p className={styles.error}>{subError}</p>}

              {!subLoading && !isMember && syncReason && (
                <div className={styles.syncNote}>
                  <b>Already paid?</b> {syncReason}
                  <button type="button" className={styles.linkBtn} onClick={() => window.location.reload()}>Check again</button>
                </div>
              )}

              {/* Always on top: are you on the cheapest plan? */}
              {!subLoading && cmpInput && (
                <VerdictCard input={cmpInput} member={isMember} period={period} onPeriod={setPeriod} />
              )}
              {!subLoading && !cmpInput && (
                <section className={styles.emptyVerdict}>
                  <span className={styles.stateLabel}>Are you on the cheapest plan?</span>
                  <h2>{isMember ? "Upload a bill and we'll tell you." : "Run the free check and your answer lands here."}</h2>
                  <p>It takes about two minutes. We compare every Victorian plan on your network against your usage.</p>
                  {isMember ? (
                    <a href="#savings" className={styles.btnPrimary}>Upload a bill</a>
                  ) : (
                    <Link href="/check" className={styles.btnPrimary}>Run a free check</Link>
                  )}
                </section>
              )}

              {!subLoading && (
                <DashTabs tabs={tabs} active={tab} onChange={changeTab}>
                  {tab === "compare" && (
                    cmpInput ? (
                      <CompareSection input={cmpInput} member={isMember} period={period} chartPalette={themeMode.chart} />
                    ) : (
                      <div className={styles.panelCard}>
                        <div className={styles.panelTitle}>Retailer comparison</div>
                        <p className={styles.panelText}>Once we have your usage, every plan on your network shows here, cheapest first.</p>
                      </div>
                    )
                  )}

                  {tab === "home" && (
                    <>
                      {isMember ? (
                        <ProfilePanels d={{ ...sub!, source: sub!.nmi || sub!.current_plan_name ? "bill" : "answers" }} />
                      ) : localCheck ? (
                        <ProfilePanels d={localCheck} />
                      ) : (
                        <div className={styles.panelCard}>
                          <div className={styles.panelTitle}>Your home</div>
                          <p className={styles.panelText}>Your address, network, NMI, tariff and usage show here after your first check.</p>
                          <Link href="/check" className={styles.btnPrimary}>Run a free check</Link>
                        </div>
                      )}

                      <div className={styles.panelCard}>
                        <div className={styles.panelTitle}>Gas</div>
                        {isMember && sub!.gas_zone && sub!.gas_mj ? (
                          <>
                            <p className={styles.panelText}>
                              {sub!.gas_zone} · {Math.round(sub!.gas_mj).toLocaleString("en-AU")} MJ over {sub!.gas_billing_days ?? "?"} days
                              {sub!.gas_current_plan_name ? ` · now on "${sub!.gas_current_plan_name}"` : ""}
                            </p>
                            {sub!.gas_best_retailer && sub!.gas_best_total !== null ? (
                              <>
                                <p className={styles.panelText}>
                                  Cheapest gas match: <strong>{sub!.gas_best_retailer} — {sub!.gas_best_plan_name}</strong> at {fmtDollars(sub!.gas_best_total)} for the period
                                  {sub!.gas_reference_total !== null && sub!.gas_reference_total - sub!.gas_best_total > 1
                                    ? `, about ${fmtDollars(sub!.gas_reference_total - sub!.gas_best_total)} less than your bill.`
                                    : "."}
                                </p>
                                <p className={styles.panelText}>
                                  {sub!.gas_best_retailer === sub!.baseline_retailer
                                    ? `Same retailer as your best electricity plan, so ask ${sub!.gas_best_retailer} about a dual-fuel discount.`
                                    : "A different retailer from your best electricity plan. That's fine: gas and electricity can be with different companies. If you'd rather keep one, check whether a dual-fuel discount beats the gap."}
                                </p>
                              </>
                            ) : (
                              <p className={styles.panelText}>Your gas details are saved. The comparison switches on with our next gas price pull.</p>
                            )}
                          </>
                        ) : (
                          <p className={styles.panelText}>
                            No gas bill yet. {isMember ? <>Upload one in <a href="#savings">Savings</a> (a dual-fuel bill works too) or </> : null}
                            <Link href="/gas">run the free gas check</Link>.
                          </p>
                        )}
                      </div>

                      {isMember && sub!.baseline_retailer && sub!.baseline_plan_name && (
                        <details className={styles.panelCard}>
                          <summary className={styles.panelSummary}>Rates for {sub!.baseline_retailer} — {sub!.baseline_plan_name}</summary>
                          {tariffPlan ? (
                            <>
                              <div className={styles.tariffMeta}>{sub!.distributor} network</div>
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
                            <p className={styles.panelText}>That plan is no longer listed. Upload a new bill for today&apos;s rates.</p>
                          )}
                        </details>
                      )}

                      <EnergyTips />
                    </>
                  )}

                  {tab === "savings" && (
                    isMember ? (
                      <>
                        {/* One card that changes with where you are: not switched, switched, or on a good deal. */}
                        <section className={`${styles.stateCard} ${switchedAt || summary?.verdict === "good" ? styles.stateGood : summary?.severe ? styles.stateSevere : styles.stateAct}`}>
                          {switchedAt ? (
                            <>
                              <span className={styles.stateLabel}>Saved since you switched to {sub!.switched_to ?? sub!.baseline_retailer}</span>
                              <div className={styles.stateBig}>{episodesLoading ? "…" : fmtDollars(savedShown)}</div>
                              <p className={styles.stateSub}>Since {fmtDate(switchedAt)} · estimate, based on your usage and today&apos;s prices</p>
                              {!episodesLoading && accumulated.total > 0 && <FunEquivalents dollars={accumulated.total} />}
                              <p className={styles.stateFine}>{PRICE_CHANGE_CLAUSE} We won&apos;t suggest another move in the first two months unless it&apos;s a big one.</p>
                              <button type="button" className={styles.linkBtn} disabled={switchBusy} onClick={() => confirmSwitch(false)}>
                                That&apos;s wrong, I haven&apos;t switched
                              </button>
                            </>
                          ) : summary && summary.verdict !== "good" && summary.savingYear > 0 ? (
                            <>
                              <span className={styles.stateLabel}>Your next move</span>
                              <h2 className={styles.stateHead}>
                                Switch to {summary.bestRetailer} and save about <span className={styles.stateAmt}>{fmtWhole(summary.savingYear)}</span> a year
                              </h2>
                              <p className={styles.stateSub}>
                                Same figure as the top of your dashboard: {summary.bestPlan}, priced against {summary.haveBill ? "your last bill" : "the default offer"}.
                                {!episodesLoading && accumulated.total > 0 && accumulated.sinceDate && (
                                  <> Since we first spotted it on {fmtDate(accumulated.sinceDate)}, staying put has cost you about <b>{fmtDollars(accumulated.total)}</b>.</>
                                )}
                              </p>
                              <div className={styles.stateActions}>
                                {RETAILER_LINKS[summary.bestRetailer] && (
                                  <a href={RETAILER_LINKS[summary.bestRetailer]} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>Go to {summary.bestRetailer} →</a>
                                )}
                                {!showSwitchForm && (
                                  <button type="button" className={styles.btnGhost} onClick={() => setShowSwitchForm(true)}>I&apos;ve switched</button>
                                )}
                                <SwitchReminder retailer={summary.bestRetailer} plan={summary.bestPlan} savingYear={summary.savingYear} link={RETAILER_LINKS[summary.bestRetailer]} nmi={sub!.nmi} />
                              </div>
                              {showSwitchForm && (
                                <div className={styles.switchRow}>
                                  <label>
                                    Switched on{" "}
                                    <input type="date" value={switchDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setSwitchDate(e.target.value)} />
                                  </label>
                                  <button type="button" className={styles.btnPrimary} disabled={switchBusy} onClick={() => confirmSwitch(true)}>
                                    {switchBusy ? "Saving…" : "Save"}
                                  </button>
                                  <button type="button" className={styles.linkBtn} onClick={() => setShowSwitchForm(false)}>Cancel</button>
                                </div>
                              )}
                              <p className={styles.stateFine}>We only count savings from the day you actually switch.</p>
                            </>
                          ) : (
                            <>
                              <span className={styles.stateLabel}>Your next move</span>
                              <h2 className={styles.stateHead}>Nothing to do. You&apos;re on a good deal.</h2>
                              <p className={styles.stateSub}>We re-check every morning and email you only if something beats your plan by more than $50 a year.</p>
                            </>
                          )}
                        </section>

                        <section className={styles.panelCard} id="read-bill">
                          <div className={styles.panelTitleRow}>
                            <div className={styles.panelTitle}>This month&apos;s bill check</div>
                            <span className={doneThisMonth ? styles.chipDone : styles.chipDue}>{doneThisMonth ? "✓ Done" : "Due"}</span>
                          </div>
                          <p className={styles.panelText}>
                            {doneThisMonth
                              ? "We'll check again next month. Got a newer bill? Upload it and we'll recheck straight away."
                              : "Snap or upload your latest bill (electricity, gas or dual fuel). We'll update your numbers and recheck every plan."}
                          </p>
                          {billMsg && <p className={styles.panelText}><b>{billMsg}</b></p>}
                          <BillPhotoUpload onApply={handleBill} />
                        </section>

                        <section className={styles.panelCard}>
                          <div className={styles.panelTitle}>Savings by month</div>
                          {!episodesLoading && months.length === 0 ? (
                            <p className={styles.panelText}>Your monthly savings will show here.</p>
                          ) : (
                            <div data-noswipe><SavingsChart months={months} palette={themeMode.savings} /></div>
                          )}
                          {months.some((m) => m.partial) && <div className={styles.chartNote}>Faded column = month in progress</div>}
                          {months.length > 0 && (
                            <div className={styles.chartNote}>
                              {switchedAt ? "Months with a saved check use it. Others are estimates." : "Before you switch, these show what switching would have saved."}
                            </div>
                          )}
                        </section>
                      </>
                    ) : (
                      <div className={styles.panelCard}>
                        <div className={styles.panelTitle}>Track what you save</div>
                        <p className={styles.panelText}>
                          Members get a bill read every month, a running tally of what they&apos;ve saved since switching, and an email only when a move is worth it.
                        </p>
                        <div className={styles.stateActions}>
                          <button type="button" className={styles.btnPrimary} onClick={() => changeTab("membership")}>See membership plans</button>
                          <Link href="/check" className={styles.btnGhost}>Run another free check</Link>
                        </div>
                      </div>
                    )
                  )}

                  {tab === "membership" && (
                    <>
                      {isMember ? (
                        <>
                          <section className={styles.panelCard}>
                            <div className={styles.panelTitleRow}>
                              <div>
                                <div className={styles.panelTitle}>{findPlan(sub!.plan)?.name ?? sub!.plan} membership</div>
                                <div className={styles.planMeta}>
                                  {sub!.amount_cents !== null ? fmtPrice(sub!.amount_cents) : "—"}
                                  {" · "}
                                  <span className={styles.statusActive}>{statusLabel(sub!.status)}</span>
                                  {sub!.current_period_end && <> · Renews {fmtDate(sub!.current_period_end)}</>}
                                </div>
                              </div>
                              <button type="button" className={styles.btnGhost} onClick={handleManageBilling} disabled={portalLoading}>
                                {portalLoading ? "Opening…" : "Manage or cancel"}
                              </button>
                            </div>
                            {portalError && <p className={styles.error}>{portalError}</p>}
                            <ul className={styles.perks}>
                              <li>Every plan re-priced against yours every morning</li>
                              <li>A bill read and saved check every month</li>
                              <li>An email only when switching saves $50+ a year</li>
                            </ul>
                          </section>
                          <UpgradePlans currentPlan={sub!.plan} onChanged={(planId, cents) => setSub((p) => (p ? { ...p, plan: planId, amount_cents: cents } : p))} />
                        </>
                      ) : (
                        <>
                          {sub && (
                            <section className={styles.panelCard}>
                              <div className={styles.panelTitle}>{findPlan(sub.plan)?.name ?? sub.plan} membership</div>
                              <div className={styles.planMeta}><span className={styles.statusOther}>{statusLabel(sub.status)}</span></div>
                              <button type="button" className={styles.btnGhost} onClick={handleManageBilling} disabled={portalLoading}>
                                {portalLoading ? "Opening…" : "Manage billing"}
                              </button>
                            </section>
                          )}
                          <PlanBand
                            id="join"
                            title="Want this checked for you every month?"
                            intro={<>Members get the comparison re-run every morning, a bill read every month, and an email only when switching is worth it.</>}
                            cards={<PlanCards href="/check#pricing" cta="Join" dark />}
                          />
                        </>
                      )}
                      <LearnCard />
                    </>
                  )}
                </DashTabs>
              )}

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

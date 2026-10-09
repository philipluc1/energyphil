"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DISTRIBUTORS,
  Distributor,
  PLAN_DATA_DATE,
  PLANS,
  isEvFriendly,
  planRateRows,
  rankPlans,
  totalWithSolarFit,
  type PlanRow,
} from "@/lib/plans";
import { guessDistributorFromPostcode } from "@/lib/postcodeNetwork";
import {
  DEFAULT_PROFILE,
  TYPICAL_ANNUAL_KWH,
  estimateUsage,
  vdoBillForUsage,
  type HomeProfile,
} from "@/lib/profileUsage";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import type { ExtractedBill } from "@/lib/billExtraction";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import { periodBreakdown } from "@/lib/savings";
import BillPhotoUpload from "./BillPhotoUpload";
import ResultsChart, { ChartItem } from "./ResultsChart";
import ForecastChart, { buildForecastSeries } from "./ForecastChart";
import PricingSection from "./PricingSection";
import SaveCheck from "./SaveCheck";
import FunEquivalents from "./FunEquivalents";
import HowWeWorkedItOut from "./HowWeWorkedItOut";
import StateWaitlist from "./StateWaitlist";
import { PRICE_CHANGE_CLAUSE } from "@/lib/dataPolicy";

const RETAILERS = Array.from(new Set(PLANS.map((p) => p[0]))).sort();
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "./SiteHeader";
import styles from "./Comparator.module.css";

const PLAN_COUNT = PLANS.length;

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n: number): string {
  return (n * 100).toLocaleString("en-AU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}
const PRICE_AGE_DAYS = Math.floor((Date.now() - new Date(PLAN_DATA_DATE + "T00:00:00").getTime()) / 86_400_000);
const PRICES_STALE = PRICE_AGE_DAYS > 60;

function fmtUpdated(): string {
  return new Date(PLAN_DATA_DATE + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
// The actual c/kWh and $/day rates behind a plan's total — kept hidden
// behind a click so the default view stays a single easy number, per Phil's
// "simple, not just numbers and details" steer, but available for anyone
// who wants to see exactly what they'd be charged. planRateRows() itself
// lives in lib/plans.ts so the account portal's "your tariff" card can
// render the same breakdown for a subscriber's matched plan.
function RateBreakdown({ plan, solarExportKwh = 0 }: { plan: PlanRow; solarExportKwh?: number }) {
  return (
    <div className={styles.rateBreakdown}>
      {planRateRows(plan, solarExportKwh).map((r) => (
        <div className={styles.rateRow} key={r.label}>
          <span className={styles.rateLabel}>{r.label}</span>
          <span className={styles.rateValue}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function EvBadge() {
  return (
    <span className={styles.evBadge} title="Very cheap or free off-peak rate — handy for overnight EV charging">
      ⚡ EV-friendly off-peak
    </span>
  );
}

function SolarBadge() {
  return (
    <span className={styles.solarBadge} title="This total already includes this plan's solar feed-in credit">
      ☀ Solar credit included
    </span>
  );
}

// Small per-step marks for the wizard — same consistent-stroke icon style as
// the homepage's "how it works" icons, so the /check journey reads as the
// same product rather than a plain multi-field form.
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M16.5 14.2c2.6.3 4.5 2.5 4.5 5.3" />
    </svg>
  );
}
function Choice<T extends string | number | boolean>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.choiceRow}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          className={`${styles.choiceBtn} ${o.value === value ? styles.choiceBtnActive : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
function IconGauge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l4-4.5" />
      <path d="M4 15h.01M20 15h.01M12 15h.01" />
    </svg>
  );
}

type Mode = "simple" | "detailed";
type LeadStatus = "idle" | "saving" | "saved" | "error";
type Stage = "input" | "results";
type InputStep = 1 | 2 | 3;
type UsageSource = "estimate" | "bill";
const INPUT_STEPS: InputStep[] = [1, 2, 3];
const INPUT_STEP_LABELS: Record<InputStep, string> = {
  1: "Address",
  2: "Your home",
  3: "Usage",
};

function nextInputStep(s: InputStep): InputStep {
  return s < 3 ? ((s + 1) as InputStep) : 3;
}
function prevInputStep(s: InputStep): InputStep {
  return s > 1 ? ((s - 1) as InputStep) : 1;
}

function scrollToTop() {
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}

export default function Comparator() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("input");
  const [inputStep, setInputStep] = useState<InputStep>(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [postcodeGuessed, setPostcodeGuessed] = useState(false);
  const [distributor, setDistributor] = useState<Distributor>("Citipower");
  const [days, setDays] = useState(91);
  const [mode, setMode] = useState<Mode>("simple");
  const [anytime, setAnytime] = useState(1150);
  const [peak, setPeak] = useState(0);
  const [shoulder, setShoulder] = useState(0);
  const [offpeak, setOffpeak] = useState(0);
  const [showCl, setShowCl] = useState(false);
  const [cl, setCl] = useState(0);
  const [profile, setProfile] = useState<HomeProfile>(DEFAULT_PROFILE);
  const [usageSource, setUsageSource] = useState<UsageSource>("estimate");
  const [hasSolar, setHasSolar] = useState(false);
  const [solarExportRaw, setSolarExportRaw] = useState("");
  const [currentBillRaw, setCurrentBillRaw] = useState("");
  const [email, setEmail] = useState("");
  const [wantsAlerts, setWantsAlerts] = useState(false);
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("idle");
  const [scanBanner, setScanBanner] = useState<{ retailer: string | null; warnings: string[] } | null>(null);
  const [currentRetailer, setCurrentRetailer] = useState("");
  // Which period the result numbers and charts are shown for.
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("quarter");
  const [restored, setRestored] = useState(false);

  // Remember the check in this browser, so a refresh or a return visit
  // doesn't start from scratch. Nothing leaves the device.
  const SAVE_KEY = "utilo.check.v1";
  useEffect(() => {
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(SAVE_KEY); } catch { raw = null; }
    if (!raw) return;
    // Applied on the next tick so the first paint matches the server's.
    const t = setTimeout(() => {
      try {
        const d = JSON.parse(raw as string);
        if (d.distributor) setDistributor(d.distributor);
        if (typeof d.postcode === "string") setPostcode(d.postcode);
        if (typeof d.days === "number") setDays(d.days);
        if (d.mode) setMode(d.mode);
        if (typeof d.anytime === "number") setAnytime(d.anytime);
        if (typeof d.peak === "number") setPeak(d.peak);
        if (typeof d.shoulder === "number") setShoulder(d.shoulder);
        if (typeof d.offpeak === "number") setOffpeak(d.offpeak);
        if (typeof d.cl === "number") setCl(d.cl);
        if (typeof d.showCl === "boolean") setShowCl(d.showCl);
        if (d.profile) setProfile({ ...DEFAULT_PROFILE, ...d.profile });
        if (d.usageSource) setUsageSource(d.usageSource);
        if (typeof d.hasSolar === "boolean") setHasSolar(d.hasSolar);
        if (typeof d.solarExportRaw === "string") setSolarExportRaw(d.solarExportRaw);
        if (typeof d.currentBillRaw === "string") setCurrentBillRaw(d.currentBillRaw);
        if (typeof d.email === "string") setEmail(d.email);
        if (typeof d.currentRetailer === "string") setCurrentRetailer(d.currentRetailer);
        if (typeof d.customerName === "string") setCustomerName(d.customerName);
        if (typeof d.address === "string") setAddress(d.address);
        if (typeof d.suburb === "string") setSuburb(d.suburb);
        if (d.inputStep === 2 || d.inputStep === 3) setInputStep(d.inputStep);
        setRestored(true);
      } catch {
        /* ignore a bad saved value */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ distributor, postcode, days, mode, anytime, peak, shoulder, offpeak, cl, showCl, profile, usageSource, hasSolar, solarExportRaw, currentBillRaw, email, inputStep, currentRetailer, customerName, address, suburb }),
      );
    } catch {
      /* storage unavailable */
    }
  }, [distributor, postcode, days, mode, anytime, peak, shoulder, offpeak, cl, showCl, profile, usageSource, hasSolar, solarExportRaw, currentBillRaw, email, inputStep, currentRetailer, customerName, address, suburb]);

  function startFresh() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    window.location.reload();
  }

  // Best-effort network guess whenever a 4-digit postcode is entered — run
  // directly from the input's onChange (a real user event) rather than an
  // effect, so it's one state update, not a derived cascade. The person can
  // always still pick a different network from the grid below; doing so is
  // tracked as its own event too, so a postcode edit never silently
  // overwrites a manual pick without the person seeing it change.
  function applyPostcode(raw: string) {
    const cleaned = raw.replace(/\D/g, "").slice(0, 4);
    setPostcode(cleaned);
    const guess = cleaned.length === 4 ? guessDistributorFromPostcode(cleaned) : null;
    if (guess) {
      setDistributor(guess);
      setPostcodeGuessed(true);
    } else {
      setPostcodeGuessed(false);
    }
  }

  function patchProfile(patch: Partial<HomeProfile>) {
    setProfile((p) => ({ ...p, ...patch }));
  }
  const useEst = usageSource === "estimate";
  const est = useMemo(() => estimateUsage(profile, days), [profile, days]);
  const solarExportKwh = useEst ? est.solarExportKwh : hasSolar || profile.hasSolar ? parseFloat(solarExportRaw) || 0 : 0;
  const hasSolarEff = useEst ? profile.hasSolar : hasSolar || profile.hasSolar;
  const clKwh = useEst ? est.cl : cl;

  function handleBillExtracted(bill: ExtractedBill) {
    // Gas on the bill (gas-only or dual): keep it for the gas check.
    if (bill.gasMj) {
      try {
        window.localStorage.setItem(
          "utilo.gas.v1",
          JSON.stringify({ zone: bill.gasDistributor ?? "Australian Gas Networks", days: bill.gasBillingDays ?? bill.billingDays ?? 91, mj: Math.round(bill.gasMj), billRaw: bill.gasBillTotal ? String(bill.gasBillTotal) : "", planName: bill.gasPlanName ?? "" }),
        );
      } catch { /* ignore */ }
    }
    if (bill.fuel === "gas") {
      router.push("/gas");
      return;
    }
    if (bill.distributor) {
      setDistributor(bill.distributor);
      setPostcodeGuessed(false);
    } else if (bill.postcode) {
      const guess = guessDistributorFromPostcode(bill.postcode);
      if (guess) {
        setDistributor(guess);
        setPostcodeGuessed(true);
      }
    }
    if (bill.billingDays !== null) setDays(bill.billingDays);
    setUsageSource("bill");
    if (bill.usageMode) setMode(bill.usageMode);
    if (bill.usageMode === "simple" && bill.anytimeKwh !== null) setAnytime(bill.anytimeKwh);
    if (bill.usageMode === "detailed") {
      if (bill.peakKwh !== null) setPeak(bill.peakKwh);
      if (bill.shoulderKwh !== null) setShoulder(bill.shoulderKwh);
      if (bill.offpeakKwh !== null) setOffpeak(bill.offpeakKwh);
    }
    if (bill.controlledLoadKwh !== null && bill.controlledLoadKwh > 0) {
      setCl(bill.controlledLoadKwh);
      setShowCl(true);
    }
    if (bill.currentBill !== null) setCurrentBillRaw(String(bill.currentBill));
    if (bill.customerName) setCustomerName(bill.customerName);
    if (bill.address) setAddress(bill.address);
    if (bill.suburb) setSuburb(bill.suburb);
    if (bill.postcode) setPostcode(bill.postcode);
    if (bill.hasSolar) {
      setHasSolar(true);
      patchProfile({ hasSolar: true });
      if (bill.solarExportKwh !== null) setSolarExportRaw(String(bill.solarExportKwh));
    }

    const warnings = [...bill.warnings];
    const hasUsage =
      bill.usageMode === "simple" ? bill.anytimeKwh !== null : bill.peakKwh !== null || bill.offpeakKwh !== null;
    if (!bill.distributor && !bill.postcode) warnings.push("Couldn't tell which network you're on — please check Step 1 below.");
    if (bill.billingDays === null) warnings.push("Couldn't find your billing period length — please check Step 3.");
    if (!hasUsage) warnings.push("Couldn't find your usage figures — please check Step 3.");

    if (bill.retailerName) {
      const hit = RETAILERS.find((r) => bill.retailerName!.toLowerCase().includes(r.toLowerCase().split(" ")[0]));
      if (hit) setCurrentRetailer(hit);
    }
    if (bill.fuel === "dual" && bill.gasMj) warnings.push("We also read the gas part of this bill. See your gas result on the gas check page after this.");
    setScanBanner({ retailer: bill.retailerName, warnings });
  }

  const currentBill = currentBillRaw === "" ? null : parseFloat(currentBillRaw);
  const usagePeak = useEst ? est.peak : mode === "detailed" ? peak : 0;
  const usageShoulder = useEst ? est.shoulder : mode === "detailed" ? shoulder : 0;
  const usageOffpeak = useEst ? est.offpeak : mode === "detailed" ? offpeak : 0;
  const usageAnytime = useEst ? 0 : mode === "simple" ? anytime : 0;
  const usage = {
    days,
    peak: usagePeak,
    shoulder: usageShoulder,
    offpeak: usageOffpeak,
    anytime: usageAnytime,
    cl: clKwh,
    solarExportKwh,
  };

  const matches = useMemo(
    () =>
      rankPlans(distributor, {
        days,
        peak: usagePeak,
        shoulder: usageShoulder,
        offpeak: usageOffpeak,
        anytime: usageAnytime,
        cl: clKwh,
        solarExportKwh,
      }),
    [distributor, days, usagePeak, usageShoulder, usageOffpeak, usageAnytime, clKwh, solarExportKwh],
  );
  const totalInDist = useMemo(() => PLANS.filter((p) => p[1] === distributor).length, [distributor]);
  const haveBill = currentBill !== null && !Number.isNaN(currentBill);
  const retailerBest = useMemo(
    () => (currentRetailer ? matches.find((m) => m.plan[0] === currentRetailer) ?? null : null),
    [matches, currentRetailer],
  );


  // Benchmark: what they pay now if given, else the Victorian Default Offer
  // priced at THIS household's usage (not the generic typical-household figure).
  const bench = haveBill ? (currentBill as number) : vdoBillForUsage(distributor, usage);
  const PERIOD_DAYS = { month: 365 / 12, quarter: 365 / 4, year: 365 } as const;
  const PERIOD_LABEL = { month: "a month", quarter: "a quarter", year: "a year" } as const;
  // Scale from the entered billing period to the chosen display period.
  const k = days > 0 ? PERIOD_DAYS[period] / days : 1;

  // Keep the latest result in this browser so the dashboard can show it
  // (and so a member's details are ready if they join).
  const topForSave = matches[0];
  useEffect(() => {
    if (stage !== "results" || !topForSave) return;
    try {
      window.localStorage.setItem(
        "utilo.result.v1",
        JSON.stringify({
          savedAt: new Date().toISOString(),
          distributor,
          days,
          haveBill,
          bench,
          bestRetailer: topForSave.plan[0],
          bestPlan: topForSave.plan[2],
          bestTotal: topForSave.total,
          source: useEst ? "answers" : haveBill ? "bill" : "manual",
        }),
      );
    } catch { /* ignore */ }
  }, [stage, topForSave, distributor, days, haveBill, bench, useEst]);

  const potentialWithTou = useMemo(
    () => PLANS.filter((p) => p[1] === distributor && p[6] !== null).length,
    [distributor],
  );
  const showUnlock = mode === "simple" && potentialWithTou > 0;

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      // Not wired up yet (Supabase env vars not set in Vercel) — still confirm locally so the
      // flow feels complete for whoever's testing it.
      setLeadStatus("saved");
      return;
    }
    setLeadStatus("saving");
    const top = matches[0];
    const save = top ? bench - top.total : null;
    const { error } = await supabase.from("leads").insert({
      email,
      distributor,
      billing_days: days,
      usage_mode: useEst ? "detailed" : mode,
      peak_kwh: usage.peak,
      shoulder_kwh: usage.shoulder,
      offpeak_kwh: usage.offpeak,
      anytime_kwh: usage.anytime,
      controlled_load_kwh: usage.cl,
      current_bill: currentBill,
      best_retailer: top?.plan[0] ?? null,
      best_plan_name: top?.plan[2] ?? null,
      best_total: top?.total ?? null,
      estimated_saving: save,
      estimated_saving_pct: save !== null && bench > 0 ? save / bench : null,
      wants_price_alerts: wantsAlerts,
      customer_name: customerName || null,
      address: address || null,
      suburb: suburb || null,
      postcode: postcode || null,
      has_solar: hasSolarEff,
      solar_export_kwh: hasSolarEff ? solarExportKwh : null,
      home_profile: useEst ? profile : null,
    });
    setLeadStatus(error ? "error" : "saved");
  }

  const top = matches[0];
  const rest = matches.slice(1, 9);

  const hasCurrentBill = currentBill !== null && !Number.isNaN(currentBill);

  const forecastData = useMemo(
    () => (top && days > 0 ? buildForecastSeries(bench / days, top.total / days) : []),
    [top, bench, days],
  );
  const forecastSaving =
    forecastData.length > 0 ? forecastData[forecastData.length - 1].current - forecastData[forecastData.length - 1].best : 0;

  const chartItems: ChartItem[] = top
    ? [
        ...matches.slice(0, 5).map((m, i) => ({
          label: m.plan[0],
          sublabel: m.plan[2],
          value: m.total * k,
          kind: (i === 0 ? "cheapest" : "plan") as ChartItem["kind"],
        })),
        {
          label: hasCurrentBill ? "Your bill" : "Default offer (VDO)",
          sublabel: hasCurrentBill ? "What you told us you're paying now" : "Essential Services Commission benchmark",
          value: bench * k,
          // Green when what they pay now already beats the cheapest plan we
          // found, red when they're paying more than they need to. Grey for
          // an estimate against the default offer.
          kind: hasCurrentBill ? (bench <= top.total + 1 ? "referenceGood" : "referenceBad") : "reference",
        },
      ]
    : [];

  return (
    <>
      <SiteHeader active="check" />

      <div className={styles.wrap}>
        {stage === "input" && (
          <>
            {restored && (
              <div className={styles.restoredBar}>
                <span>We&apos;ve filled in your last answers.</span>
                <button type="button" onClick={startFresh}>Start fresh</button>
              </div>
            )}
        <section className={styles.hero}>
          <span className={styles.residentialTag}>Victorian homes · NSW, SA, QLD coming</span>
          <h1>Check your plan</h1>
          <p className={styles.lede}>
            Got a bill? Snap it and we&apos;ll read it. No bill? Answer a few quick questions about your home. Free either way,
            no sign-up. Gas bill? <Link href="/gas">Check gas</Link>.
          </p>
        </section>

        <BillPhotoUpload onApply={handleBillExtracted} />
        {inputStep === 1 && <StateWaitlist compact />}

        {scanBanner && (
          <div className={styles.scanBanner}>
            <div className={styles.scanBannerHead}>
              <span>
                {scanBanner.retailer
                  ? `Read your ${scanBanner.retailer} bill — we've filled in what we could below.`
                  : "We've filled in what we could read from your bill below."}
              </span>
              <button type="button" className={styles.scanBannerClose} onClick={() => setScanBanner(null)} aria-label="Dismiss">
                ×
              </button>
            </div>
            {scanBanner.warnings.length > 0 && (
              <ul className={styles.scanBannerWarnings}>
                {scanBanner.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={styles.wizardSteps}>
          {INPUT_STEPS.map((n, idx) => (
            <div className={styles.wizardStepItem} key={n}>
              <div className={styles.wizardDotGroup}>
                <span
                  className={`${styles.wizardDot} ${
                    n === inputStep ? styles.wizardDotActive : n < inputStep ? styles.wizardDotDone : ""
                  }`}
                >
                  {n < inputStep ? "✓" : n}
                </span>
                <span className={`${styles.wizardDotLabel} ${n === inputStep ? styles.wizardDotLabelActive : ""}`}>
                  {INPUT_STEP_LABELS[n]}
                </span>
              </div>
              {idx < INPUT_STEPS.length - 1 && <span className={styles.wizardDotLine} />}
            </div>
          ))}
        </div>

        {inputStep === 1 && (
          <div className={styles.card}>
            <div className={styles.stepHead}>
              <div className={styles.stepIcon}>
                <IconHome />
              </div>
              <div className={styles.stepHeadText}>
                <div className={styles.stepLabel}>
                  <span className={styles.stepNum}>1</span> Your address
                </div>
                <span className={styles.stepSub}>Sets your network automatically</span>
              </div>
            </div>
            <p className={`${styles.helper} ${styles.noTopMargin}`}>
              Your postcode sets your network.
            </p>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="custName">
                  Your name <span className={styles.unitNote}>(optional)</span>
                </label>
                <input
                  id="custName"
                  type="text"
                  placeholder="Jane Smith"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="postcode">Postcode</label>
                <input
                  id="postcode"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="3121"
                  value={postcode}
                  onChange={(e) => applyPostcode(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="address">
                  Street address <span className={styles.unitNote}>(optional)</span>
                </label>
                <input
                  id="address"
                  type="text"
                  placeholder="12 Smith Street"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="suburb">
                  Suburb <span className={styles.unitNote}>(optional)</span>
                </label>
                <input id="suburb" type="text" placeholder="Richmond" value={suburb} onChange={(e) => setSuburb(e.target.value)} />
              </div>
            </div>

            {postcode.length === 4 && postcodeGuessed && (
              <div className={`${styles.scanBanner} ${styles.mt16}`}>
                <div className={styles.scanBannerHead}>
                  <span>
                    Network set to <strong>{distributor}</strong>. Wrong? Pick another below.
                  </span>
                </div>
              </div>
            )}
            {postcode.length === 4 && !postcodeGuessed && (
              <div className={`${styles.unlockHint} ${styles.mt16}`}>
                Couldn&apos;t match that postcode — pick your network below.
              </div>
            )}

            <div className={`${styles.distGrid} ${styles.mt16}`}>
              {DISTRIBUTORS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`${styles.distBtn} ${d === distributor ? styles.distBtnActive : ""}`}
                  onClick={() => {
                    setDistributor(d);
                    setPostcodeGuessed(false);
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className={styles.helper}>
              Not sure? It&apos;s listed on your bill as &ldquo;Distributor&rdquo;.
            </p>

            <div className={`${styles.stepLabel} ${styles.mt16}`}>Who&apos;s your retailer now? <span className={styles.unitNote}>(optional)</span></div>
            <div className={styles.choiceRow}>
              {RETAILERS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`${styles.choiceBtn} ${r === currentRetailer ? styles.choiceBtnActive : ""}`}
                  onClick={() => setCurrentRetailer(r === currentRetailer ? "" : r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className={styles.helper}>We&apos;ll show their best plan for you next to the overall winner.</p>
          </div>
        )}

        {inputStep === 2 && (
          <div className={styles.card}>
            <div className={styles.stepHead}>
              <div className={`${styles.stepIcon} ${styles.stepIconTeal}`}>
                <IconPeople />
              </div>
              <div className={styles.stepHeadText}>
                <div className={styles.stepLabel}>
                  <span className={styles.stepNum}>2</span> Your home
                </div>
                <span className={styles.stepSub}>So we price plans against how you use power, not an average home</span>
              </div>
            </div>

            <div className={styles.profileField}>
              <div className={styles.profileLabel}>People living here</div>
              <Choice
                value={profile.people}
                onChange={(v) => patchProfile({ people: v })}
                options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: n === 6 ? "6+" : String(n) }))}
              />
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>Home type</div>
              <Choice
                value={profile.dwelling}
                onChange={(v) => patchProfile({ dwelling: v })}
                options={[
                  { value: "apartment", label: "Apartment" },
                  { value: "townhouse", label: "Townhouse" },
                  { value: "house", label: "House" },
                ]}
              />
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>Who&apos;s home during the day?</div>
              <Choice
                value={profile.daytimeHome}
                onChange={(v) => patchProfile({ daytimeHome: v })}
                options={[
                  { value: "away", label: "Mostly out" },
                  { value: "some", label: "Some of the time" },
                  { value: "home", label: "Home most days" },
                ]}
              />
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>Heating</div>
              <Choice
                value={profile.heating}
                onChange={(v) => patchProfile({ heating: v })}
                options={[
                  { value: "gas_none", label: "Gas / none" },
                  { value: "reverse_cycle", label: "Reverse-cycle A/C" },
                  { value: "resistive", label: "Electric heaters" },
                ]}
              />
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>Air-con for cooling</div>
              <Choice
                value={profile.cooling}
                onChange={(v) => patchProfile({ cooling: v })}
                options={[
                  { value: true, label: "Yes" },
                  { value: false, label: "No" },
                ]}
              />
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>Hot water</div>
              <Choice
                value={profile.hotWater}
                onChange={(v) => patchProfile({ hotWater: v })}
                options={[
                  { value: "gas_solar", label: "Gas / solar" },
                  { value: "electric_controlled", label: "Electric, off-peak meter" },
                  { value: "electric_general", label: "Electric, normal meter" },
                  { value: "heat_pump", label: "Heat pump" },
                ]}
              />
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>Pool or spa</div>
              <Choice
                value={profile.pool}
                onChange={(v) => patchProfile({ pool: v })}
                options={[
                  { value: false, label: "No" },
                  { value: true, label: "Yes" },
                ]}
              />
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>Electric vehicle</div>
              <Choice
                value={profile.ev}
                onChange={(v) => patchProfile({ ev: v })}
                options={[
                  { value: false, label: "No" },
                  { value: true, label: "Yes" },
                ]}
              />
              {profile.ev && (
                <Choice
                  value={profile.evCharging}
                  onChange={(v) => patchProfile({ evCharging: v })}
                  options={[
                    { value: "overnight", label: "Charge overnight" },
                    { value: "anytime", label: "Charge any time" },
                  ]}
                />
              )}
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>Rooftop solar</div>
              <Choice
                value={profile.hasSolar}
                onChange={(v) => patchProfile({ hasSolar: v })}
                options={[
                  { value: false, label: "No solar" },
                  { value: true, label: "I have solar" },
                ]}
              />
              {profile.hasSolar && (
                <div className={styles.field} style={{ marginTop: 10, maxWidth: 220 }}>
                  <label htmlFor="solarKw">System size (kW)</label>
                  <input
                    id="solarKw"
                    type="number"
                    min={0.5}
                    step={0.1}
                    value={profile.solarKw}
                    onChange={(e) => patchProfile({ solarKw: Math.max(0, parseFloat(e.target.value) || 0) })}
                  />
                  <span className={styles.unitNote}>We use each plan&apos;s real feed-in rate ({totalWithSolarFit()} of {PLAN_COUNT} publish one).</span>
                </div>
              )}
            </div>
          </div>
        )}

        {inputStep === 3 && (
          <div className={styles.card}>
            <div className={styles.stepHead}>
              <div className={`${styles.stepIcon} ${styles.stepIconAmber}`}>
                <IconGauge />
              </div>
              <div className={styles.stepHeadText}>
                <div className={styles.stepLabel}>
                  <span className={styles.stepNum}>3</span> Your usage
                </div>
                <span className={styles.stepSub}>Estimated from your home, or typed from a bill</span>
              </div>
            </div>
            <div className={styles.modeToggle}>
              <button
                type="button"
                className={useEst ? styles.modeToggleActive : ""}
                onClick={() => setUsageSource("estimate")}
              >
                Estimate from my home
              </button>
              <button
                type="button"
                className={!useEst ? styles.modeToggleActive : ""}
                onClick={() => setUsageSource("bill")}
              >
                Enter from my bill
              </button>
            </div>

            <div className={`${styles.fieldGrid} ${styles.sectionGap}`}>
              <div className={styles.field}>
                <label htmlFor="days">Period to compare (days)</label>
                <input
                  id="days"
                  type="number"
                  min={1}
                  max={366}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, parseFloat(e.target.value) || 91))}
                />
                <span className={styles.unitNote}>usually ~90 for a quarterly bill</span>
              </div>
              <div className={styles.field}>
                <label htmlFor="currentBill">
                  What you pay now <span className={styles.unitNote}>(optional)</span>
                </label>
                <input
                  id="currentBill"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="e.g. 425.31"
                  value={currentBillRaw}
                  onChange={(e) => setCurrentBillRaw(e.target.value)}
                />
                <span className={styles.unitNote}>$ for that period. Blank = compare to the default offer.</span>
              </div>
            </div>

            {useEst ? (
              <div className={styles.sectionGap}>
                <div className={styles.estTiles}>
                  <div className={styles.estTile}>
                    <div className={`${styles.estV} mono`}>~{est.totalKwh.toLocaleString("en-AU")}</div>
                    <div className={styles.estL}>kWh over {days} days</div>
                  </div>
                  <div className={styles.estTile}>
                    <div className={`${styles.estV} mono`}>~{est.annualKwh.toLocaleString("en-AU")}</div>
                    <div className={styles.estL}>kWh a year from the grid</div>
                  </div>
                  <div className={styles.estTile}>
                    <div className={`${styles.estV} mono`}>{TYPICAL_ANNUAL_KWH.toLocaleString("en-AU")}</div>
                    <div className={styles.estL}>typical household</div>
                  </div>
                </div>
                <p className={styles.helper}>
                  {est.annualKwh > TYPICAL_ANNUAL_KWH * 1.1
                    ? `Your home likely uses about ${Math.round((est.annualKwh / TYPICAL_ANNUAL_KWH - 1) * 100)}% more than the typical household.`
                    : est.annualKwh < TYPICAL_ANNUAL_KWH * 0.9
                      ? `Your home likely uses about ${Math.round((1 - est.annualKwh / TYPICAL_ANNUAL_KWH) * 100)}% less than the typical household.`
                      : "Your home looks close to the typical household."}{" "}
                  This is an estimate from your answers, not meter data. Enter your bill for exact figures.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.sectionGap}>
                  <div className={styles.modeToggle}>
                    <button
                      type="button"
                      className={mode === "simple" ? styles.modeToggleActive : ""}
                      onClick={() => setMode("simple")}
                    >
                      Total usage only
                    </button>
                    <button
                      type="button"
                      className={mode === "detailed" ? styles.modeToggleActive : ""}
                      onClick={() => setMode("detailed")}
                    >
                      Peak / off-peak
                    </button>
                  </div>
                </div>
                {mode === "simple" ? (
                  <div className={`${styles.fieldGrid} ${styles.sectionGap}`}>
                    <div className={styles.field}>
                      <label htmlFor="anytime">Total usage (kWh)</label>
                      <input id="anytime" type="number" min={0} value={anytime} onChange={(e) => setAnytime(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                ) : (
                  <div className={`${styles.fieldGrid} ${styles.sectionGap}`}>
                    <div className={styles.field}>
                      <label htmlFor="peak">Peak (kWh)</label>
                      <input id="peak" type="number" min={0} value={peak} onChange={(e) => setPeak(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="shoulder">Shoulder (kWh)</label>
                      <input id="shoulder" type="number" min={0} value={shoulder} onChange={(e) => setShoulder(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="offpeak">Off-peak (kWh)</label>
                      <input id="offpeak" type="number" min={0} value={offpeak} onChange={(e) => setOffpeak(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                )}
                <button type="button" className={styles.clToggle} onClick={() => setShowCl((v) => !v)}>
                  {showCl ? "- Hide controlled load" : "+ Controlled load / off-peak hot water"}
                </button>
                {showCl && (
                  <div className={`${styles.fieldGrid} ${styles.sectionGap}`}>
                    <div className={styles.field}>
                      <label htmlFor="cl">Controlled load (kWh)</label>
                      <input id="cl" type="number" min={0} value={cl} onChange={(e) => setCl(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                )}
                {hasSolarEff && (
                  <div className={`${styles.fieldGrid} ${styles.sectionGap}`}>
                    <div className={styles.field}>
                      <label htmlFor="solarExport">Solar exported (kWh)</label>
                      <input
                        id="solarExport"
                        type="number"
                        min={0}
                        placeholder="e.g. 450"
                        value={solarExportRaw}
                        onChange={(e) => setSolarExportRaw(e.target.value)}
                      />
                      <span className={styles.unitNote}>On your bill as &ldquo;exported&rdquo;.</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className={styles.counterStrip}>
              <span className={styles.count}>{matches.length}</span>
              <span className={styles.txt}>of {totalInDist} plans on this network priced for you</span>
            </div>
            {!useEst && showUnlock && (
              <div className={styles.unlockHint}>
                Peak / off-peak figures could unlock up to {matches.length + potentialWithTou} plans instead of {matches.length}.
              </div>
            )}
          </div>
        )}

        <div className={styles.wizardNav}>
          {inputStep > 1 ? (
            <button
              type="button"
              className={styles.wizardBackBtn}
              onClick={() => {
                setInputStep((s) => prevInputStep(s));
                scrollToTop();
              }}
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          {inputStep < 3 ? (
            <button
              type="button"
              className={styles.heroCta}
              onClick={() => {
                setInputStep((s) => nextInputStep(s));
                scrollToTop();
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              className={styles.heroCta}
              onClick={() => {
                setStage("results");
                scrollToTop();
              }}
            >
              See my cheapest options →
            </button>
          )}
        </div>
        <div className={styles.stickyBar}>
          {inputStep < 3 ? (
            <button type="button" className={styles.stickyBtn} onClick={() => { setInputStep((s) => nextInputStep(s)); scrollToTop(); }}>
              Continue · step {inputStep} of 3 →
            </button>
          ) : (
            <button type="button" className={styles.stickyBtn} onClick={() => { setStage("results"); scrollToTop(); }}>
              See my savings →
            </button>
          )}
        </div>
          </>
        )}

        {stage === "results" && (
          <>
        <section className={styles.resultsTopBar}>
          <button
            type="button"
            className={styles.backLink}
            onClick={() => {
              setStage("input");
              scrollToTop();
            }}
          >
            ← Edit my details
          </button>
          {matches.length > 0 && (
            <span className={styles.resultsSub}>
              {matches.length} comparable plan{matches.length === 1 ? "" : "s"} for {distributor} · {days}-day period ·{" "}
              <span className={PRICES_STALE ? styles.freshStale : styles.fresh} title={PRICES_STALE ? "These prices may be out of date" : "Retailers' published prices"}>
                prices checked {fmtUpdated()}{PRICES_STALE ? " (may be out of date)" : ""}
              </span>
            </span>
          )}
        </section>

          {!top ? (
            <div className={styles.emptyState}>
              No comparable plans yet — go back and enter your usage (or switch to detailed peak/off-peak entry) to
              see ranked results.
            </div>
          ) : (
            <>
              {bench - top.total > 0 && (
                <div className={`${styles.resultHero} ${haveBill ? styles.resultHeroBad : ""}`}>
                  <span className={styles.resultHeroKicker}>{useEst ? "Estimated from your answers" : haveBill ? "Based on your bill: you're paying more than you need to" : "Based on your usage"}</span>
                  <div className={styles.resultHeroLabel}>You could save about</div>
                  <div className={styles.resultHeroNum}>${Math.round(periodBreakdown(bench - top.total, days).annual).toLocaleString("en-AU")}</div>
                  <div className={styles.resultHeroSub}>
                    a year with {top.plan[0]}, vs {haveBill ? "your current bill" : "the default offer"}
                  </div>
                  <FunEquivalents dollars={periodBreakdown(bench - top.total, days).annual} />
                  {RETAILER_LINKS[top.plan[0]] ? (
                    <a href={RETAILER_LINKS[top.plan[0]]} target="_blank" rel="noopener noreferrer" className={styles.resultHeroBtn}>
                      See the plan →
                    </a>
                  ) : (
                    <a href="#top-plan" className={styles.resultHeroBtn}>See the plan ↓</a>
                  )}
                  <span className={styles.resultHeroFine}>
                    Excludes sign-up credits, conditional discounts and fees. Confirm with the retailer. {PRICE_CHANGE_CLAUSE}
                  </span>
                </div>
              )}
              {RETAILER_LINKS[top.plan[0]] && bench - top.total > 0 && (
                <div className={styles.stickyBar}>
                  <a href={RETAILER_LINKS[top.plan[0]]} target="_blank" rel="noopener noreferrer" className={styles.stickyBtn}>
                    Switch with {top.plan[0]} · save ${Math.round(periodBreakdown(bench - top.total, days).annual).toLocaleString("en-AU")}/yr →
                  </a>
                </div>
              )}
              {haveBill && bench - top.total <= 0 && (
                <div className={`${styles.resultHero} ${styles.resultHeroGood}`}>
                  <span className={styles.resultHeroKicker}>Based on your bill</span>
                  <div className={styles.resultHeroLabel}>Good news</div>
                  <div className={styles.resultHeroNum}>You&apos;re on a good deal</div>
                  <div className={styles.resultHeroSub}>
                    Nothing we found beats what you pay now by enough to bother. Members get told the moment that changes.
                  </div>
                </div>
              )}
              {haveBill && (
                <div className={styles.billNudge}>
                  <b>Based on one bill.</b> Prices are exact for today. Members get every plan re-priced each morning and a saved result every month, so the
                  answer stays current.
                </div>
              )}
              {!haveBill && (
                <div className={styles.billNudge}>
                  <b>This is an estimate.</b> Prices are exact, but your usage is a typical figure for a home like yours. Snap your bill at the top of the
                  page for your real numbers.
                </div>
              )}
              <div className={styles.bestCard} id="top-plan">
                <span className={styles.bestTag}>{bench - top.total > 0 ? "Yes, you'd save with" : haveBill ? "Closest to what you pay" : "Cheapest we found"}</span>
                <div className={styles.retailer}>
                  {top.plan[0]}
                  <span className={`${styles.offerTag} ${top.plan[3] === "MARKET" ? styles.offerMarket : styles.offerStanding}`}>
                    {top.plan[3] === "MARKET" ? "Market offer" : "Standing offer"}
                  </span>
                  {isEvFriendly(top.plan) && <EvBadge />}
                  {solarExportKwh > 0 && top.plan[10] !== null && <SolarBadge />}
                </div>
                <div className={styles.plan}>{top.plan[2]}</div>
                <div className={styles.periodToggle} role="tablist" aria-label="Show figures per">
                  {(["month", "quarter", "year"] as const).map((pp) => (
                    <button key={pp} type="button" role="tab" aria-selected={period === pp} className={period === pp ? styles.periodOn : styles.periodBtn} onClick={() => setPeriod(pp)}>
                      {pp === "month" ? "Monthly" : pp === "quarter" ? "Quarterly" : "Yearly"}
                    </button>
                  ))}
                </div>
                <div className={styles.nums}>
                  <div className={styles.numBlock}>
                    <div className={`${styles.v} mono`}>{fmtCurrency(top.total * k)}</div>
                    <div className={styles.l}>{PERIOD_LABEL[period]} on this plan</div>
                  </div>
                  <div className={`${styles.numBlock} ${styles.save}`}>
                    <div className={`${styles.v} mono`}>
                      {fmtCurrency(Math.abs(bench - top.total) * k)}
                    </div>
                    <div className={styles.l}>
                      {bench - top.total >= 0 ? "you'd save" : "extra cost"} {PERIOD_LABEL[period]} vs {haveBill ? "your bill" : "the default offer"}
                    </div>
                  </div>
                  <div className={`${styles.numBlock} ${styles.save}`}>
                    <div className={`${styles.v} mono`}>{fmtPct(Math.abs(bench > 0 ? (bench - top.total) / bench : 0))}</div>
                    <div className={styles.l}>{bench - top.total >= 0 ? "cheaper" : "dearer"}</div>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.rateToggleBtn}
                  onClick={() => setExpandedKey((k) => (k === "best" ? null : "best"))}
                >
                  {expandedKey === "best" ? "Hide rate breakdown ▴" : "See the rate breakdown ▾"}
                </button>
                {expandedKey === "best" && <RateBreakdown plan={top.plan} solarExportKwh={solarExportKwh} />}

                <p className={styles.scaleNote}>
                  From your {days}-day period, scaled to {PERIOD_LABEL[period]}. Usage changes with the seasons, so a year is the fairest view.
                </p>
                <div className={styles.getPlan}>
                  <div className={styles.getPlanLogo} aria-hidden="true">{top.plan[0].split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
                  <div className={styles.getPlanText}>
                    <b>Get this plan from {top.plan[0]}</b>
                    <span>
                      {RETAILER_LINKS[top.plan[0]]
                        ? `Opens ${top.plan[0]}'s website in a new tab. Look for "${top.plan[2]}". Their page has the full offer details, conditions and the Energy Fact Sheet.`
                        : `Search for "${top.plan[2]}" on ${top.plan[0]}'s website for the full offer details and the Energy Fact Sheet.`}
                    </span>
                  </div>
                  {RETAILER_LINKS[top.plan[0]] && (
                    <a href={RETAILER_LINKS[top.plan[0]]} target="_blank" rel="noopener noreferrer" className={styles.switchBtn}>
                      Go to {top.plan[0]} →
                    </a>
                  )}
                </div>
              </div>

              <div className={styles.chartPair}>
              {forecastData.length > 0 && (
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Your 12-month forecast</div>
                  <p className={styles.forecastIntro}>
                    If your usage stays about the same, here&apos;s how {hasCurrentBill ? "your current plan" : "the VDO benchmark"}{" "}
                    adds up against the cheapest match over the year ahead.
                  </p>
                  <ForecastChart
                    data={forecastData}
                    currentLabel={hasCurrentBill ? "Your current plan" : "VDO benchmark"}
                  />
                  {forecastSaving > 1 ? (
                    <p className={styles.forecastCallout}>
                      Projected to save <strong>{fmtCurrency(forecastSaving)}</strong> over the next 12 months by
                      switching to {top.plan[0]}.
                    </p>
                  ) : (
                    <p className={styles.forecastCallout}>
                      {hasCurrentBill ? "Your current plan" : "The VDO benchmark"} is already close to the cheapest
                      option we found — nothing urgent to change.
                    </p>
                  )}
                </div>
              )}

                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Your bill vs. the cheapest options</div>
                  <ResultsChart items={chartItems} />
                </div>
              </div>

              {retailerBest && top && (
                <div className={styles.stayCard}>
                  <div>
                    <b>Staying with {currentRetailer}?</b> Their best plan for you is &ldquo;{retailerBest.plan[2]}&rdquo; at{" "}
                    {fmtCurrency(retailerBest.total)} for {days} days.
                  </div>
                  <div className={styles.stayNum}>
                    {retailerBest.total - top.total > 1 ? (
                      <>
                        <b>${Math.round(periodBreakdown(retailerBest.total - top.total, days).annual).toLocaleString("en-AU")}</b> a year more by moving to {top.plan[0]}
                      </>
                    ) : (
                      <>Already the cheapest we found. No need to move.</>
                    )}
                  </div>
                  {!haveBill && (
                    <span className={styles.stayNote}>Enter your bill total to compare against what you pay now, not the default offer.</span>
                  )}
                </div>
              )}
              <details className={styles.detailsBox}>
                <summary>See the details: every plan, the maths and switching tips</summary>
                <div className={styles.detailsInner}>
              <HowWeWorkedItOut
                plan={top.plan}
                usage={usage}
                bench={bench}
                haveBill={haveBill}
                distributor={distributor}
                profile={useEst ? profile : null}
                est={useEst ? est : null}
                priceDate={fmtUpdated()}
              />
                <details className={styles.switchHelp}>
                  <summary>Before you switch: what to expect</summary>
                  <ul>
                    <li><b>Have ready:</b> a recent bill (for your NMI and address), your ID, and a payment method.</li>
                    <li><b>Takes about 10 minutes</b> online. The retailer will ask whether you own or rent, and whether you have solar.</li>
                    <li><b>No interruption.</b> Your power stays on; only the company billing you changes. Nobody visits.</li>
                    <li><b>Cooling-off:</b> you can cancel within 10 business days of agreeing, without penalty.</li>
                    <li><b>Check the fine print:</b> contract length, any exit fee, whether the rate is fixed or variable, and the conditions on discounts.</li>
                    <li><b>Final bill:</b> your old retailer sends one for the days up to the switch. Pay it as normal.</li>
                  </ul>
                </details>
                  <div className={styles.chartTitle}>All {matches.length} comparable plans, cheapest first</div>

                  

                  <div className={styles.planList}>
                    {rest.map((m, i) => {
                      const mSave = bench - m.total;
                      const rowKey = m.plan[0] + m.plan[2] + i;
                      const isOpen = expandedKey === rowKey;
                      return (
                        <div className={styles.planRowWrap} key={rowKey}>
                          <button
                            type="button"
                            className={styles.planRow}
                            onClick={() => setExpandedKey((k) => (k === rowKey ? null : rowKey))}
                            aria-expanded={isOpen}
                          >
                            <div className={styles.left}>
                              <span className={styles.rk}>#{i + 2}</span>
                              <span className={styles.rname}>{m.plan[0]}</span>
                              <span
                                className={`${styles.offerTag} ${m.plan[3] === "MARKET" ? styles.offerMarket : styles.offerStanding}`}
                              >
                                {m.plan[3] === "MARKET" ? "Market" : "Standing"}
                              </span>
                              {isEvFriendly(m.plan) && <EvBadge />}
                              {solarExportKwh > 0 && m.plan[10] !== null && <SolarBadge />}
                              <div className={styles.pname}>
                                <span className={styles.pnameText}>{m.plan[2]}</span>
                                <span className={styles.rateHint}>{isOpen ? "Hide rates ▴" : "See rates ▾"}</span>
                              </div>
                            </div>
                            <div className={styles.right}>
                              <div className={styles.tot}>{fmtCurrency(m.total)}</div>
                              <div className={`${styles.sav} ${mSave < 0 ? styles.savNeg : ""}`}>
                                {mSave >= 0 ? "-" : "+"}
                                {fmtCurrency(Math.abs(mSave))}
                              </div>
                            </div>
                          </button>
                          {isOpen && (
                            <div className={styles.planRowExpanded}>
                              <RateBreakdown plan={m.plan} solarExportKwh={solarExportKwh} />
                              {RETAILER_LINKS[m.plan[0]] && (
                                <a
                                  href={RETAILER_LINKS[m.plan[0]]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.rowSwitchLink}
                                >
                                  Go to {m.plan[0]}&apos;s site →
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                
              {top && (
                <SaveCheck
                  billingDays={days}
                  referenceTotal={bench}
                  bestTotal={top.total}
                  bestRetailer={top.plan[0]}
                  bestPlanName={top.plan[2]}
                  source={haveBill ? "bill" : "manual"}
                />
              )}

                </div>
              </details>

              <PricingSection
                email={email}
                onEmailChange={setEmail}
                yearlySaving={top && bench - top.total > 0 ? periodBreakdown(bench - top.total, days).annual : 0}
                bestRetailer={top ? top.plan[0] : ""}
                profile={{
                  distributor,
                  billingDays: days,
                  usageMode: useEst ? "detailed" : mode,
                  peak: usagePeak,
                  shoulder: usageShoulder,
                  offpeak: usageOffpeak,
                  anytime: usageAnytime,
                  cl: clKwh,
                  baselineTotal: top ? top.total : null,
                  baselineRetailer: top ? top.plan[0] : null,
                  baselinePlanName: top ? top.plan[2] : null,
                  referenceTotal: bench,
                  customerName,
                  address,
                  suburb,
                  postcode,
                  hasSolar: hasSolarEff,
                  solarExportKwh,
                  homeProfile: useEst ? (profile as unknown as Record<string, unknown>) : null,
                  currentRetailer,
                }}
              />

            </>
          )}

        <div className={styles.leadCard}>
          <h3>Want a copy of this result?</h3>
          <p>We&apos;ll email your result, plus a couple of short follow-ups over the next week. Unsubscribe any time.</p>
          <label className={styles.alertsCheckboxRow}>
            <input type="checkbox" checked={wantsAlerts} onChange={(e) => setWantsAlerts(e.target.checked)} />
            Also email me if a cheaper plan appears (unsubscribe anytime).
          </label>
          <form className={styles.leadForm} onSubmit={handleLeadSubmit}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className={styles.btnPrimary} disabled={leadStatus === "saving" || leadStatus === "saved"}>
              {leadStatus === "saving" ? "Saving…" : leadStatus === "saved" ? "Saved" : "Email me this"}
            </button>
          </form>
          {leadStatus === "saved" && (
            <p className={styles.leadOk}>Thanks — we&apos;ve noted your email for this result.</p>
          )}
          {leadStatus === "error" && (
            <p className={styles.leadErr}>Something went wrong saving that — please try again in a moment.</p>
          )}
          {!supabaseConfigured && (
            <p className={styles.leadNote}>
              This preview build isn&apos;t connected to live storage yet — signups above are confirmed on-screen only.
            </p>
          )}
        </div>
          </>
        )}

        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            Independent comparison for Victorian households — not affiliated with the Victorian Government or any
            retailer. Rates come from retailers&apos; published data; estimates only, so confirm with the retailer
            before switching.{" "}
            <Link href="/default-offer">About the VDO</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/cancellation-policy">Cancellation</Link>
          </p>
        </footer>
      </div>
    </>
  );
}

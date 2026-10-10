"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DISTRIBUTORS,
  Distributor,
  PLAN_DATA_DATE,
  PLANS,
  RETAILER_COUNT,
  fmtRateCents,
  fmtRatePerDay,
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
import { supabaseConfigured } from "@/lib/supabaseClient";
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
import YourRates from "./YourRates";
import w from "./wizard.module.css";
import snap from "./snap.module.css";
import { EMPTY_RATES_FORM, costFromRates, ratesFromForm, ratesToForm, type RatesForm } from "@/lib/currentRates";
import { PRICE_CHANGE_CLAUSE, WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";

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
  1: "Where you live",
  2: "Your home",
  3: "Your bill",
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
  // Starts empty: a pre-filled figure would quietly become someone's "usage".
  const [anytime, setAnytime] = useState(0);
  const [peak, setPeak] = useState(0);
  const [shoulder, setShoulder] = useState(0);
  const [offpeak, setOffpeak] = useState(0);
  const [showCl, setShowCl] = useState(false);
  const [cl, setCl] = useState(0);
  const [profile, setProfile] = useState<HomeProfile>(DEFAULT_PROFILE);
  const [usageSource, setUsageSource] = useState<UsageSource>("bill");
  const [hasSolar, setHasSolar] = useState(false);
  const [solarExportRaw, setSolarExportRaw] = useState("");
  const [currentBillRaw, setCurrentBillRaw] = useState("");
  const [email, setEmail] = useState("");
  const [wantsAlerts, setWantsAlerts] = useState(false);
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("idle");
  const [scanBanner, setScanBanner] = useState<{ retailer: string | null; warnings: string[] } | null>(null);
  const [currentRetailer, setCurrentRetailer] = useState("");
  // The rates on their current plan, typed from the bill (or read off it).
  const [ratesForm, setRatesForm] = useState<RatesForm>(EMPTY_RATES_FORM);
  const [showRates, setShowRates] = useState(false);
  const patchRates = (patch: Partial<RatesForm>) => setRatesForm((f) => ({ ...f, ...patch }));
  // Which period the result numbers and charts are shown for.
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("quarter");
  const [restored, setRestored] = useState(false);
  // How they came in: "snap" (the bill photo, the main way), "wizard" (the
  // questions), or "read" (we've read a bill; show what we found).
  const [entry, setEntry] = useState<"snap" | "wizard" | "read">("snap");

  // Remember the check in this browser, so a refresh or a return visit
  // doesn't start from scratch. Nothing leaves the device.
  const SAVE_KEY = "utilo.check.v1";
  // Don't save until the saved answers have been read back, or the first
  // save (with empty defaults) would overwrite them.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(SAVE_KEY); } catch { raw = null; }
    // /check?start=questions or ?start=type skips the photo panel.
    const start = new URLSearchParams(window.location.search).get("start");
    if (start === "questions" || start === "type") {
      setTimeout(() => { setEntry("wizard"); setUsageSource(start === "questions" ? "estimate" : "bill"); }, 0);
    }
    if (!raw) {
      const t0 = setTimeout(() => setHydrated(true), 0);
      return () => clearTimeout(t0);
    }
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
        if (d.ratesForm && typeof d.ratesForm === "object") setRatesForm({ ...EMPTY_RATES_FORM, ...d.ratesForm });
        setRestored(true);
        setEntry("wizard");
        // "Join" links point at /check#pricing: with a saved check, go
        // straight to the result and its membership plans.
        if (window.location.hash === "#pricing" && d.distributor) {
          setStage("results");
          setTimeout(() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }), 400);
        }
      } catch {
        /* ignore a bad saved value */
      }
      setHydrated(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ distributor, postcode, days, mode, anytime, peak, shoulder, offpeak, cl, showCl, profile, usageSource, hasSolar, solarExportRaw, currentBillRaw, email, inputStep, currentRetailer, customerName, address, suburb, ratesForm }),
      );
    } catch {
      /* storage unavailable */
    }
  }, [distributor, postcode, days, mode, anytime, peak, shoulder, offpeak, cl, showCl, profile, usageSource, hasSolar, solarExportRaw, currentBillRaw, email, inputStep, currentRetailer, customerName, address, suburb, ratesForm, hydrated]);

  // Current plan pricing for the dashboard ("Your rates vs the cheapest").
  useEffect(() => {
    if (!hydrated) return;
    const rates = ratesFromForm(ratesForm);
    try {
      if (!rates && !ratesForm.planName && ratesForm.priceType === "unsure" && !ratesForm.discountEnds) return;
      window.localStorage.setItem(
        "utilo.pricing.v1",
        JSON.stringify({
          planName: ratesForm.planName || null,
          rates,
          priceType: ratesForm.priceType === "unsure" ? null : ratesForm.priceType,
          fixedUntil: ratesForm.priceType === "fixed" && ratesForm.fixedUntil ? ratesForm.fixedUntil : null,
          discountEndsAt: ratesForm.discountEnds || null,
        }),
      );
    } catch { /* storage unavailable */ }
  }, [ratesForm, hydrated]);

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
  // Victorian postcodes start with 3 (or 8 for PO boxes). Others can't be priced yet.
  const nonVic = postcode.length === 4 && !/^[38]/.test(postcode);
  const est = useMemo(() => estimateUsage(profile, days), [profile, days]);
  const solarExportKwh = useEst ? est.solarExportKwh : hasSolar || profile.hasSolar ? parseFloat(solarExportRaw) || 0 : 0;
  const hasSolarEff = useEst ? profile.hasSolar : hasSolar || profile.hasSolar;
  const clKwh = useEst ? est.cl : cl;

  function handleBillExtracted(bill: ExtractedBill) {
    // The current plan's rates and fixed/variable terms: shown in step 3 to check, and saved for the dashboard.
    setRatesForm(
      ratesToForm(bill.currentRates ?? null, {
        planName: bill.planName ?? "",
        priceType: bill.priceType ?? "unsure",
        fixedUntil: bill.priceFixedUntil ?? "",
        discountEnds: bill.discountEndsAt ?? "",
      }),
    );
    if (bill.currentRates) setShowRates(true);
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

    // Read from the results page: stay there; the numbers update in place.
    if (stage === "results") return;
    const network = bill.distributor ?? (bill.postcode ? guessDistributorFromPostcode(bill.postcode) : null);
    const outsideVic = !!bill.postcode && bill.postcode.length === 4 && !/^[38]/.test(bill.postcode);
    if (network && !outsideVic && hasUsage && bill.billingDays !== null) {
      setEntry("read");
    } else {
      setEntry("wizard");
      setInputStep(!network || outsideVic ? 1 : 3);
    }
    scrollToTop();
  }

  const typedBill = currentBillRaw === "" ? null : parseFloat(currentBillRaw);
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
  // Why the customer can't move on yet (shown under the step), if anything.
  const blockReason =
    inputStep === 1 && nonVic
      ? "We can only check Victorian addresses for now."
      : inputStep === 3 && !useEst && usagePeak + usageShoulder + usageOffpeak + usageAnytime <= 0
        ? "Snap your bill, or enter the kWh it shows. No bill to hand? Pick “No, estimate it for me”."
        : "";
  // Their own plan priced from the rates they typed. Used as "what you pay
  // now" when they didn't type a bill total.
  const myRates = useMemo(() => ratesFromForm(ratesForm), [ratesForm]);
  const ratesCost = costFromRates(myRates, usage);
  const currentBill = typedBill !== null && !Number.isNaN(typedBill) ? typedBill : ratesCost.ok ? Math.round(ratesCost.total * 100) / 100 : null;

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
      }, { ev: profile.ev }),
    [distributor, days, usagePeak, usageShoulder, usageOffpeak, usageAnytime, clKwh, solarExportKwh, profile.ev],
  );
  const totalInDist = useMemo(() => PLANS.filter((p) => p[1] === distributor && (profile.ev || !isEvFriendly(p))).length, [distributor, profile.ev]);
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
    () => PLANS.filter((p) => p[1] === distributor && p[6] !== null && (profile.ev || !isEvFriendly(p))).length,
    [distributor, profile.ev],
  );
  const showUnlock = mode === "simple" && potentialWithTou > 0;

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLeadStatus("saving");
    // Saved by the server, which re-works-out the result from this usage.
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email, distributor, days, usageMode: useEst ? "detailed" : mode,
        peak: usage.peak, shoulder: usage.shoulder, offpeak: usage.offpeak, anytime: usage.anytime, cl: usage.cl,
        currentBill, wantsAlerts, customerName, address, suburb, postcode,
        hasSolar: hasSolarEff, solarExportKwh: hasSolarEff ? solarExportKwh : 0, homeProfile: profile,
      }),
    }).catch(() => null);
    setLeadStatus(res?.ok ? "saved" : "error");
  }

  const top = matches[0];
  const rest = matches.slice(1);
  // Same rule as the dashboard: with a real bill, only call it a saving when
  // it's worth at least WORTH_SWITCHING_PER_YEAR a year.
  const yearlySave = top && days > 0 ? (bench - top.total) * (365 / days) : 0;
  const worthSwitching = haveBill ? yearlySave >= WORTH_SWITCHING_PER_YEAR : yearlySave > 0;

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
          kind: hasCurrentBill ? (worthSwitching ? "referenceBad" : "referenceGood") : "reference",
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
          <h1>{entry === "read" ? "Here's what we read" : "Check your plan"}</h1>
          <p className={styles.lede}>
            {entry === "snap" ? (
              <>The quickest, most accurate check: a photo of your electricity bill. Free, no sign-up. Gas bill? <Link href="/gas">Check gas</Link>.</>
            ) : entry === "read" ? (
              <>Have a quick look, then see your result.</>
            ) : (
              <>A few quick questions about your home. Free, no sign-up. Gas bill? <Link href="/gas">Check gas</Link>.</>
            )}
          </p>
        </section>

        {entry === "snap" && (
          <>
            <BillPhotoUpload variant="hero" onApply={handleBillExtracted} />
            <div className={snap.alt}>
              <button type="button" className={snap.altBtn} onClick={() => { setUsageSource("estimate"); setInputStep(1); setEntry("wizard"); scrollToTop(); }}>
                <b>No bill handy?</b>
                <span>Answer a few quick questions and we&apos;ll estimate →</span>
              </button>
              <button type="button" className={snap.altBtn} onClick={() => { setUsageSource("bill"); setInputStep(1); setEntry("wizard"); scrollToTop(); }}>
                <b>Rather type it in?</b>
                <span>Copy the numbers from your bill yourself →</span>
              </button>
            </div>
          </>
        )}

        {entry === "read" && (
          <div className={snap.readCard}>
            <div className={snap.readHead}>
              <span className={snap.readTick} aria-hidden="true">✓</span>
              {scanBanner?.retailer ? `Got it: your ${scanBanner.retailer} bill` : "Got it: we've read your bill"}
            </div>
            <p className={snap.readSub}>If anything looks wrong, change it before we work it out.</p>
            <dl className={snap.facts}>
              <div className={snap.fact}><dt>Network</dt><dd>{distributor}{postcode ? ` · ${postcode}` : ""}</dd></div>
              <div className={snap.fact}><dt>Bill period</dt><dd>{days} days</dd></div>
              <div className={snap.fact}>
                <dt>Electricity used</dt>
                <dd>{Math.round(usageAnytime + usagePeak + usageShoulder + usageOffpeak).toLocaleString("en-AU")} kWh{mode === "detailed" ? " (by time of day)" : ""}</dd>
              </div>
              <div className={snap.fact}><dt>Bill total</dt><dd>{typedBill !== null && !Number.isNaN(typedBill) ? fmtCurrency(typedBill) : "Not found"}</dd></div>
              {clKwh > 0 && <div className={snap.fact}><dt>Hot-water meter</dt><dd>{Math.round(clKwh).toLocaleString("en-AU")} kWh</dd></div>}
              {solarExportKwh > 0 && <div className={snap.fact}><dt>Solar sent to grid</dt><dd>{Math.round(solarExportKwh).toLocaleString("en-AU")} kWh</dd></div>}
              <div className={`${snap.fact} ${snap.factWide}`}>
                <dt>Your rates</dt>
                <dd>
                  {myRates
                    ? [
                        myRates.anytime !== null ? fmtRateCents(myRates.anytime) : null,
                        myRates.peak !== null ? "peak " + fmtRateCents(myRates.peak) : null,
                        myRates.offpeak !== null ? "off-peak " + fmtRateCents(myRates.offpeak) : null,
                        myRates.supply !== null ? fmtRatePerDay(myRates.supply) + " supply" : null,
                      ].filter(Boolean).join(" · ")
                    : "Not found, so we'll use your bill total"}
                  {myRates && ratesForm.planName ? <span className={snap.factNote}>{ratesForm.planName}{ratesForm.priceType !== "unsure" ? ` · ${ratesForm.priceType}` : ""}</span> : null}
                </dd>
              </div>
            </dl>
            {scanBanner && scanBanner.warnings.length > 0 && (
              <div className={snap.readWarn}>
                <b>Worth a check:</b>
                <ul>{scanBanner.warnings.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </div>
            )}
            <button type="button" className={snap.readGo} onClick={() => { setStage("results"); scrollToTop(); }}>
              See my result →
            </button>
            <button type="button" className={snap.readEdit} onClick={() => { setEntry("wizard"); setInputStep(3); scrollToTop(); }}>
              Check or change what we read
            </button>
          </div>
        )}

        {entry === "wizard" && (
          <>
        {!scanBanner && (
          <button type="button" className={snap.backToSnap} onClick={() => { setEntry("snap"); scrollToTop(); }}>
            📷 Got your bill after all? <u>Snap it instead</u>, it&apos;s quicker
          </button>
        )}
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
                  <span className={styles.stepNum}>1</span> Where do you live?
                </div>
                <span className={styles.stepSub}>Your postcode tells us your power network, which decides the prices you can get.</span>
              </div>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="custName">
                  First name <span className={styles.unitNote}>(optional, so we can say hi)</span>
                </label>
                <input
                  id="custName"
                  type="text"
                  placeholder="Jane"
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
                    ✓ You&apos;re on the <strong>{distributor}</strong> network. If your bill says otherwise, pick it below.
                  </span>
                </div>
              </div>
            )}
            {nonVic && (
              <div className={styles.mt16}>
                <div className={styles.unlockHint}>
                  Utilo only covers Victoria for now, so we can&apos;t price plans for {postcode} yet. NSW, SA and QLD are next. Leave your email
                  and we&apos;ll tell you when we reach you.
                </div>
                <StateWaitlist compact />
              </div>
            )}
            {postcode.length === 4 && !postcodeGuessed && !nonVic && (
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
              The network owns the poles and wires. Your bill lists it as &ldquo;Distributor&rdquo;. You can&apos;t choose it, but it changes prices.
            </p>

            <div className={`${styles.stepLabel} ${styles.mt16}`}>Who do you pay for electricity now? <span className={styles.unitNote}>(optional)</span></div>
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
            <p className={styles.helper}>We&apos;ll also show their best plan for you, in case you&apos;d rather stay.</p>
            {currentRetailer && (
              <div className={`${styles.accuracyNote} ${styles.mt16}`}>
                <b>Heads up:</b> knowing your retailer doesn&apos;t tell us which {currentRetailer} plan you&apos;re on or what you pay. Many people are on older plans that
                cost more than the retailer&apos;s current offers. For an exact answer, snap your bill (or a screenshot from the {currentRetailer} app) at the top of this
                page, or type your rates in step 3.
              </div>
            )}
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
                  <span className={styles.stepNum}>2</span> Tell us about your home
                </div>
                <span className={styles.stepSub}>Tap what fits best. Rough answers are fine; it helps us match plans to how you use power.</span>
              </div>
            </div>

            <div className={styles.profileField}>
              <div className={styles.profileLabel}>👥 How many people live here?</div>
              <Choice
                value={profile.people}
                onChange={(v) => patchProfile({ people: v })}
                options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: n === 6 ? "6+" : String(n) }))}
              />
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>🏠 What kind of home is it?</div>
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
              <div className={styles.profileLabel}>☀️ Is anyone home during the day?</div>
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
              <div className={styles.profileLabel}>🔥 How do you heat your home?</div>
              <Choice
                value={profile.heating}
                onChange={(v) => patchProfile({ heating: v })}
                options={[
                  { value: "gas_none", label: "Gas, or no heating" },
                  { value: "reverse_cycle", label: "Split system / reverse-cycle" },
                  { value: "resistive", label: "Electric heaters" },
                ]}
              />
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>❄️ Do you use air-con to cool down?</div>
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
              <div className={styles.profileLabel}>🚿 How is your water heated?</div>
              <Choice
                value={profile.hotWater}
                onChange={(v) => patchProfile({ hotWater: v })}
                options={[
                  { value: "gas_solar", label: "Gas / solar" },
                  { value: "electric_controlled", label: "Electric, on a separate off-peak meter" },
                  { value: "electric_general", label: "Electric, not sure / normal meter" },
                  { value: "heat_pump", label: "Heat pump" },
                ]}
              />
            </div>
            <div className={styles.profileField}>
              <div className={styles.profileLabel}>🏊 Pool or spa?</div>
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
              <div className={styles.profileLabel}>🚗 Do you charge an electric car at home?</div>
              <Choice
                value={profile.ev}
                onChange={(v) => patchProfile({ ev: v })}
                options={[
                  { value: false, label: "No" },
                  { value: true, label: "Yes" },
                ]}
              />
              <p className={styles.helper}>Say yes to also see plans built around cheap or free overnight EV charging. Without an EV those plans rarely work out cheaper.</p>
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
              <div className={styles.profileLabel}>🔆 Do you have rooftop solar?</div>
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
                  <span className={styles.stepNum}>3</span> Your bill
                </div>
                <span className={styles.stepSub}>A few numbers from your bill make this exact. No bill? We&apos;ll estimate.</span>
              </div>
            </div>

            {/* Q: bill or estimate */}
            <section className={w.q}>
              <div className={w.qHead}>
                <span className={w.qNum}>1</span>
                <div>
                  <h3 className={w.qTitle}>Do you have a recent electricity bill?</h3>
                  <p className={w.qSub}>Paper, PDF or the app all work. It only takes a couple of minutes.</p>
                </div>
              </div>
              <div className={w.big}>
                <button type="button" className={!useEst ? w.bigOn : w.bigBtn} onClick={() => setUsageSource("bill")}>
                  <span className={w.bigIcon} aria-hidden="true">📄</span>
                  <span><b>Yes, I have a bill</b>Snap a photo or copy a few numbers. Most accurate.</span>
                  <span className={w.tick} aria-hidden="true">✓</span>
                </button>
                <button type="button" className={useEst ? w.bigOn : w.bigBtn} onClick={() => setUsageSource("estimate")}>
                  <span className={w.bigIcon} aria-hidden="true">🏠</span>
                  <span><b>No, estimate it for me</b>We&apos;ll use your answers about your home.</span>
                  <span className={w.tick} aria-hidden="true">✓</span>
                </button>
              </div>
            </section>

            {/* Q: how long is the bill */}
            <section className={w.q}>
              <div className={w.qHead}>
                <span className={w.qNum}>2</span>
                <div>
                  <h3 className={w.qTitle}>{useEst ? "How often do you get a bill?" : "How long does your bill cover?"}</h3>
                  <p className={w.qSub}>{useEst ? "So we show costs for the same period." : "Look for the billing period, e.g. “1 Jul to 30 Sep”."}</p>
                </div>
              </div>
              <div className={w.pills}>
                {([[30, "Monthly"], [61, "Every 2 months"], [91, "Quarterly"]] as [number, string][]).map(([d, l]) => (
                  <button key={d} type="button" className={days === d ? w.pillOn : w.pill} onClick={() => setDays(d)}>{l}</button>
                ))}
                <label className={w.inline} style={{ marginTop: 0 }}>
                  or
                  <input
                    className={w.daysInput}
                    type="number"
                    min={1}
                    max={366}
                    value={days}
                    onChange={(e) => setDays(Math.max(1, parseFloat(e.target.value) || 91))}
                    aria-label="Days in the bill"
                  />
                  days
                </label>
              </div>
            </section>

            {!useEst && !scanBanner && (
              <section className={w.q}>
                <div className={w.qHead}>
                  <span className={w.qNum}>★</span>
                  <div>
                    <h3 className={w.qTitle}>Fastest and most accurate: snap it</h3>
                    <p className={w.qSub}>A photo, PDF or app screenshot fills in everything below, including the rates you really pay. Or type the numbers yourself.</p>
                  </div>
                </div>
                <BillPhotoUpload onApply={handleBillExtracted} />
              </section>
            )}

            {useEst ? (
              <>
                <section className={w.q}>
                  <div className={w.qHead}>
                    <span className={w.qNum}>3</span>
                    <div>
                      <h3 className={w.qTitle}>Here&apos;s what we think your home uses</h3>
                      <p className={w.qSub}>From your answers in step 2. Change those and this updates.</p>
                    </div>
                  </div>
                  <div className={w.estimate}>
                    <div className={w.estBig}>
                      About <b>{(est.annualKwh / 365).toLocaleString("en-AU", { maximumFractionDigits: 1 })} kWh a day</b>, or ~{est.totalKwh.toLocaleString("en-AU")} kWh a bill.
                    </div>
                    <div className={w.bars}>
                      <div className={w.barRow}>
                        <span>Your home</span>
                        <span className={w.barTrack}><span className={w.barFill} style={{ display: "block", width: `${Math.min(100, (est.annualKwh / Math.max(est.annualKwh, TYPICAL_ANNUAL_KWH)) * 100)}%` }} /></span>
                        <b>{est.annualKwh.toLocaleString("en-AU")}</b>
                      </div>
                      <div className={w.barRow}>
                        <span>Typical home</span>
                        <span className={w.barTrack}><span className={`${w.barFill} ${w.barFillTypical}`} style={{ display: "block", width: `${Math.min(100, (TYPICAL_ANNUAL_KWH / Math.max(est.annualKwh, TYPICAL_ANNUAL_KWH)) * 100)}%` }} /></span>
                        <b>{TYPICAL_ANNUAL_KWH.toLocaleString("en-AU")}</b>
                      </div>
                    </div>
                    <span className={w.rateHint}>
                      kWh a year from the grid.{" "}
                      {est.annualKwh > TYPICAL_ANNUAL_KWH * 1.1
                        ? `About ${Math.round((est.annualKwh / TYPICAL_ANNUAL_KWH - 1) * 100)}% more than a typical Victorian home.`
                        : est.annualKwh < TYPICAL_ANNUAL_KWH * 0.9
                          ? `About ${Math.round((1 - est.annualKwh / TYPICAL_ANNUAL_KWH) * 100)}% less than a typical Victorian home.`
                          : "Close to a typical Victorian home."}{" "}
                      It&apos;s an estimate, so a bill gives a sharper answer.
                    </span>
                  </div>
                </section>

                <section className={w.q}>
                  <div className={w.qHead}>
                    <span className={w.qNum}>4</span>
                    <div>
                      <h3 className={w.qTitle}>Roughly what do you pay? <span className={w.opt}>(optional)</span></h3>
                      <p className={w.qSub}>For one bill. Leave it blank and we&apos;ll compare against the Victorian Default Offer.</p>
                    </div>
                  </div>
                  <div className={w.money}>
                    <input type="number" inputMode="decimal" min={0} step={0.01} placeholder="e.g. 425" value={currentBillRaw} onChange={(e) => setCurrentBillRaw(e.target.value)} aria-label="What you pay per bill" />
                  </div>
                  {!showRates ? (
                    <button type="button" className={w.extraBtn} onClick={() => setShowRates(true)}>+ I know my rates (c/kWh)</button>
                  ) : (
                    <div style={{ marginTop: 14 }}>
                      <YourRates form={ratesForm} onChange={patchRates} split={false} showCl={false} showSolar={profile.hasSolar} cost={ratesCost} billTotal={typedBill !== null && !Number.isNaN(typedBill) ? typedBill : null} />
                    </div>
                  )}
                </section>
              </>
            ) : (
              <>
                <section className={w.q}>
                  <div className={w.qHead}>
                    <span className={w.qNum}>3</span>
                    <div>
                      <h3 className={w.qTitle}>What was the total? <span className={w.opt}>(optional)</span></h3>
                      <p className={w.qSub}>&ldquo;Total amount due&rdquo; or &ldquo;New charges&rdquo;, including GST. Skip it if you enter your rates below.</p>
                    </div>
                  </div>
                  <div className={w.money}>
                    <input type="number" inputMode="decimal" min={0} step={0.01} placeholder="e.g. 425.31" value={currentBillRaw} onChange={(e) => setCurrentBillRaw(e.target.value)} aria-label="Bill total" />
                  </div>
                </section>

                <section className={w.q}>
                  <div className={w.qHead}>
                    <span className={w.qNum}>4</span>
                    <div>
                      <h3 className={w.qTitle}>How much electricity did you use?</h3>
                      <p className={w.qSub}>Shown in kWh in the usage or charges section. If your bill splits it by time of day, pick &ldquo;Split by time&rdquo;.</p>
                    </div>
                  </div>
                  <div className={w.pills}>
                    <button type="button" className={mode === "simple" ? w.pillOn : w.pill} onClick={() => setMode("simple")}>One total</button>
                    <button type="button" className={mode === "detailed" ? w.pillOn : w.pill} onClick={() => setMode("detailed")}>Split by time (peak / off-peak)</button>
                  </div>
                  {mode === "simple" ? (
                    <div className={w.usageGrid}>
                      <label className={w.rate} htmlFor="anytime">
                        <span className={w.rateLabel}>Total usage</span>
                        <span className={w.suffixWrap}>
                          <input id="anytime" type="number" inputMode="decimal" min={0} value={anytime || ""} placeholder="e.g. 1150" onChange={(e) => setAnytime(parseFloat(e.target.value) || 0)} />
                          <span className={w.suffix}>kWh</span>
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className={w.usageGrid}>
                      {([["peak", "Peak", peak, setPeak], ["shoulder", "Shoulder (if listed)", shoulder, setShoulder], ["offpeak", "Off-peak", offpeak, setOffpeak]] as [string, string, number, (n: number) => void][]).map(([id, label, val, set]) => (
                        <label className={w.rate} htmlFor={id} key={id}>
                          <span className={w.rateLabel}>{label}</span>
                          <span className={w.suffixWrap}>
                            <input id={id} type="number" inputMode="decimal" min={0} value={val} onChange={(e) => set(parseFloat(e.target.value) || 0)} />
                            <span className={w.suffix}>kWh</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <button type="button" className={w.extraBtn} onClick={() => setShowCl((v) => !v)}>
                    {showCl ? "− No separate hot-water meter" : "+ I have a separate off-peak hot-water meter (controlled load)"}
                  </button>
                  {showCl && (
                    <div className={w.usageGrid}>
                      <label className={w.rate} htmlFor="cl">
                        <span className={w.rateLabel}>Controlled load</span>
                        <span className={w.suffixWrap}>
                          <input id="cl" type="number" inputMode="decimal" min={0} value={cl || ""} onChange={(e) => setCl(parseFloat(e.target.value) || 0)} />
                          <span className={w.suffix}>kWh</span>
                        </span>
                      </label>
                    </div>
                  )}
                  {hasSolarEff && (
                    <div className={w.usageGrid}>
                      <label className={w.rate} htmlFor="solarExport">
                        <span className={w.rateLabel}>Solar sent to the grid</span>
                        <span className={w.suffixWrap}>
                          <input id="solarExport" type="number" inputMode="decimal" min={0} placeholder="e.g. 450" value={solarExportRaw} onChange={(e) => setSolarExportRaw(e.target.value)} />
                          <span className={w.suffix}>kWh</span>
                        </span>
                        <span className={w.rateHint}>Usually labelled &ldquo;exported&rdquo; or &ldquo;feed-in&rdquo;.</span>
                      </label>
                    </div>
                  )}
                  {showUnlock && (
                    <p className={w.skip}>Tip: a peak / off-peak split lets us price up to {matches.length + potentialWithTou} plans instead of {matches.length}.</p>
                  )}
                </section>

                <section className={w.q}>
                  <div className={w.qHead}>
                    <span className={w.qNum}>5</span>
                    <div>
                      <h3 className={w.qTitle}>Your rates <span className={w.opt}>(recommended)</span></h3>
                      <p className={w.qSub}>The prices on your current plan. They let us price your plan exactly and show it next to the cheapest on your dashboard.</p>
                    </div>
                  </div>
                  <YourRates
                    form={ratesForm}
                    onChange={patchRates}
                    split={mode === "detailed"}
                    showCl={showCl}
                    showSolar={hasSolarEff}
                    cost={ratesCost}
                    billTotal={typedBill !== null && !Number.isNaN(typedBill) ? typedBill : null}
                  />
                </section>
              </>
            )}

            <div className={styles.counterStrip}>
              <span className={styles.count}>{matches.length}</span>
              <span className={styles.txt}>of {totalInDist} plans on your network will be priced for you</span>
            </div>
          </div>
        )}

        {blockReason && <p className={styles.blockNote} role="status">{blockReason}</p>}
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
              disabled={!!blockReason}
              onClick={() => {
                setInputStep((s) => nextInputStep(s));
                scrollToTop();
              }}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              className={styles.heroCta}
              disabled={!!blockReason}
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
            <button type="button" className={styles.stickyBtn} disabled={!!blockReason} onClick={() => { setInputStep((s) => nextInputStep(s)); scrollToTop(); }}>
              Next · step {inputStep} of 3 →
            </button>
          ) : (
            <button type="button" className={styles.stickyBtn} disabled={!!blockReason} onClick={() => { setStage("results"); scrollToTop(); }}>
              See my savings →
            </button>
          )}
        </div>
          </>
        )}
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
              {matches.length} plan{matches.length === 1 ? "" : "s"} from the {RETAILER_COUNT} retailers we track on {distributor} (not every plan in the market) · {days}-day period ·{" "}
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
              {worthSwitching && (
                <div className={`${styles.resultHero} ${haveBill ? styles.resultHeroBad : ""}`}>
                  <span className={styles.resultHeroKicker}>{useEst ? "Estimated from your answers" : haveBill ? "Based on your bill: you're paying more than you need to" : "Based on your usage"}</span>
                  <div className={styles.resultHeroLabel}>{haveBill ? "You could save about" : "Compared with the default offer, the cheapest plan saves up to"}</div>
                  <div className={styles.resultHeroNum}>${Math.round(periodBreakdown(bench - top.total, days).annual).toLocaleString("en-AU")}</div>
                  <div className={styles.resultHeroSub}>
                    {haveBill ? <>a year with {top.plan[0]}, vs your current bill</> : <>a year with {top.plan[0]}. Add your bill or rates to see your own saving.</>}
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
              {RETAILER_LINKS[top.plan[0]] && worthSwitching && (
                <div className={styles.stickyBar}>
                  <a href={RETAILER_LINKS[top.plan[0]]} target="_blank" rel="noopener noreferrer" className={styles.stickyBtn}>
                    {haveBill
                      ? <>Switch with {top.plan[0]} · save ${Math.round(periodBreakdown(bench - top.total, days).annual).toLocaleString("en-AU")}/yr →</>
                      : <>See the cheapest plan: {top.plan[0]} →</>}
                  </a>
                </div>
              )}
              {haveBill && !worthSwitching && (
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
              {(!haveBill || useEst) && (
                <div className={styles.accuracyCard}>
                  <div className={styles.accuracyHead}>
                    <span className={styles.accuracyBadge}>Estimate</span>
                    <b>Get your exact answer in about a minute</b>
                  </div>
                  <p className={styles.helper}>
                    {!haveBill
                      ? <>We don&apos;t know what you pay now{currentRetailer ? <>, or which {currentRetailer} plan you&apos;re on</> : null}, so we&apos;ve compared against the default offer. Many people are on older plans that cost more than any current offer.</>
                      : <>Your usage is estimated from your answers, so the saving could be higher or lower.</>}
                  </p>
                  <BillPhotoUpload onApply={handleBillExtracted} />
                  <button
                    type="button"
                    className={styles.accuracyLink}
                    onClick={() => { setStage("input"); setInputStep(3); setUsageSource("bill"); setShowRates(true); scrollToTop(); }}
                  >
                    Or type your rates and usage instead →
                  </button>
                </div>
              )}
              <div className={styles.bestCard} id="top-plan">
                <span className={styles.bestTag}>{haveBill && worthSwitching ? "Yes, you'd save with" : haveBill ? "Cheapest we found (not worth switching)" : "Cheapest plan for a home like yours"}</span>
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
                </div>
                <p className={styles.saveLine}>
                  {bench - top.total >= 0 ? (
                    <><b>{fmtCurrency((bench - top.total) * k)} less</b> {PERIOD_LABEL[period]} than {haveBill ? "your bill" : "the default offer"} ({fmtPct(bench > 0 ? (bench - top.total) / bench : 0)} cheaper)</>
                  ) : (
                    <><b>{fmtCurrency((top.total - bench) * k)} more</b> {PERIOD_LABEL[period]} than {haveBill ? "your bill" : "the default offer"}</>
                  )}
                </p>

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

              {retailerBest && top && (
                <div className={styles.stayCard}>
                  <div>
                    <b>Staying with {currentRetailer}?</b> Their cheapest current plan for you is &ldquo;{retailerBest.plan[2]}&rdquo; at{" "}
                    {fmtCurrency(retailerBest.total)} for {days} days.{!haveBill && <> You may be on an older, dearer {currentRetailer} plan. Your bill shows which.</>}
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

                </div>
              )}
              <details className={styles.detailsBox}>
                <summary>See the workings: charts, every plan and the maths</summary>
                <div className={styles.detailsInner}>
              <div className={styles.chartPair}>
              {forecastData.length > 0 && haveBill && (
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
                  <div className={styles.chartTitle}>{haveBill ? "Your bill vs. the cheapest options" : "The default offer vs. the cheapest options"}</div>
                  <ResultsChart items={chartItems} />
                </div>
              </div>

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
                                <span className={styles.rateHint}>{isOpen ? "Hide ▴" : "Rates & website ▾"}</span>
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

              <div id="pricing" style={{ scrollMarginTop: 90 }} />
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
                  // Only a real bill (typed, read, or priced from their rates) counts
                  // as "what you pay now"; never the default offer.
                  referenceTotal: haveBill ? bench : null,
                  customerName,
                  address,
                  suburb,
                  postcode,
                  hasSolar: hasSolarEff,
                  solarExportKwh,
                  // Always sent: the EV answer decides which plans they're shown.
                  homeProfile: profile as unknown as Record<string, unknown>,
                  currentRates: myRates,
                  priceType: ratesForm.priceType === "unsure" ? null : ratesForm.priceType,
                  priceFixedUntil: ratesForm.priceType === "fixed" && ratesForm.fixedUntil ? ratesForm.fixedUntil : null,
                  discountEndsAt: ratesForm.discountEnds || null,
                  currentPlanName: ratesForm.planName || null,
                  currentRetailer,
                }}
              />

            </>
          )}

        <div className={styles.leadCard}>
          <h3>Want a copy of this result?</h3>
          <p>We&apos;ll email your result so it&apos;s easy to find later.</p>
          <label className={styles.alertsCheckboxRow}>
            <input type="checkbox" checked={wantsAlerts} onChange={(e) => setWantsAlerts(e.target.checked)} />
            Also send me a couple of tips this week and tell me if a cheaper plan appears (unsubscribe any time).
          </label>
          <form className={styles.leadForm} onSubmit={handleLeadSubmit}>
            <input
              type="email"
              required
              aria-label="Your email"
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

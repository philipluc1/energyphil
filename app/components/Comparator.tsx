"use client";

import OfferDate from "./OfferDate";
import Icon from "./Icon";
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
  billDetail,
  rankPlans,
  topOpen,
  totalWithSolarFit,
  type PlanRow,
} from "@/lib/plans";
import { describeOffer } from "@/lib/planExtras";
import OfferTerms, { OfferChips } from "./OfferTerms";
import { guessDistributorFromPostcode } from "@/lib/postcodeNetwork";
import { SMALL_CUSTOMER_KWH_PER_YEAR, addressHint, checkNmi, type PropertyType } from "@/lib/meterCheck";
import { checkLocality, suburbsIn, type Localities } from "@/lib/localityCheck";
import NotifyMe from "./NotifyMe";
import s1 from "./step1.module.css";
import s2 from "./step2.module.css";
import {
  DEFAULT_PROFILE,
  AVERAGE_ANNUAL_KWH,
  averageUsage,
  usageIsIncomplete,
  estimateUsage,
  forecastFromBill,
  scaleEstimate,
  normaliseProfile,
  panelsToKw,
  type SolarAge,
  vdoBillForUsage,
  type HomeProfile,
} from "@/lib/profileUsage";
import { supabaseConfigured } from "@/lib/supabaseClient";
import type { ExtractedBill } from "@/lib/billExtraction";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import { periodBreakdown } from "@/lib/savings";
import BillPhotoUpload from "./BillPhotoUpload";
import PricingSection from "./PricingSection";
import SaveCheck from "./SaveCheck";
import HowWeWorkedItOut from "./HowWeWorkedItOut";
import MemberLock, { MEMBER_PRICE_LINE } from "./MemberLock";
import PlanViewToggle from "./PlanViewToggle";
import EstimatePanel, { BillKwhCard, EstimateStrip, thisMonth } from "./EstimatePanel";
import { cheapestPerRetailer } from "@/lib/onePerRetailer";
import r from "./results.module.css";
import RatesCompare from "./RatesCompare";
import RetailerLogo from "./RetailerLogo";
import Disclosures from "./Disclosures";
import { samePlanName } from "@/lib/planVersion";
import BillCheckCard from "./BillCheckCard";
import { billCheckFromBill, cleanBillCheck, forStorage, type BillCheck } from "@/lib/billCheck";
import { useMember } from "@/lib/useMember";
import StateWaitlist from "./StateWaitlist";
import YourRates from "./YourRates";
import w from "./wizard.module.css";
import snap from "./snap.module.css";
import { EMPTY_RATES_FORM, costFromRates, ratesFromForm, ratesToForm, type RatesForm } from "@/lib/currentRates";
import { BROAD_COVERAGE, PRICE_CHANGE_CLAUSE, WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";

const RETAILERS = Array.from(new Set(PLANS.map((p) => p[0]))).sort();
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "./SiteHeader";
import SourceBanner from "./SourceBanner";
import BillPagePrompt from "./BillPagePrompt";
import { shouldAskForAnotherPage } from "@/lib/billExtraction";
import { track } from "@/lib/track";
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
/** Plan names as retailers publish them can be messy ("…RateWith CL) Powercor"). Tidy for display only. */
function tidyPlanName(p: PlanRow): string {
  let n = p[2].replace(/\s+/g, " ").replace(/\(electricity\)/gi, "").replace(/RateWith/g, "Rate With").trim();
  const nets = [p[1], p[1] === "Citipower" ? "CitiPower" : "", p[1] === "AusNet Services" ? "AusNet" : ""].filter(Boolean);
  for (const net of nets) n = n.replace(new RegExp(`[\\s\\-–]*${net}\\s*$`, "i"), "");
  return n.replace(/[\s\-–]+$/, "").trim() || p[2];
}

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
      <Icon name="bolt" size={13} /> EV-friendly off-peak
    </span>
  );
}

function SolarBadge() {
  return (
    <span className={styles.solarBadge} title="This total already includes this plan's solar feed-in credit">
      <Icon name="sun" size={13} /> Solar credit included
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
// bill: their bill's numbers · estimate: from their answers about the home ·
// average: the average Victorian home (4,000 kWh a year) when there's nothing to go on.
type UsageSource = "estimate" | "bill" | "average";
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
  // The plan list shows each retailer's cheapest plan unless they ask for all.
  const [allPlans, setAllPlans] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  // Where the network came from: the meter number, the bill, the postcode, or the customer's own pick.
  const [networkFrom, setNetworkFrom] = useState<"nmi" | "bill" | "postcode" | "manual" | null>(null);
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  const [nmiRaw, setNmiRaw] = useState("");
  // Utilo compares home plans only; embedded networks and businesses are flagged.
  const [propertyType, setPropertyType] = useState<PropertyType>("home");
  // The customer has answered the note about their address ("it's my home").
  const [addressHintOff, setAddressHintOff] = useState(false);
  // Victorian postcodes and their suburbs (loaded on demand), to catch a postcode that doesn't match.
  const [localities, setLocalities] = useState<Localities | null>(null);
  const [suburbNotListed, setSuburbNotListed] = useState(false);
  // A bill read that looks like a business, embedded network or large site.
  const [billFlag, setBillFlag] = useState<"business" | "embedded" | "large" | null>(null);
  // What we noticed on the bill itself: estimated read, debt, concession, the retailer's own best offer message.
  const [billCheck, setBillCheck] = useState<BillCheck | null>(null);
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
  // No-bill path: a bill's kWh (and the month it ended) to forecast the year from.
  const [calKwhRaw, setCalKwhRaw] = useState("");
  const [calEndMonth, setCalEndMonth] = useState(() => (thisMonth() + 11) % 12);
  const [email, setEmail] = useState("");
  const [wantsAlerts, setWantsAlerts] = useState(false);
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("idle");
  const [scanBanner, setScanBanner] = useState<{ retailer: string | null; warnings: string[] } | null>(null);
  // The last bill read and the photos it came from (kept in memory only), so
  // a missing page can be added and the pages read together.
  const [lastBill, setLastBill] = useState<ExtractedBill | null>(null);
  const [billPages, setBillPages] = useState<Blob[]>([]);
  const [currentRetailer, setCurrentRetailer] = useState("");
  // The rates on their current plan, typed from the bill (or read off it).
  const [ratesForm, setRatesForm] = useState<RatesForm>(EMPTY_RATES_FORM);
  const [showRates, setShowRates] = useState(false);
  // The bill's usage looked too thin and we used the average; they can insist
  // on their own numbers. Remembered for those exact numbers only.
  const [keepUsageFor, setKeepUsageFor] = useState<string | null>(null);
  const patchRates = (patch: Partial<RatesForm>) => setRatesForm((f) => ({ ...f, ...patch }));
  // Which period the result numbers and charts are shown for.
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
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
        if (d.profile) setProfile(normaliseProfile(d.profile));
        // A ?start= link says how they want to go this time; it beats the saved choice.
        if (!start && (d.usageSource === "bill" || d.usageSource === "estimate" || d.usageSource === "average")) setUsageSource(d.usageSource);
        if (typeof d.hasSolar === "boolean") setHasSolar(d.hasSolar);
        if (typeof d.solarExportRaw === "string") setSolarExportRaw(d.solarExportRaw);
        if (typeof d.currentBillRaw === "string") setCurrentBillRaw(d.currentBillRaw);
        if (typeof d.calKwhRaw === "string") setCalKwhRaw(d.calKwhRaw);
        if (typeof d.calEndMonth === "number" && d.calEndMonth >= 0 && d.calEndMonth <= 11) setCalEndMonth(d.calEndMonth);
        if (typeof d.email === "string") setEmail(d.email);
        if (typeof d.currentRetailer === "string") setCurrentRetailer(d.currentRetailer);
        if (typeof d.customerName === "string") setCustomerName(d.customerName);
        if (typeof d.address === "string") setAddress(d.address);
        if (typeof d.suburb === "string") setSuburb(d.suburb);
        if (d.propertyType === "home" || d.propertyType === "embedded" || d.propertyType === "business") setPropertyType(d.propertyType);
        if (typeof d.nmiRaw === "string") setNmiRaw(d.nmiRaw);
        if (d.addressOk === true) setAddressHintOff(true);
        if (d.billCheck && typeof d.billCheck === "object") setBillCheck(cleanBillCheck(d.billCheck));
        // Older saves have no networkFrom: a saved network was the customer's choice.
        setNetworkFrom(["nmi", "bill", "postcode", "manual"].includes(d.networkFrom) ? d.networkFrom : d.distributor ? "manual" : null);
        if (d.inputStep === 2 || d.inputStep === 3) setInputStep(d.inputStep);
        if (d.ratesForm && typeof d.ratesForm === "object") setRatesForm({ ...EMPTY_RATES_FORM, ...d.ratesForm });
        setRestored(true);
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
  // Anonymous step counts for the owner dashboard (lib/track.ts). Only steps
  // taken after the page has loaded count, so a restored result isn't counted twice.
  const loadedSig = useRef<string | null>(null);
  const startedSent = useRef(false);
  const prevStage = useRef<Stage | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const sig = `${entry}|${inputStep}|${stage}`;
    if (loadedSig.current === null) loadedSig.current = sig;
    else if (!startedSent.current && sig !== loadedSig.current) {
      startedSent.current = true;
      track("check_started", { distributor });
    }
    const prev = prevStage.current;
    prevStage.current = stage;
    if (prev === "input" && stage === "results") track("check_completed", { distributor, usage: usageSource });
  }, [hydrated, entry, inputStep, stage, distributor, usageSource]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ distributor, postcode, days, mode, anytime, peak, shoulder, offpeak, cl, showCl, profile, usageSource, hasSolar, solarExportRaw, currentBillRaw, calKwhRaw, calEndMonth, email, inputStep, currentRetailer, customerName, address, suburb, ratesForm, propertyType, nmiRaw, networkFrom, addressOk: addressHintOff, billCheck: billCheck ? forStorage(billCheck) : null }),
      );
    } catch {
      /* storage unavailable */
    }
  }, [distributor, postcode, days, mode, anytime, peak, shoulder, offpeak, cl, showCl, profile, usageSource, hasSolar, solarExportRaw, currentBillRaw, calKwhRaw, calEndMonth, email, inputStep, currentRetailer, customerName, address, suburb, ratesForm, propertyType, nmiRaw, networkFrom, addressHintOff, billCheck, hydrated]);

  // The suburb list is ~20 KB gzipped, so it loads after the page, not with it.
  useEffect(() => {
    let live = true;
    import("@/lib/vicLocalities")
      .then((m) => { if (live) setLocalities(m.VIC_LOCALITIES); })
      .catch(() => { /* no list: the postcode check is skipped, never blocking */ });
    return () => { live = false; };
  }, []);

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
    // Offer only this postcode's suburbs: pick it when there's just one, and
    // clear a suburb from another postcode so the two can't disagree.
    if (localities && cleaned.length === 4) {
      const list = suburbsIn(localities, cleaned);
      if (list.length === 1) setSuburb(list[0]);
      else if (list.length > 1 && !list.some((x) => x.toLowerCase() === suburb.trim().toLowerCase())) setSuburb("");
      setSuburbNotListed(false);
    }
    const guess = cleaned.length === 4 ? guessDistributorFromPostcode(cleaned) : null;
    // A meter number, the bill or the customer's own pick beats a postcode guess.
    if (networkFrom === "nmi" || networkFrom === "bill" || networkFrom === "manual") return;
    if (guess) {
      setDistributor(guess);
      setNetworkFrom("postcode");
    } else {
      setNetworkFrom(null);
    }
  }

  /** Meter number typed in: it tells us the network exactly. */
  function applyNmi(raw: string) {
    setNmiRaw(raw.slice(0, 14));
    const c = checkNmi(raw);
    if (c.status === "network") {
      setDistributor(c.network);
      setNetworkFrom("nmi");
    }
  }

  function patchProfile(patch: Partial<HomeProfile>) {
    setProfile((p) => {
      const next = { ...p, ...patch };
      // Counting panels: the system size follows the count and their age.
      if (next.solarInput === "panels") next.solarKw = panelsToKw(next.solarPanels, next.solarAge);
      return next;
    });
  }
  const useEst = usageSource === "estimate";
  // No bill: every question on one page, with the usage estimate updating live.
  const onePage = useEst;
  const onStep1 = onePage || inputStep === 1;
  const qn = (k: number) => (onePage ? k - 1 : k);
  // Victorian postcodes start with 3 (or 8 for PO boxes). Others can't be priced yet.
  const nonVic = postcode.length === 4 && !/^[38]/.test(postcode);
  const nmiStatus = checkNmi(nmiRaw);
  const loc = checkLocality(localities, postcode, suburb);
  const locSuburbs = loc.status === "needSuburb" || loc.status === "mismatch" || loc.status === "ok" ? loc.suburbs : [];
  // The suburb as the list spells it ("ALTONA NORTH" off a bill -> "Altona North").
  const suburbListed = locSuburbs.find((x) => x.toLowerCase() === suburb.trim().toLowerCase()) ?? "";
  // An address note (business words, or a unit) waiting for an answer.
  const addressNote = propertyType === "home" && !addressHintOff ? addressHint(address) : null;
  // Known when it came from the meter number, the bill, the postcode or the customer.
  const networkKnown = networkFrom !== null;
  // With a bill's kWh, the answers set the shape of the year and the bill sets the level.
  const billForecast = useMemo(() => {
    const kwh = parseFloat(calKwhRaw);
    return useEst && kwh > 0 ? forecastFromBill(profile, { kwh, days, endMonth: calEndMonth }) : null;
  }, [useEst, calKwhRaw, profile, days, calEndMonth]);
  const est = useMemo(() => {
    const e = estimateUsage(profile, days);
    return billForecast ? scaleEstimate(e, billForecast.factor) : e;
  }, [profile, days, billForecast]);
  // Not enough to go on: they picked the average, or their bill's usage is
  // too thin to compare on (under a week, or under 1 kWh a day without solar).
  // Then we use the average Victorian home, 4,000 kWh a year.
  const avg = useMemo(() => averageUsage(days), [days]);
  const typedSolarExport = hasSolar || profile.hasSolar ? parseFloat(solarExportRaw) || 0 : 0;
  const billUsageThin =
    usageSource === "bill" &&
    (mode === "detailed" ? peak + shoulder + offpeak : anytime) + cl > 0 &&
    usageIsIncomplete({ days, peak: mode === "detailed" ? peak : 0, shoulder: mode === "detailed" ? shoulder : 0, offpeak: mode === "detailed" ? offpeak : 0, anytime: mode === "simple" ? anytime : 0, cl, solarExportKwh: typedSolarExport });
  const usageSig = JSON.stringify([days, mode, anytime, peak, shoulder, offpeak, cl]);
  const useAvg = usageSource === "average" || (billUsageThin && keepUsageFor !== usageSig);
  const solarExportKwh = useEst ? est.solarExportKwh : useAvg ? 0 : typedSolarExport;
  const hasSolarEff = useEst ? profile.hasSolar : hasSolar || profile.hasSolar;
  const clKwh = useEst ? est.cl : useAvg ? 0 : cl;

  function handleBillExtracted(bill: ExtractedBill, pages: Blob[] = []) {
    setLastBill(bill);
    setBillPages(pages);
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
          JSON.stringify({ zone: bill.gasDistributor ?? "Australian Gas Networks", days: bill.gasBillingDays ?? bill.billingDays ?? 91, mj: Math.round(bill.gasMj), billRaw: bill.gasBillTotal ? String(bill.gasBillTotal) : "", planName: bill.gasPlanName ?? "", fromBill: true, retailer: bill.retailerName ?? "" }),
        );
      } catch { /* ignore */ }
    }
    if (bill.fuel === "gas") {
      router.push("/gas");
      return;
    }
    // Network: the meter number is exact, then the bill's own wording, then the postcode.
    const nmiCheck = bill.nmi ? checkNmi(bill.nmi) : null;
    if (bill.nmi) setNmiRaw(bill.nmi);
    if (nmiCheck?.status === "network") {
      setDistributor(nmiCheck.network);
      setNetworkFrom("nmi");
    } else if (bill.distributor) {
      setDistributor(bill.distributor);
      setNetworkFrom("bill");
    } else if (bill.postcode) {
      const guess = guessDistributorFromPostcode(bill.postcode);
      if (guess) {
        setDistributor(guess);
        setNetworkFrom("postcode");
      }
    }
    setBillCheck(billCheckFromBill(bill));
    // Is this a home on its own account? Flag business, embedded network or large sites.
    const billKwh = (bill.anytimeKwh ?? 0) + (bill.peakKwh ?? 0) + (bill.shoulderKwh ?? 0) + (bill.offpeakKwh ?? 0) + (bill.controlledLoadKwh ?? 0);
    const yearlyKwh = bill.billingDays ? (billKwh / bill.billingDays) * 365 : 0;
    const vicPostcode = !bill.postcode || /^[38]/.test(bill.postcode);
    setBillFlag(
      bill.embeddedNetwork || (nmiCheck?.status === "notVictorian" && vicPostcode)
        ? "embedded"
        : bill.accountType === "business" || bill.demandCharge
          ? "business"
          : yearlyKwh > SMALL_CUSTOMER_KWH_PER_YEAR
            ? "large"
            : null,
    );
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
    // When a page looks missing, the page prompt says what's missing instead.
    const askPage = shouldAskForAnotherPage(bill);
    if (!bill.distributor && !bill.postcode) warnings.push("Couldn't tell which network you're on — please check Step 1 below.");
    if (bill.billingDays === null && !askPage) warnings.push("Couldn't find your billing period length — please check Step 3.");
    if (!hasUsage && !askPage) warnings.push("Couldn't find your usage figures — please check Step 3.");

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
  const usagePeak = useEst ? est.peak : useAvg ? avg.peak : mode === "detailed" ? peak : 0;
  const usageShoulder = useEst ? est.shoulder : useAvg ? avg.shoulder : mode === "detailed" ? shoulder : 0;
  const usageOffpeak = useEst ? est.offpeak : useAvg ? avg.offpeak : mode === "detailed" ? offpeak : 0;
  const usageAnytime = useEst || useAvg ? 0 : mode === "simple" ? anytime : 0;
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
    onStep1 && propertyType !== "home"
      ? "Utilo compares home electricity plans for now."
      : onStep1 && nonVic
      ? "We can only check Victorian addresses for now."
      : onStep1 && postcode.length < 4
      ? "Enter your postcode so we can work out your network."
      : onStep1 && loc.status === "poBox"
      ? `${postcode} is a PO Box postcode. Use the postcode of the home's street address.`
      : onStep1 && loc.status === "unknown"
      ? `We can't find postcode ${postcode} in Victoria. Check it against your bill.`
      : onStep1 && loc.status === "needSuburb"
      ? "Pick your suburb."
      : onStep1 && loc.status === "mismatch"
      ? `${suburb} is in postcode ${loc.suburbPostcodes.join(" or ")}, not ${postcode}. Fix the postcode or the suburb.`
      : onStep1 && addressNote
      ? "Answer the note about your address first."
      : onStep1 && !networkKnown
      ? "Pick your network, or enter your meter number (NMI) from your bill."
      : billFlag
      ? "Check the note above about your bill first."
      : inputStep === 3 && usageSource === "bill" && usagePeak + usageShoulder + usageOffpeak + usageAnytime <= 0
        ? "Snap your bill, or enter the kWh it shows. No bill, or not sure? Pick “No, estimate it for me”, or use the average home."
        : "";
  // Their own plan priced from the rates they typed. Used as "what you pay
  // now" when they didn't type a bill total.
  const myRates = useMemo(() => ratesFromForm(ratesForm), [ratesForm]);
  const ratesCost = costFromRates(myRates, usage);
  // With the average home's usage, a bill total for their own (thin) usage
  // can't be compared; their rates priced at the average usage can.
  const currentBill =
    !useAvg && typedBill !== null && !Number.isNaN(typedBill) ? typedBill : ratesCost.ok ? Math.round(ratesCost.total * 100) / 100 : null;

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
      }, { ev: profile.ev, hasSolar: hasSolarEff, currentRetailer: currentRetailer || null }),
    [distributor, days, usagePeak, usageShoulder, usageOffpeak, usageAnytime, clKwh, solarExportKwh, profile.ev, hasSolarEff, currentRetailer],
  );
  // Discounts, sign-up requirements, credits and fees for an offer, for this household.
  const household = { hasSolar: hasSolarEff, currentRetailer: currentRetailer || null };
  const offerFor = (p: PlanRow) => describeOffer("E", p[0], p[2], p[1], household);
  const totalInDist = useMemo(() => PLANS.filter((p) => p[1] === distributor && (profile.ev || !isEvFriendly(p))).length, [distributor, profile.ev]);
  const haveBill = currentBill !== null && !Number.isNaN(currentBill);
  const retailerBest = useMemo(
    () => (currentRetailer ? matches.find((m) => m.plan[0] === currentRetailer && !m.restricted) ?? null : null),
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
  const topForSave = topOpen(matches);
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
          source: useEst || useAvg ? "answers" : haveBill ? "bill" : "manual",
        }),
      );
    } catch { /* ignore */ }
  }, [stage, topForSave, distributor, days, haveBill, bench, useEst, useAvg]);

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
        email, distributor, days, usageMode: useEst || useAvg ? "detailed" : mode,
        peak: usage.peak, shoulder: usage.shoulder, offpeak: usage.offpeak, anytime: usage.anytime, cl: usage.cl,
        currentBill, wantsAlerts, customerName, address, suburb, postcode,
        hasSolar: hasSolarEff, solarExportKwh: hasSolarEff ? solarExportKwh : 0, homeProfile: profile,
      }),
    }).catch(() => null);
    setLeadStatus(res?.ok ? "saved" : "error");
  }

  // The cheapest plan this household can get (offers needing a membership,
  // existing customers only and so on stay in the list but aren't picked).
  const top = topOpen(matches);
  // Free result: the best plan plus the next two. Members see every plan and the forecast.
  const member = useMember();
  const locked = member !== true;
  // Free users see plans from #3 on; the cheapest ones are for members.
  const TOP_LOCKED = 2;
  const FREE_ROWS = 3;
  const joinScroll = () => {
    track("unlock_clicked", { distributor });
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Same rule as the dashboard: with a real bill, only call it a saving when
  // it's worth at least WORTH_SWITCHING_PER_YEAR a year.
  const yearlySave = top && days > 0 ? (bench - top.total) * (365 / days) : 0;
  const worthSwitching = haveBill ? yearlySave >= WORTH_SWITCHING_PER_YEAR : yearlySave > 0;


  // Each plan against the Victorian Default Offer for the same usage (%).
  const vdoForUsage = vdoBillForUsage(distributor, usage);
  const vsVdo = (total: number) => (vdoForUsage > 0 ? (total - vdoForUsage) / vdoForUsage : 0);
  const pctVdo = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`; };
  const kwhInPeriod = usagePeak + usageShoulder + usageOffpeak + usageAnytime + clKwh;
  // Plain numbers for the result: a month and a year, stay vs switch.
  const perMonth = (x: number) => (days > 0 ? (x * (365 / 12)) / days : 0);
  const perYear = (x: number) => (days > 0 ? (x * 365) / days : 0);
  // Same plan name, older price? Price the bill's own rates on this usage and
  // compare with today's version of the plan from the same retailer.
  const billPlanName = ratesForm.planName.trim();
  const sameNamePlans = currentRetailer && billPlanName
    ? matches.filter((m) => m.plan[0] === currentRetailer && m.plan[3] === "MARKET" && samePlanName(billPlanName, m.plan[2], currentRetailer))
    : [];
  const todaysVersion = sameNamePlans[0] ?? null;
  // Same base as the headline (your bill total) so the two savings agree; your rates only when there's no total.
  const yourPlanCost = haveBill ? bench : ratesCost.ok ? ratesCost.total : null;
  const olderVersionGap = todaysVersion && yourPlanCost !== null ? yourPlanCost - todaysVersion.total : 0;
  const onOlderVersion = !!todaysVersion && perYear(olderVersionGap) >= 20;
  // Free list: the two cheapest plans (and anything above the cheapest one
  // anyone can get) are locked, with price and saving but no name. The next
  // three are open; the rest sit behind the members' teaser.
  const perRetailer = cheapestPerRetailer(matches, top);
  const listed = allPlans ? matches : perRetailer;
  const lockedTop = locked && top ? listed.slice(0, Math.max(TOP_LOCKED, listed.indexOf(top) + 1)) : [];
  const isLockedPlan = (m: (typeof matches)[number] | null | undefined) => !!m && lockedTop.includes(m);
  const listRows = locked ? listed.slice(lockedTop.length, lockedTop.length + FREE_ROWS) : listed;
  const hiddenRows = locked ? listed.slice(lockedTop.length + FREE_ROWS) : [];
  const rankOf = (m: (typeof matches)[number]) => listed.indexOf(m) + 1;
  // The best plan's pay-on-time / direct-debit discount (in its price).
  const topDetail = top ? billDetail(top.plan, usage) : null;
  const topOffer = top ? offerFor(top.plan) : null;

  return (
    <>
      <SiteHeader active="check" />

      <div className={styles.wrap}>
        {stage === "input" && <SourceBanner />}
        {billFlag && (
          <div className={s1.stop} role="status">
            {billFlag === "embedded" ? (
              <>
                <b>This bill looks like it&apos;s from an embedded network</b>
                <p>
                  Your power seems to come through your building&apos;s own network, so your price is set by its operator and the market plans we compare
                  don&apos;t apply. If your bill is actually from a normal retailer, carry on.
                </p>
              </>
            ) : billFlag === "business" ? (
              <>
                <b>This looks like a business bill</b>
                <p>
                  It shows a business account or a demand charge. Utilo compares home plans for now, so a result here could mislead. If this is your
                  home, carry on.
                </p>
              </>
            ) : (
              <>
                <b>That&apos;s a lot of electricity for a home</b>
                <p>
                  This bill works out at over {(SMALL_CUSTOMER_KWH_PER_YEAR / 1000).toLocaleString("en-AU")} MWh a year, which Victoria treats as a large
                  (business) customer. Utilo compares home plans for now. If this is your home and the reading is right, carry on.
                </p>
              </>
            )}
            <div className={styles.choiceRow}>
              <button type="button" className={styles.choiceBtn} onClick={() => { setBillFlag(null); setPropertyType("home"); }}>
                {billFlag === "embedded" ? "A normal retailer bills me, carry on" : "It's my home, carry on"}
              </button>
              <button
                type="button"
                className={styles.choiceBtn}
                onClick={() => { setPropertyType(billFlag === "embedded" ? "embedded" : "business"); setBillFlag(null); setEntry("wizard"); setInputStep(1); setStage("input"); scrollToTop(); }}
              >
                {billFlag === "embedded" ? "Yes, the building bills me" : "Yes, it's a business"}
              </button>
            </div>
          </div>
        )}
        {stage === "input" && (
          <>
            {restored && entry === "wizard" && (
              <div className={styles.restoredBar}>
                <span>We&apos;ve filled in your last answers.</span>
                <button type="button" onClick={startFresh}>Start fresh</button>
              </div>
            )}
        {entry !== "snap" && (
        <section className={styles.hero}>
          <span className={styles.residentialTag}>Victorian homes · NSW, SA, QLD coming</span>
          <h1>{entry === "read" ? "Here's what we read" : "Check your plan"}</h1>
          <p className={styles.lede}>
            {entry === "read" ? (
              <>Have a quick look, then see your result.</>
            ) : (
              <>Or skip the questions: a photo of your bill does it all. Gas bill? <Link href="/gas">Check gas</Link>.</>
            )}
          </p>
        </section>
        )}

        {entry === "snap" && (
          <>
            <BillPhotoUpload variant="hero" onApply={handleBillExtracted} />
            <div className={snap.alt}>
              {restored && (
                <button type="button" className={`${snap.altBtn} ${snap.altContinue}`} onClick={() => { setEntry("wizard"); scrollToTop(); }}>
                  <b>Continue your last check</b>
                  <span>Your answers are saved on this device →</span>
                </button>
              )}
              <button type="button" className={snap.altBtn} onClick={() => { setUsageSource("estimate"); setInputStep(1); setEntry("wizard"); scrollToTop(); }}>
                <b>No bill handy?</b>
                <span>Answer a few quick questions and we&apos;ll estimate →</span>
              </button>
              <button type="button" className={snap.altBtn} onClick={() => { setUsageSource("bill"); setInputStep(1); setEntry("wizard"); scrollToTop(); }}>
                <b>Rather type it in?</b>
                <span>Copy the numbers from your bill yourself →</span>
              </button>
            </div>
            <p className={snap.underNote}>
              Victorian homes · NSW, SA and QLD coming. Gas bill? <Link href="/gas">Check gas</Link>.
            </p>
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
            <BillPagePrompt bill={lastBill} pages={billPages} onApply={handleBillExtracted} typeItIn={<>Or type them in: <b>Check or change what we read</b>, below.</>} />
            <button type="button" className={snap.readGo} disabled={!!billFlag} onClick={() => { setStage("results"); scrollToTop(); }}>
              See my result →
            </button>
            <button type="button" className={snap.readEdit} onClick={() => { setEntry("wizard"); setInputStep(3); scrollToTop(); }}>
              Check or change what we read
            </button>
          </div>
        )}

        {entry === "wizard" && (
          <>
        {!scanBanner && <BillPhotoUpload variant="strip" onApply={handleBillExtracted} />}
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
            <BillPagePrompt bill={lastBill} pages={billPages} onApply={handleBillExtracted} typeItIn={<>Or type them in below: your usage and billing period are in step 3.</>} />
          </div>
        )}

        {!onePage && <div className={styles.wizardSteps}>
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
        </div>}

        {onStep1 && (
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
            {/* 1. What kind of property: Utilo compares homes on their own account. */}
            <div className={`${s1.q} ${s1.qFirst}`}>
              <span className={s1.qLabel}>What are you checking?</span>
              <div className={s1.types}>
                {([
                  ["home", "My home", "A house, townhouse or unit with its own electricity account"],
                  ["embedded", "Apartment billed by the building", "Your power bill comes from the building, strata or an embedded network company"],
                  ["business", "A business", "A shop, office, warehouse or other business premises"],
                ] as [PropertyType, string, string][]).map(([v, t, d]) => (
                  <button key={v} type="button" className={propertyType === v ? s1.typeOn : s1.type} onClick={() => setPropertyType(v)}>
                    <b>{t}</b>
                    <span>{d}</span>
                  </button>
                ))}
              </div>
            </div>

            {propertyType !== "home" ? (
              <div className={s1.stop}>
                {propertyType === "embedded" ? (
                  <>
                    <b>We can&apos;t compare embedded networks yet</b>
                    <p>
                      In an embedded network, the building&apos;s operator buys power in bulk and sets your price, so the market plans we compare
                      don&apos;t apply. If your bill comes from a normal retailer (such as AGL, Origin or Red Energy), choose <b>My home</b> instead: most
                      apartments are fine. Want to know when we cover embedded networks?
                    </p>
                    <NotifyMe label="Embedded network" postcode={postcode} />
                  </>
                ) : (
                  <>
                    <b>Utilo compares home plans for now</b>
                    <p>
                      Business tariffs work differently (often with demand charges and larger usage), so a home comparison would be misleading.
                      Business checks are on our list. Want to know when they&apos;re ready?
                    </p>
                    <NotifyMe label="Business" postcode={postcode} />
                  </>
                )}
              </div>
            ) : (
              <>
            <div className={`${styles.fieldGrid} ${styles.mt16}`}>
              <div className={styles.field}>
                <label htmlFor="custName">
                  First name <span className={styles.unitNote}>(optional, so we can say hi)</span>
                </label>
                <input id="custName" type="text" placeholder="Jane" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="postcode">Postcode</label>
                <input id="postcode" type="text" inputMode="numeric" maxLength={4} placeholder="3121" value={postcode} onChange={(e) => applyPostcode(e.target.value)} />
              </div>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="address">
                  Street address <span className={styles.unitNote}>(optional)</span>
                </label>
                <input id="address" type="text" placeholder="12 Smith Street" value={address} onChange={(e) => { setAddress(e.target.value); setAddressHintOff(false); }} />
              </div>
              <div className={styles.field}>
                <label htmlFor="suburb">Suburb</label>
                {localities && locSuburbs.length > 0 && !suburbNotListed && (!suburb.trim() || suburbListed) ? (
                  <select
                    id="suburb"
                    className={s1.select}
                    value={suburbListed}
                    onChange={(e) => {
                      if (e.target.value === "__other") { setSuburbNotListed(true); setSuburb(""); }
                      else setSuburb(e.target.value);
                    }}
                  >
                    <option value="" disabled>{locSuburbs.length === 1 ? locSuburbs[0] : `Pick from ${locSuburbs.length} suburbs in ${postcode}`}</option>
                    {locSuburbs.map((x) => <option key={x} value={x}>{x}</option>)}
                    <option value="__other">My suburb isn&apos;t listed</option>
                  </select>
                ) : (
                  <input
                    id="suburb"
                    type="text"
                    placeholder={localities && postcode.length < 4 ? "Enter your postcode first" : "Richmond"}
                    disabled={!!localities && postcode.length < 4 && !suburb}
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                  />
                )}
              </div>
            </div>

            {loc.status === "mismatch" && (
              <div className={s1.check}>
                <b>{suburb} is in postcode {loc.suburbPostcodes.join(" or ")}, not {postcode}.</b> The postcode decides your network and prices, so it needs to match.{" "}
                {loc.suburbPostcodes.slice(0, 3).map((pc) => (
                  <button key={pc} type="button" onClick={() => { applyPostcode(pc); setSuburbNotListed(false); }}>
                    Use {pc}
                  </button>
                ))}
                {" · "}
                <button type="button" onClick={() => { setSuburb(""); setSuburbNotListed(false); }}>Pick a suburb in {postcode}</button>
              </div>
            )}
            {loc.status === "unknown" && (
              <div className={s1.check}>
                <b>We can&apos;t find postcode {postcode} in Victoria.</b> Check the postcode on your bill or a letter to your home.
              </div>
            )}
            {loc.status === "poBox" && (
              <div className={s1.check}>
                <b>{postcode} is a PO Box postcode.</b> Use the postcode of the home&apos;s street address, as it shows on your power bill.
              </div>
            )}

            {addressNote === "business" && (
              <div className={s1.hint}>
                This looks like a business address. Utilo compares home plans for now.{" "}
                <button type="button" onClick={() => setPropertyType("business")}>It&apos;s a business</button> ·{" "}
                <button type="button" onClick={() => setAddressHintOff(true)}>It&apos;s my home</button>
              </div>
            )}
            {addressNote === "apartment" && (
              <div className={s1.hint}>
                A unit? If it&apos;s a factory, warehouse or shop unit, it&apos;s a business. If it&apos;s an apartment, check who sends your power bill: a normal
                retailer is fine, but if it&apos;s the building, strata or an embedded network company we can&apos;t compare it yet.{" "}
                <button type="button" onClick={() => setAddressHintOff(true)}>It&apos;s my home, a retailer bills me</button> ·{" "}
                <button type="button" onClick={() => setPropertyType("business")}>It&apos;s a business unit</button> ·{" "}
                <button type="button" onClick={() => setPropertyType("embedded")}>The building bills me</button>
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

            {/* 2. Retailer first: customers know who they pay, not their network. */}
            <div className={s1.q}>
              <span className={s1.qLabel}>Who do you pay for electricity now? <span className={s1.opt}>(optional)</span></span>
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
              <span className={s1.qHint}>We&apos;ll also show their best plan for you, in case you&apos;d rather stay.</span>
              {currentRetailer && (
                <div className={`${styles.accuracyNote} ${styles.mt16}`}>
                  <b>Heads up:</b> knowing your retailer doesn&apos;t tell us which {currentRetailer} plan you&apos;re on or what you pay. Many people are on
                  older plans that cost more than the retailer&apos;s current offers. For an exact answer, snap your bill (or a screenshot from the{" "}
                  {currentRetailer} app) at the top of this page, or type your rates in step 3.
                </div>
              )}
            </div>

            {/* 3. Network: worked out for them from the postcode or meter number. */}
            {!nonVic && (
              <div className={s1.q}>
                <span className={s1.qLabel}>Your electricity network</span>
                {networkKnown ? (
                  <div className={s1.network}>
                    <div>
                      <b>{distributor}</b>
                      <small>
                        {networkFrom === "nmi"
                          ? "From your meter number (NMI), so it's exact."
                          : networkFrom === "bill"
                            ? "Read from your bill."
                            : networkFrom === "postcode"
                              ? `Worked out from postcode ${postcode}. Your bill lists it as "Distributor" if you want to check.`
                              : "Picked by you."}
                      </small>
                    </div>
                    <button type="button" className={s1.linkBtn} onClick={() => setShowNetworkPicker((v) => !v)}>
                      {showNetworkPicker ? "Done" : "Change"}
                    </button>
                  </div>
                ) : (
                  <div className={s1.hint}>
                    {postcode.length === 4
                      ? `We can't tell the network from postcode ${postcode} alone, because some areas are split between two. `
                      : "Enter your postcode and we'll work out your network. "}
                    {postcode.length === 4 && <>Enter your meter number (NMI) from your bill, or pick the network below.</>}
                  </div>
                )}
                {(showNetworkPicker || (!networkKnown && postcode.length === 4)) && (
                  <div className={s1.picker}>
                    <div className={s1.nmiRow}>
                      <label className={s1.srOnly} htmlFor="nmi">Meter number (NMI)</label>
                      <input id="nmi" type="text" inputMode="numeric" placeholder="Meter number (NMI), e.g. 6203 1234 567" value={nmiRaw} onChange={(e) => applyNmi(e.target.value)} />
                      {nmiStatus.status === "network" && <span className={s1.nmiOk}>That&apos;s {nmiStatus.network}</span>}
                      {nmiStatus.status === "notVictorian" && (
                        <span className={s1.nmiWarn}>
                          That meter number isn&apos;t on a Victorian network. It may be an embedded network, which we can&apos;t compare yet.
                        </span>
                      )}
                    </div>
                    <span className={s1.qHint}>The NMI is a 10 or 11 digit number near the top of your bill.</span>
                    <div className={`${styles.distGrid} ${styles.mt16}`}>
                      {DISTRIBUTORS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`${styles.distBtn} ${d === distributor && networkKnown ? styles.distBtnActive : ""}`}
                          onClick={() => {
                            setDistributor(d);
                            setNetworkFrom("manual");
                            setShowNetworkPicker(false);
                          }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <span className={s1.qHint}>The network owns the poles and wires. You can&apos;t choose it, but it changes prices.</span>
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>
        )}

        {(onePage ? propertyType === "home" && !nonVic : inputStep === 2) && (
          <div className={styles.card}>
            <div className={styles.stepHead}>
              <div className={`${styles.stepIcon} ${styles.stepIconTeal}`}>
                <IconPeople />
              </div>
              <div className={styles.stepHeadText}>
                <div className={styles.stepLabel}>
                  <span className={styles.stepNum}>2</span> About your home
                </div>
                <span className={styles.stepSub}>Rough answers are fine. They tell us how much power you use, and when.</span>
              </div>
            </div>
            {useEst && (
              <BillKwhCard
                bill={{ kwhRaw: calKwhRaw, endMonth: calEndMonth, onKwh: setCalKwhRaw, onEndMonth: setCalEndMonth, forecast: billForecast }}
                days={days}
                onDays={setDays}
                profile={profile}
              />
            )}
            {useEst && <EstimateStrip profile={profile} forecast={billForecast} />}

            <div className={s2.grid}>
              <div>
                <span className={s2.label}>People living here</span>
                <Choice
                  value={profile.people}
                  onChange={(v) => patchProfile({ people: v })}
                  options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: n === 6 ? "6+" : String(n) }))}
                />
              </div>
              <div>
                <span className={s2.label}>Home during the day?</span>
                <Choice
                  value={profile.daytimeHome}
                  onChange={(v) => patchProfile({ daytimeHome: v })}
                  options={[
                    { value: "away", label: "Mostly out" },
                    { value: "some", label: "Some days" },
                    { value: "home", label: "Most days" },
                  ]}
                />
              </div>
              <div>
                <span className={s2.label}>Heating</span>
                <Choice
                  value={profile.heating}
                  onChange={(v) => patchProfile({ heating: v })}
                  options={[
                    { value: "gas_none", label: "Gas or none" },
                    { value: "reverse_cycle", label: "Split system" },
                    { value: "resistive", label: "Electric heaters" },
                  ]}
                />
              </div>
              <div>
                <span className={s2.label}>Hot water</span>
                <Choice
                  value={profile.hotWater === "electric_controlled" ? "electric_general" : profile.hotWater}
                  onChange={(v) => patchProfile({ hotWater: v === "electric_general" && profile.hotWater === "electric_controlled" ? "electric_controlled" : v })}
                  options={[
                    { value: "gas_solar", label: "Gas or solar" },
                    { value: "electric_general", label: "Electric" },
                    { value: "heat_pump", label: "Heat pump" },
                  ]}
                />
                {(profile.hotWater === "electric_general" || profile.hotWater === "electric_controlled") && (
                  <div className={s2.follow}>
                    <span className={s2.followLabel}>On a separate off-peak meter?</span>
                    <Choice
                      value={profile.hotWater}
                      onChange={(v) => patchProfile({ hotWater: v })}
                      options={[
                        { value: "electric_controlled", label: "Yes" },
                        { value: "electric_general", label: "No or not sure" },
                      ]}
                    />
                    <span className={s2.followHint}>If it is, your bill has a &ldquo;controlled load&rdquo; line.</span>
                  </div>
                )}
              </div>
            </div>

            <div className={s2.extrasWrap}>
              <span className={s2.label}>Do you have any of these? <span className={s2.labelSoft}>Tap all that apply</span></span>
              <div className={s2.extras}>
                {([
                  ["cooling", "snow", "Air-con for cooling"],
                  ["pool", "waves", "Pool or spa"],
                  ["ev", "car", "Electric car"],
                  ["hasSolar", "sun", "Solar panels"],
                ] as const).map(([key, icon, label]) => {
                  const on = profile[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      className={on ? s2.tileOn : s2.tile}
                      onClick={() => patchProfile({ [key]: !on } as Partial<HomeProfile>)}
                    >
                      <span className={s2.tileIcon}><Icon name={icon} size={26} /></span>
                      <span className={s2.tileText}>{label}</span>
                      {on && <span className={s2.tick}><Icon name="check" size={14} /></span>}
                    </button>
                  );
                })}
              </div>

              {profile.ev && (
                <div className={s2.follow}>
                  <span className={s2.followLabel}>When do you charge the car?</span>
                  <Choice
                    value={profile.evCharging}
                    onChange={(v) => patchProfile({ evCharging: v })}
                    options={[
                      { value: "overnight", label: "Mostly overnight" },
                      { value: "anytime", label: "Whenever" },
                    ]}
                  />
                  <span className={s2.followHint}>We&apos;ll also show plans with cheap overnight charging.</span>
                </div>
              )}
              {profile.hasSolar && (
                <div className={s1.solar}>
                  {profile.solarInput === "panels" ? (
                    <>
                      <label className={s1.solarLabel} htmlFor="solarPanels">How many panels are on your roof?</label>
                      <div className={s1.stepper}>
                        <button type="button" aria-label="One fewer panel" onClick={() => patchProfile({ solarPanels: Math.max(1, profile.solarPanels - 1) })}>−</button>
                        <input
                          id="solarPanels"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          value={profile.solarPanels || ""}
                          onChange={(e) => patchProfile({ solarPanels: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                        />
                        <button type="button" aria-label="One more panel" onClick={() => patchProfile({ solarPanels: Math.min(100, profile.solarPanels + 1) })}>+</button>
                        <span>panels</span>
                      </div>
                      <span className={s1.qHint}>Count them from the street or on Google Maps&apos; satellite view. Close enough is fine.</span>
                      <span className={s1.solarLabel}>Roughly when were they put in?</span>
                      <Choice
                        value={profile.solarAge}
                        onChange={(v: SolarAge) => patchProfile({ solarAge: v })}
                        options={[
                          { value: "pre2016", label: "Before 2016" },
                          { value: "2016to2020", label: "2016 to 2020" },
                          { value: "2021on", label: "2021 or later" },
                          { value: "unsure", label: "Not sure" },
                        ]}
                      />
                      <p className={s1.solarSum}>
                        {profile.solarPanels > 0 ? <>That&apos;s about <b>{profile.solarKw} kW</b> of solar.</> : <>Enter how many panels you have.</>}{" "}
                        <button type="button" className={s1.linkBtn} onClick={() => patchProfile({ solarInput: "kw" })}>I know the system size</button>
                      </p>
                    </>
                  ) : (
                    <>
                      <label className={s1.solarLabel} htmlFor="solarKw">System size (kW)</label>
                      <div className={s1.stepper}>
                        <input
                          id="solarKw"
                          type="number"
                          min={0.5}
                          step={0.1}
                          value={profile.solarKw}
                          onChange={(e) => patchProfile({ solarKw: Math.max(0, parseFloat(e.target.value) || 0) })}
                        />
                        <span>kW</span>
                      </div>
                      <span className={s1.qHint}>It&apos;s on the installer&apos;s paperwork or the inverter app.</span>
                      <p className={s1.solarSum}>
                        <button type="button" className={s1.linkBtn} onClick={() => patchProfile({ solarInput: "panels" })}>Count my panels instead</button>
                      </p>
                    </>
                  )}
                  <span className={styles.unitNote}>We use each plan&apos;s real feed-in rate ({totalWithSolarFit()} of {PLAN_COUNT} publish one).</span>
                </div>
              )}
            </div>
          </div>
        )}

        {(onePage ? propertyType === "home" && !nonVic : inputStep === 3) && (
          <div className={styles.card}>
            <div className={styles.stepHead}>
              <div className={`${styles.stepIcon} ${styles.stepIconAmber}`}>
                <IconGauge />
              </div>
              <div className={styles.stepHeadText}>
                <div className={styles.stepLabel}>
                  <span className={styles.stepNum}>3</span> {onePage ? "Your usage" : "Your bill"}
                </div>
                <span className={styles.stepSub}>
                  {onePage
                    ? "Worked out from your answers above. Change them and it updates."
                    : "A few numbers from your bill make this exact. No bill? We'll estimate."}
                </span>
              </div>
            </div>

            {onePage && (
              <p className={w.switchLine}>
                Got a bill after all?{" "}
                <button type="button" onClick={() => { setUsageSource("bill"); setInputStep(3); }}>Type in its numbers</button>{" "}
                or snap it at the top for exact figures. Not sure about your home?{" "}
                <button type="button" onClick={() => { setUsageSource("average"); setInputStep(3); }}>Use the average home</button>
              </p>
            )}

            {/* Q: bill or estimate */}
            {!onePage && <section className={w.q}>
              <div className={w.qHead}>
                <span className={w.qNum}>1</span>
                <div>
                  <h3 className={w.qTitle}>Do you have a recent electricity bill?</h3>
                  <p className={w.qSub}>Paper, PDF or the app all work. It only takes a couple of minutes.</p>
                </div>
              </div>
              <div className={w.big}>
                <button type="button" className={usageSource === "bill" ? w.bigOn : w.bigBtn} onClick={() => setUsageSource("bill")}>
                  <span className={w.bigIcon} aria-hidden="true"><Icon name="file" size={22} /></span>
                  <span><b>Yes, I have a bill</b>Snap a photo or copy a few numbers. Most accurate.</span>
                  <span className={w.tick} aria-hidden="true">✓</span>
                </button>
                <button type="button" className={useEst ? w.bigOn : w.bigBtn} onClick={() => setUsageSource("estimate")}>
                  <span className={w.bigIcon} aria-hidden="true"><Icon name="home" size={22} /></span>
                  <span><b>No, estimate it for me</b>We&apos;ll use your answers about your home.</span>
                  <span className={w.tick} aria-hidden="true">✓</span>
                </button>
                <button type="button" className={`${usageSource === "average" ? w.bigOn : w.bigBtn} ${w.bigWide}`} onClick={() => setUsageSource("average")}>
                  <span className={w.bigIcon} aria-hidden="true"><Icon name="chart" size={22} /></span>
                  <span><b>Not sure? Use the average home</b>{AVERAGE_ANNUAL_KWH.toLocaleString("en-AU")} kWh a year, the Victorian benchmark.</span>
                  <span className={w.tick} aria-hidden="true">✓</span>
                </button>
              </div>
            </section>}

            {/* Q: how long is the bill */}
            <section className={w.q}>
              <div className={w.qHead}>
                <span className={w.qNum}>{qn(2)}</span>
                <div>
                  <h3 className={w.qTitle}>{usageSource !== "bill" ? "How often do you get a bill?" : "How long does your bill cover?"}</h3>
                  <p className={w.qSub}>{usageSource !== "bill" ? "So we show costs for the same period." : "Look for the billing period, e.g. “1 Jul to 30 Sep”."}</p>
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


            {useEst ? (
              <>
                <section className={w.q}>
                  <div className={w.qHead}>
                    <span className={w.qNum}>{qn(3)}</span>
                    <div>
                      <h3 className={w.qTitle}>Here&apos;s what we think your home uses</h3>
                      <p className={w.qSub}>{onePage ? "From your answers above." : "From your answers in step 2."} Change those and this updates.</p>
                    </div>
                  </div>
                  <EstimatePanel
                    profile={profile}
                    billDays={days}
                    bill={{ kwhRaw: calKwhRaw, endMonth: calEndMonth, onKwh: setCalKwhRaw, onEndMonth: setCalEndMonth, forecast: billForecast }}
                    showInput={false}
                  />
                </section>

                <section className={w.q}>
                  <div className={w.qHead}>
                    <span className={w.qNum}>{qn(4)}</span>
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
            ) : usageSource === "average" ? (
              <section className={w.q}>
                <div className={w.qHead}>
                  <span className={w.qNum}>3</span>
                  <div>
                    <h3 className={w.qTitle}>We&apos;ll use the average Victorian home</h3>
                    <p className={w.qSub}>For when you don&apos;t have a bill or don&apos;t know your usage.</p>
                  </div>
                </div>
                <div className={w.estimate}>
                  <div className={w.estBig}>
                    <b>{AVERAGE_ANNUAL_KWH.toLocaleString("en-AU")} kWh a year</b>, about {(AVERAGE_ANNUAL_KWH / 365).toLocaleString("en-AU", { maximumFractionDigits: 1 })} kWh a day, or ~
                    {(avg.peak + avg.shoulder + avg.offpeak).toLocaleString("en-AU")} kWh a bill.
                  </div>
                  <span className={w.rateHint}>
                    It&apos;s the figure the Essential Services Commission uses for the Victorian Default Offer, so you&apos;ll see what each plan costs a
                    typical home. Your own costs could be quite different: add a bill or answer the questions about your home for a sharper answer.
                  </span>
                </div>
              </section>
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

        {blockReason && !(onStep1 && propertyType !== "home") && (
          <p className={styles.blockNote} role="status">
            {blockReason}
            {inputStep === 3 && usageSource === "bill" && !billFlag && (
              <>
                {" "}
                <button type="button" className={styles.blockAction} onClick={() => setUsageSource("average")}>
                  Use the average home ({AVERAGE_ANNUAL_KWH.toLocaleString("en-AU")} kWh a year)
                </button>
              </>
            )}
          </p>
        )}
        <div className={styles.wizardNav}>
          {inputStep > 1 && !onePage ? (
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
          {inputStep < 3 && !onePage ? (
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
          {inputStep < 3 && !onePage ? (
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
              {useAvg && (
                <div className={styles.avgNote} role="status">
                  <Icon name="chart" size={18} />
                  <div>
                    {billUsageThin && usageSource === "bill" ? (
                      <>
                        <b>Your bill doesn&apos;t show enough usage to compare on</b>
                        <p>
                          {Math.round((mode === "detailed" ? peak + shoulder + offpeak : anytime) + cl).toLocaleString("en-AU")} kWh over {days} days looks
                          incomplete (a new account, a short or estimated read, or an empty house?). So these figures use the average Victorian home:{" "}
                          {AVERAGE_ANNUAL_KWH.toLocaleString("en-AU")} kWh a year.{" "}
                          <button type="button" className={styles.blockAction} onClick={() => setKeepUsageFor(usageSig)}>Use my bill&apos;s usage anyway</button>
                        </p>
                      </>
                    ) : (
                      <>
                        <b>These figures are for the average Victorian home</b>
                        <p>
                          {AVERAGE_ANNUAL_KWH.toLocaleString("en-AU")} kWh a year, the Essential Services Commission&apos;s benchmark. Your own costs could be quite
                          different: a bill gives your real numbers.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
              {worthSwitching && (
                <div className={r.hero}>
                  <span className={r.kicker}>{useAvg ? "Based on an average Victorian home" : useEst ? (billForecast ? "Forecast from your bill's kWh" : "Estimated from your answers") : haveBill ? "Based on your bill" : "Based on your usage"}</span>
                  <div className={r.heroLabel}>{haveBill ? "You could save" : "The cheapest plan could save you up to"}</div>
                  <div className={r.heroNum}>
                    ${Math.round(perYear(bench - top.total)).toLocaleString("en-AU")}
                    <span> a year</span>
                  </div>
                  <div className={r.compare}>
                    <div className={r.tile}>
                      <span className={r.tileLabel}>{haveBill ? "Your bill now" : "The default offer"}</span>
                      <b>{fmtCurrency(perMonth(bench))}</b>
                      <small>a month</small>
                    </div>
                    <span className={r.op} aria-hidden="true">→</span>
                    <div className={r.tile}>
                      <span className={r.tileLabel}>{locked ? "With the cheapest plan" : `With ${top.plan[0]}`}</span>
                      <b>{fmtCurrency(perMonth(top.total))}</b>
                      <small>a month</small>
                    </div>
                    <span className={r.op} aria-hidden="true">=</span>
                    <div className={`${r.tile} ${r.tileSave}`}>
                      <span className={r.tileLabel}>You save</span>
                      <b>{fmtCurrency(perMonth(bench - top.total))}</b>
                      <small>a month</small>
                    </div>
                  </div>
                  <p className={r.heroNote}>
                    Cheapest of {matches.length} plans from the {RETAILER_COUNT} retailers we check{RETAILER_COUNT >= BROAD_COVERAGE ? "" : ", not every retailer in Victoria"}.
                    {!haveBill && " Add your bill to compare against what you really pay."}
                  </p>
                  {locked ? (
                    <button type="button" className={r.heroBtn} onClick={joinScroll}>
                      <Icon name="lock" size={16} /> See which retailer →
                    </button>
                  ) : RETAILER_LINKS[top.plan[0]] ? (
                    <a href={RETAILER_LINKS[top.plan[0]]} data-plan={top.plan[2]} data-network={distributor} target="_blank" rel="noopener noreferrer" className={r.heroBtn}>
                      See the {top.plan[0]} plan →
                    </a>
                  ) : (
                    <a href="#top-plan" className={r.heroBtn}>See the plan ↓</a>
                  )}
                  <span className={r.fine}>
                    Averages a month from your {days}-day {haveBill ? "bill" : "period"}. Includes each plan&apos;s discounts, assuming you pay on time; leaves out
                    sign-up credits, fees and concessions. Confirm with the retailer. {PRICE_CHANGE_CLAUSE}
                  </span>
                </div>
              )}
              {locked && worthSwitching && (
                <div className={styles.stickyBar}>
                  <button type="button" className={styles.stickyBtn} onClick={joinScroll}>
                    <Icon name="lock" size={15} /> See the cheapest plan · save ${Math.round(periodBreakdown(bench - top.total, days).annual).toLocaleString("en-AU")}/yr →
                  </button>
                </div>
              )}
              {!locked && RETAILER_LINKS[top.plan[0]] && worthSwitching && (
                <div className={styles.stickyBar}>
                  <a href={RETAILER_LINKS[top.plan[0]]} data-plan={top.plan[2]} data-network={distributor} target="_blank" rel="noopener noreferrer" className={styles.stickyBtn}>
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
                  <div className={r.compare}>
                    <div className={r.tile}>
                      <span className={r.tileLabel}>Your bill now</span>
                      <b>{fmtCurrency(perMonth(bench))}</b>
                      <small>a month</small>
                    </div>
                    <div className={r.tile}>
                      <span className={r.tileLabel}>Cheapest we found</span>
                      <b>{fmtCurrency(perMonth(top.total))}</b>
                      <small>a month</small>
                    </div>
                  </div>
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
              {billCheck && haveBill && (
                <BillCheckCard
                  check={billCheck}
                  retailer={currentRetailer}
                  facts={{
                    billPlanName,
                    olderVersion: onOlderVersion && todaysVersion ? { planName: todaysVersion.plan[2], perMonth: perMonth(olderVersionGap), perYear: perYear(olderVersionGap) } : null,
                    planIsCurrent: !!todaysVersion && !onOlderVersion,
                    retailerBest: retailerBest
                      ? { planName: isLockedPlan(retailerBest) ? "one of their plans (members see which)" : retailerBest.plan[2], savingPerYear: perYear(bench - retailerBest.total) }
                      : null,
                    retailerCount: RETAILER_COUNT,
                    worthPerYear: WORTH_SWITCHING_PER_YEAR,
                  }}
                />
              )}
              {(!haveBill || useEst || useAvg) && (
                <div className={styles.accuracyCard}>
                  <div className={styles.accuracyHead}>
                    <span className={styles.accuracyBadge}>Estimate</span>
                    <b>Get your exact answer in about a minute</b>
                  </div>
                  <p className={styles.helper}>
                    {useAvg
                      ? <>We used the average Victorian home ({AVERAGE_ANNUAL_KWH.toLocaleString("en-AU")} kWh a year), so your own saving could be quite different. Add a bill for your real usage.</>
                      : !haveBill
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
                {locked ? (
                  <>
                    <div className={`${styles.retailer} ${r.lockedName}`}>
                      <Icon name="lock" size={22} /> <span className={r.blurName} aria-hidden="true" /> <span className={r.srOnly}>Retailer hidden</span>
                    </div>
                    <div className={styles.plan}>Members see the retailer, plan, rates and sign-up conditions</div>
                  </>
                ) : (<>
                <div className={styles.retailer}>
                  {top.plan[0]}
                  <span className={`${styles.offerTag} ${top.plan[3] === "MARKET" ? styles.offerMarket : styles.offerStanding}`}>
                    {top.plan[3] === "MARKET" ? "Market offer" : "Standing offer"}
                  </span>
                  {isEvFriendly(top.plan) && <EvBadge />}
                  {solarExportKwh > 0 && top.plan[10] !== null && <SolarBadge />}
                </div>
                <div className={styles.plan}>{top.plan[2]}</div>
                <div className={styles.offerDateRow}><OfferDate retailer={top.plan[0]} plan={top.plan[2]} dark /></div>
                </>)}
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
                {topOffer && !locked && (
                  <OfferTerms
                    o={topOffer}
                    retailer={top.plan[0]}
                    dark
                    payLateCost={topDetail && topDetail.conditionalDiscount * k >= 0.5 ? `${fmtCurrency(topDetail.conditionalDiscount * k)} ${PERIOD_LABEL[period]}` : null}
                  />
                )}

                {!locked && (
                <button
                  type="button"
                  className={styles.rateToggleBtn}
                  onClick={() => setExpandedKey((k) => (k === "best" ? null : "best"))}
                >
                  {expandedKey === "best" ? "Hide rates ▴" : myRates ? "Compare your rates with this plan ▾" : "See the rate breakdown ▾"}
                </button>
                )}
                {expandedKey === "best" && !locked &&
                  (myRates ? (
                    <div className={r.ratesBox}>
                      <RatesCompare current={myRates} plan={top.plan} planLabel={top.plan[0]} dark />
                    </div>
                  ) : (
                    <RateBreakdown plan={top.plan} solarExportKwh={solarExportKwh} />
                  ))}

                <p className={styles.scaleNote}>
                  From your {days}-day period, scaled to {PERIOD_LABEL[period]}. Usage changes with the seasons, so a year is the fairest view.
                </p>
                {locked ? (
                  <div className={r.unlockBox}>
                    <span className={r.unlockIcon}><Icon name="lock" size={22} /></span>
                    <div>
                      <b>See which retailer, and how to switch</b>
                      <span>
                        Members see the {lockedTop.length} cheapest plans by name, with their rates, discounts and sign-up conditions, plus every plan on your
                        network re-checked each morning. {MEMBER_PRICE_LINE}
                      </span>
                    </div>
                    <button type="button" className={styles.switchBtn} onClick={joinScroll}>Unlock the cheapest plans →</button>
                  </div>
                ) : (
                <div className={styles.getPlan}>
                  <RetailerLogo name={top.plan[0]} size={56} />
                  <div className={styles.getPlanText}>
                    <b>Get this plan from {top.plan[0]}</b>
                    <span>
                      {RETAILER_LINKS[top.plan[0]]
                        ? `Opens ${top.plan[0]}'s website in a new tab. Look for "${top.plan[2]}". Their page has the full offer details, conditions and the Energy Fact Sheet.`
                        : `Search for "${top.plan[2]}" on ${top.plan[0]}'s website for the full offer details and the Energy Fact Sheet.`}
                    </span>
                  </div>
                  {RETAILER_LINKS[top.plan[0]] && (
                    <a href={RETAILER_LINKS[top.plan[0]]} data-plan={top.plan[2]} data-network={distributor} target="_blank" rel="noopener noreferrer" className={styles.switchBtn}>
                      Go to {top.plan[0]} →
                    </a>
                  )}
                </div>
                )}
              </div>

              {retailerBest && top && locked && isLockedPlan(retailerBest) && (
                <div className={styles.stayCard}>
                  <div>
                    <b>Staying with {currentRetailer}?</b> One of the {lockedTop.length} cheapest plans is theirs, at about{" "}
                    {fmtCurrency(perMonth(retailerBest.total))} a month{haveBill && bench - retailerBest.total > 0.005 ? <> ({fmtCurrency(perMonth(bench - retailerBest.total))} a month less than your bill)</> : null}.
                    Members see which one, so you can ask {currentRetailer} to move you without changing company.
                  </div>
                </div>
              )}
              {retailerBest && top && !(locked && isLockedPlan(retailerBest)) && (() => {
                const cur = (ratesForm.planName ?? "").trim().toLowerCase();
                const best = retailerBest.plan[2].toLowerCase();
                // Same plan only when the names match closely (not just a shared brand word like "HomeDeal").
                const norm = (x: string) => x.replace(/[^a-z0-9]/g, "");
                const [nc, nb] = [norm(cur), norm(best)];
                const onIt = nc.length > 3 && (nc === nb || ((nb.includes(nc) || nc.includes(nb)) && Math.min(nc.length, nb.length) / Math.max(nc.length, nb.length) >= 0.75));
                const sameAsTop = retailerBest.plan[0] === top.plan[0] && retailerBest.plan[2] === top.plan[2];
                const stayYear = perYear(bench - retailerBest.total);
                const extraYear = perYear(retailerBest.total - top.total);
                const worthStaying = haveBill && !onIt && stayYear >= WORTH_SWITCHING_PER_YEAR;
                return (
                  <div className={`${styles.stayCard} ${worthStaying ? r.stayGood : ""}`}>
                    {worthStaying ? (
                      <>
                        <b className={r.stayHead}>You can save without changing company</b>
                        <div>
                          Ask {currentRetailer} to move you to &ldquo;{retailerBest.plan[2]}&rdquo;. It works out at <b>{fmtCurrency(perMonth(retailerBest.total))} a month</b>,
                          against {fmtCurrency(perMonth(bench))} on your bill: <b>{fmtCurrency(perMonth(bench - retailerBest.total))} a month less</b> (about $
                          {Math.round(stayYear).toLocaleString("en-AU")} a year). Changing plans with your own retailer is usually a quick call or a few taps in their app.
                        </div>
                      </>
                    ) : haveBill && onIt ? (
                      <div>
                        <b>Staying with {currentRetailer}?</b> You&apos;re already on their cheapest plan for you, &ldquo;{retailerBest.plan[2]}&rdquo;.
                      </div>
                    ) : haveBill ? (
                      <div>
                        <b>Staying with {currentRetailer}?</b> Their cheapest plan for you, &ldquo;{retailerBest.plan[2]}&rdquo;, is {fmtCurrency(perMonth(retailerBest.total))} a month,
                        about the same as your bill.
                      </div>
                    ) : (
                      <div>
                        <b>Staying with {currentRetailer}?</b> Their cheapest plan for you is &ldquo;{retailerBest.plan[2]}&rdquo; at {fmtCurrency(perMonth(retailerBest.total))} a month.
                        If you&apos;re on an older {currentRetailer} plan, ask them to move you to it. No need to change company.
                      </div>
                    )}
                    {!sameAsTop && extraYear > 1 && (
                      <div className={styles.stayNum}>
                        Moving to {locked ? "the cheapest plan" : top.plan[0]} instead saves about <b>${Math.round(extraYear).toLocaleString("en-AU")}</b> a year more.
                      </div>
                    )}
                    {sameAsTop && !worthStaying && haveBill && !onIt && (
                      <div className={styles.stayNum}>{currentRetailer} already has the cheapest plan we found.</div>
                    )}
                  </div>
                );
              })()}
              <details className={styles.detailsBox}>
                <summary>Every plan we compared, and the maths</summary>
                <div className={styles.detailsInner}>
              {(() => {
                const stay = perYear(bench);
                const go = perYear(top.total);
                const max = Math.max(stay, go, 1);
                const keep = stay - go;
                return (
                  <div className={r.year}>
                    <div className={r.yearTitle}>Your next 12 months</div>
                    <p className={r.yearIntro}>If you use about the same power as {haveBill ? "on this bill" : "we estimated"}.</p>
                    <div className={r.yearRow}>
                      <span className={r.yearLabel}>{haveBill ? "Stay on your current plan" : "Stay on the default offer"}</span>
                      <span className={r.yearTrack}><span className={r.yearStay} style={{ width: `${(stay / max) * 100}%` }} /></span>
                      <b className={r.yearAmt}>${Math.round(stay).toLocaleString("en-AU")}</b>
                    </div>
                    <div className={r.yearRow}>
                      <span className={r.yearLabel}>Switch to {locked ? "the cheapest plan" : top.plan[0]}</span>
                      <span className={r.yearTrack}><span className={r.yearGo} style={{ width: `${(go / max) * 100}%` }} /></span>
                      <b className={r.yearAmt}>${Math.round(go).toLocaleString("en-AU")}</b>
                    </div>
                    <p className={r.yearKeep}>
                      {keep > 1 ? (
                        <>You keep <b>${Math.round(keep).toLocaleString("en-AU")}</b> over the year, about {fmtCurrency(keep / 12)} a month.</>
                      ) : (
                        <>About the same either way.</>
                      )}
                    </p>
                  </div>
                );
              })()}

              <HowWeWorkedItOut
                hideName={locked}
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
                  <div className={r.listHead}>
                    <b>{allPlans ? `All ${matches.length} plans, cheapest first` : `Each retailer's cheapest plan, cheapest first`}</b>
                    <PlanViewToggle all={allPlans} onChange={setAllPlans} retailers={perRetailer.length} plans={matches.length} />
                    <span>
                      Prices are {PERIOD_LABEL[period]} for your usage. The green figure is what you&apos;d save against {haveBill ? "your bill" : "the default offer"}.
                    </span>
                    <span className={r.legend}>
                      <span className={r.chipMarket}>Market offer</span> a retailer&apos;s own deal ·{" "}
                      <span className={r.chipStanding}>Standing offer</span> the regulated default price, usually dearer ·{" "}
                      <span className={r.chip}>−12% vs VDO</span> against the Victorian Default Offer for your usage
                    </span>
                    <span className={r.legend}>
                      Prices include each plan&apos;s discounts, assuming you pay on time. Green ✓ labels are in the price; blue ones (credits, other
                      conditions) aren&apos;t; amber ! ones are limits on who can get it or fees to know about.
                    </span>
                  </div>

                  <div className={r.youBox}>
                    <div className={r.youTop}>
                      <span>{haveBill ? "Your current bill" : "The default offer (VDO)"}</span>
                      <b>{fmtCurrency(bench * k)} <small>{PERIOD_LABEL[period]}</small></b>
                    </div>
                    <p>
                      {useAvg ? "The average Victorian home" : useEst ? (billForecast ? "Forecast from your bill's kWh" : "Estimated from your answers") : haveBill ? "From your bill" : "For your usage"}: about{" "}
                      <b>{Math.round(kwhInPeriod * k).toLocaleString("en-AU")} kWh {PERIOD_LABEL[period]}</b> ({days > 0 ? (kwhInPeriod / days).toFixed(1) : "0"} kWh a day) on{" "}
                      {usagePeak + usageShoulder + usageOffpeak > 0 ? "a time-of-use tariff" : "a single-rate tariff"}
                      {clKwh > 0 ? " with controlled load" : ""}
                      {haveBill && currentRetailer ? <> with {currentRetailer}</> : null}.
                      {haveBill && top && (
                        vsVdo(bench) > 0 ? (
                          <>
                            {" "}That&apos;s <b className={r.bad}>{pctVdo(vsVdo(bench))}</b> against the default offer ({fmtCurrency(vdoForUsage * k)} {PERIOD_LABEL[period]}).
                          </>
                        ) : bench - top.total > 0.005 ? (
                          <>
                            {" "}You&apos;re under the default offer, but {locked ? "the cheapest plan" : top.plan[0]} would still cost <b className={r.good}>{fmtCurrency((bench - top.total) * k)} {PERIOD_LABEL[period]} less</b>.
                          </>
                        ) : (
                          <> You&apos;re under the default offer and nothing we found is cheaper.</>
                        )
                      )}
                    </p>
                  </div>

                  {lockedTop.length > 0 && (
                    <div className={r.lockedTop}>
                      {lockedTop.map((m, i) => {
                        const diff = bench - m.total;
                        return (
                          <div className={r.lockedRow} key={`locked-${i}`}>
                            <span className={r.lockAvatar} aria-hidden="true"><Icon name="lock" size={20} /></span>
                            <span className={r.info}>
                              <span className={r.nameLine}>
                                <span className={r.rank}>#{i + 1}</span>
                                <span className={r.blurBar} style={{ width: `${[62, 48, 70][i % 3]}%` }} aria-hidden="true" />
                              </span>
                              <span className={r.planName}>{i === 0 ? "The cheapest plan for your home" : "Members see the retailer, plan and rates"}</span>
                            </span>
                            <span className={r.priceCol}>
                              <span className={r.price}>{fmtCurrency(m.total * k)}</span>
                              <span className={r.per}>{PERIOD_LABEL[period]}</span>
                              {diff >= 0.005 && <span className={r.save}>Save {fmtCurrency(diff * k)}</span>}
                            </span>
                          </div>
                        );
                      })}
                      <button type="button" className={r.unlockBtn} onClick={joinScroll}>
                        <Icon name="lock" size={16} /> See the {lockedTop.length} cheapest plans by name
                      </button>
                    </div>
                  )}
                  <div className={r.list}>
                    {listRows.map((m, i) => {
                      const diff = bench - m.total;
                      const rowKey = m.plan[0] + m.plan[2] + i;
                      const isOpen = expandedKey === rowKey;
                      const isTop = m === top;
                      const offer = offerFor(m.plan);
                      return (
                        <div className={`${r.row} ${isTop ? r.rowTop : ""}`} key={rowKey}>
                          <button type="button" className={r.rowMain} onClick={() => setExpandedKey((x) => (x === rowKey ? null : rowKey))} aria-expanded={isOpen}>
                            <span className={r.avatar}><RetailerLogo name={m.plan[0]} size={48} /></span>
                            <span className={r.info}>
                              <span className={r.nameLine}>
                                {locked && <span className={r.rank}>#{rankOf(m)}</span>}
                                <b className={r.retailer}>{m.plan[0]}</b>
                                {isTop && <span className={r.cheapest}>{i === 0 ? "Cheapest" : "Cheapest you can get"}</span>}
                                {retailerBest && m === retailerBest && currentRetailer && <span className={r.yours}>Your retailer</span>}
                              </span>
                              <span className={r.planName} title={m.plan[2]}>{tidyPlanName(m.plan)}</span>
                              <span className={r.chips}>
                                <span className={m.plan[3] === "MARKET" ? r.chipMarket : r.chipStanding}>{m.plan[3] === "MARKET" ? "Market offer" : "Standing offer"}</span>
                                <span className={r.chip}>{m.plan[5] !== null ? "Single rate" : "Time of use"}</span>
                                <span className={Math.round(vsVdo(m.total) * 100) < 0 ? r.chipGood : Math.round(vsVdo(m.total) * 100) > 0 ? r.chipBad : r.chip} title="Against the Victorian Default Offer for the same usage">
                                  {pctVdo(vsVdo(m.total))} vs VDO
                                </span>
                                {isEvFriendly(m.plan) && <span className={r.chip}>EV plan</span>}
                                {solarExportKwh > 0 && m.plan[10] !== null && m.plan[10] > 0 && <span className={r.chip}>Solar credit {(m.plan[10] * 100).toFixed(1)}c</span>}
                                <OfferDate retailer={m.plan[0]} plan={m.plan[2]} />
                                <OfferChips o={offer} />
                              </span>
                            </span>
                            <span className={r.priceCol}>
                              <span className={r.price}>{fmtCurrency(m.total * k)}</span>
                              <span className={r.per}>{PERIOD_LABEL[period]}</span>
                              <span className={diff >= 0.005 ? r.save : diff <= -0.005 ? r.more : r.same}>
                                {diff >= 0.005 ? `Save ${fmtCurrency(diff * k)}` : diff <= -0.005 ? `${fmtCurrency(-diff * k)} more` : "Same as now"}
                              </span>
                              <span className={r.ratesLink}>{isOpen ? "Hide details ▴" : "Rates and conditions ▾"}</span>
                            </span>
                          </button>
                          {isOpen && (
                            <div className={styles.planRowExpanded}>
                              <p className={r.fullName}>Full plan name: {m.plan[2]}</p>
                              <RateBreakdown plan={m.plan} solarExportKwh={solarExportKwh} />
                              <OfferTerms
                                o={offer}
                                retailer={m.plan[0]}
                                compact
                                payLateCost={(() => { const d = billDetail(m.plan, usage); return d && d.conditionalDiscount * k >= 0.5 ? `${fmtCurrency(d.conditionalDiscount * k)} ${PERIOD_LABEL[period]}` : null; })()}
                              />
                              {RETAILER_LINKS[m.plan[0]] && (
                                <a href={RETAILER_LINKS[m.plan[0]]} data-plan={m.plan[2]} data-network={distributor} target="_blank" rel="noopener noreferrer" className={styles.rowSwitchLink}>
                                  Go to {m.plan[0]}&apos;s site →
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {hiddenRows.length > 0 && (
                    <MemberLock
                      variant="list"
                      startRank={lockedTop.length + listRows.length + 1}
                      title={`${hiddenRows.length} more ${allPlans ? "plans" : "retailers"} on your network`}
                      body={
                        <>
                          From {fmtCurrency(Math.min(...hiddenRows.map((x) => x.total)) * k)} to {fmtCurrency(Math.max(...hiddenRows.map((x) => x.total)) * k)}{" "}
                          {PERIOD_LABEL[period]}. Members see every plan with its rates, and get an email when a cheaper one turns up.
                        </>
                      }
                      cta={`See all ${matches.length} plans`}
                      onJoin={joinScroll}
                    />
                  )}

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

              <Disclosures priceDate={fmtUpdated()} />

              <div id="pricing" style={{ scrollMarginTop: 90 }} />
              <PricingSection
                email={email}
                onEmailChange={setEmail}
                yearlySaving={top && bench - top.total > 0 ? periodBreakdown(bench - top.total, days).annual : 0}
                bestRetailer={top && !locked ? top.plan[0] : ""}
                profile={{
                  distributor,
                  billingDays: days,
                  usageMode: useEst || useAvg ? "detailed" : mode,
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
                  billCheck: billCheck ? forStorage(billCheck) : null,
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

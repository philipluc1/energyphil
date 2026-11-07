"use client";

// The gas check, set up like the electricity one: a bill photo first, a
// "here's what we read" card, then one verdict and the cheapest plan.
// Typing the numbers in is the fallback.

import OfferDate from "../components/OfferDate";
import RepeatNudge from "../components/RepeatNudge";
import NoCalls from "../components/NoCalls";
import { fmtPrice, listPriceNow } from "@/lib/pricingPlans";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GAS_PLAN_DATA_DATE, GAS_RETAILER_COUNT, GAS_ZONES, TYPICAL_MJ_PER_DAY, gasBenchmark, gasDataReady, rankGasPlans, type GasZone } from "@/lib/gasPlans";
import { PRICE_CHANGE_CLAUSE, WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import { describeOffer, topOpen } from "@/lib/planExtras";
import RetailerLogo from "../components/RetailerLogo";
import GasPlanTable from "../components/GasPlanTable";
import GasSeasonChart from "../components/GasSeasonChart";
import { DEFAULT_GAS_PROFILE, VIC_GAS_HEATED_GJ, VIC_GAS_UNHEATED_GJ, annualFromGasBill, estimateGasAnnual, gasByMonth, heatingShareFor, monthsFromAnnual, periodMonths, type GasHeating, type GasProfile } from "@/lib/gasUsage";
import BillPhotoUpload from "../components/BillPhotoUpload";
import BillPagePrompt from "../components/BillPagePrompt";
import Icon from "../components/Icon";
import { guessGasZoneFromPostcode } from "@/lib/postcodeGas";
import { gasChargesForComparison, type ExtractedBill } from "@/lib/billExtraction";
import styles from "../components/Comparator.module.css";
import uc from "../components/usagechooser.module.css";
import InfoTip from "../components/InfoTip";
import CountUp from "../components/CountUp";
import { gasSavingsByZone } from "@/lib/gasInsights";
import snap from "../components/snap.module.css";
import g from "./gas.module.css";

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money0 = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const KEY = "utilo.gas.v1";

type Entry = "snap" | "type" | "estimate" | "read" | "result";
const clampDays = (n: number) => Math.min(366, Math.max(1, Math.round(n)));

const ZONE_HELP: Record<GasZone, string> = {
  "Australian Gas Networks": "Most of the rest of Melbourne, and regional Victoria",
  Multinet: "Melbourne's east and south-east",
  "AusNet Services": "Melbourne's west and north",
};

function fmtDate(iso: string): string {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default function GasCheck() {
  const [entry, setEntry] = useState<Entry>("snap");
  const [zone, setZone] = useState<GasZone>("Australian Gas Networks");
  const [days, setDays] = useState(91);
  const [postcode, setPostcode] = useState("");
  const [zoneGuess, setZoneGuess] = useState<GasZone | null>(null);
  const [mjRaw, setMjRaw] = useState("");
  const [billRaw, setBillRaw] = useState("");
  const [planName, setPlanName] = useState("");
  const [retailer, setRetailer] = useState("");
  // The rates off the bill (dollars), for "Your bill" beside each plan's rates (7 Nov 2026).
  const [yourRates, setYourRates] = useState<{ supply: number | null; usage: number | null } | null>(null);
  const [fromPhoto, setFromPhoto] = useState(false);
  // The retailer estimated the read on the bill we read (7 Nov 2026).
  const [estimatedRead, setEstimatedRead] = useState(false);
  // The printed total was set aside for rates × usage (a credit or adjustment on the bill).
  const [billBasis, setBillBasis] = useState<{ printed: number } | null>(null);
  // No bill: a few questions about the home, priced on typical Victorian gas use.
  const [profile, setProfile] = useState<GasProfile>(DEFAULT_GAS_PROFILE);
  const [fromEstimate, setFromEstimate] = useState(false);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [elecOnly, setElecOnly] = useState(false);
  // A gas front page was read: the pages so far, so page 2 can be added to them.
  const [pagePrompt, setPagePrompt] = useState<{ bill: ExtractedBill; pages: Blob[] } | null>(null);
  // The no-bill questions, one step at a time (as on the electricity check).
  const [gq, setGq] = useState<1 | 2 | 3 | 4>(1);
  const [gqDir, setGqDir] = useState<"fwd" | "back">("fwd");
  const [gasPick, setGasPick] = useState<"average" | "home" | "bill">("average");

  // Pick up saved details, including a gas bill read on the electricity page.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const d = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
        if (d) {
          if (GAS_ZONES.includes(d.zone)) setZone(d.zone);
          if (typeof d.days === "number" && d.days > 0) setDays(clampDays(d.days));
          if (typeof d.periodEnd === "string") setPeriodEnd(d.periodEnd);
          if (typeof d.mj === "number" && d.mj > 0) setMjRaw(String(d.mj));
          if (typeof d.billRaw === "string") setBillRaw(d.billRaw);
          if (typeof d.planName === "string") setPlanName(d.planName);
          if (typeof d.retailer === "string") setRetailer(d.retailer);
          if (d.yourRates && typeof d.yourRates === "object") setYourRates(d.yourRates);
          if (d.fromBill && d.mj > 0) {
            setFromPhoto(true);
            setEntry("read");
          }
        }
      } catch { /* nothing saved */ }
      setHydrated(true);
      // 7 Nov 2026: a gas bill read on the power check (utilo.gasHandoff) is applied here, once.
      try {
        const raw = window.sessionStorage.getItem("utilo.gasHandoff");
        if (raw) { window.sessionStorage.removeItem("utilo.gasHandoff"); fromBill(JSON.parse(raw) as ExtractedBill); }
      } catch { /* ignore */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const mj = parseFloat(mjRaw);
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ zone, days, mj: Number.isFinite(mj) ? mj : 0, billRaw, planName, retailer, periodEnd, yourRates }));
    } catch { /* ignore */ }
  }, [zone, days, mjRaw, billRaw, planName, retailer, periodEnd, yourRates, hydrated]);

  function fromBill(b: ExtractedBill, pages: Blob[] = []) {
    if (!b.gasMj) {
      if (b.fuel === "gas" && pages.length > 0) {
        // 7 Nov 2026: the front page of a gas bill (amount due, no MJ). Ask for page 2.
        setElecOnly(false);
        setPagePrompt({ bill: b, pages });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // An electricity-only bill: point them to the right check.
      setElecOnly(b.fuel === "electricity" || b.fuel === null);
      return;
    }
    setElecOnly(false);
    setPagePrompt(null);
    const w: string[] = [];
    if (b.postcode) { setPostcode(b.postcode); const guess = guessGasZoneFromPostcode(b.postcode); setZoneGuess(guess); if (guess) setZone(guess); }
    // The bill's own distributor beats the postcode guess.
    if (b.gasDistributor && GAS_ZONES.includes(b.gasDistributor as GasZone)) setZone(b.gasDistributor as GasZone);
    else w.push("We couldn't see your gas network. Please check it.");
    const d = b.gasBillingDays ?? b.billingDays;
    if (d) setDays(clampDays(d));
    else w.push("We couldn't find the billing period. Please check the days.");
    setPeriodEnd(b.periodEnd ?? null);
    setFromEstimate(false);
    setMjRaw(String(Math.round(b.gasMj)));
    // 7 Nov 2026: rates × usage when the bill shows its rates (a credit or true-up
    // on the bill can't get into that); the bill's total only when it agrees.
    const charges = gasChargesForComparison(b);
    setBillRaw(charges.total ? String(charges.total) : "");
    setBillBasis(charges.basis === "rates" && b.gasBillTotal ? { printed: b.gasBillTotal } : null);
    setPlanName(b.gasPlanName ?? "");
    setRetailer(b.retailerName ?? "");
    setEstimatedRead(!!b.usageEstimated);
    setYourRates(b.gasSupplyCentsPerDay || b.gasUsageCentsPerMj ? { supply: b.gasSupplyCentsPerDay ? b.gasSupplyCentsPerDay / 100 : null, usage: b.gasUsageCentsPerMj ? b.gasUsageCentsPerMj / 100 : null } : null);
    // Utilo compares home plans: flag business and embedded-network gas bills.
    const flags: string[] = [];
    if (b.embeddedNetwork) flags.push("This bill looks like it's from an embedded network (gas supplied through your building). We can't compare those yet, so treat this result with care.");
    if (b.accountType === "business" || b.demandCharge) flags.push("This looks like a business gas bill. Utilo compares home plans for now, so a result here could mislead.");
    setWarnings([...flags, ...w, ...(b.warnings ?? [])]);
    setFromPhoto(true);
    // 7 Nov 2026: a clean read goes straight to the result, like electricity; the
    // result's read strip shows what was read, with "Check" to change it.
    setEntry(w.length ? "type" : "result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const estimate = useMemo(() => estimateGasAnnual(profile), [profile]);
  const zoneSaves = useMemo(() => (gasDataReady ? gasSavingsByZone(VIC_GAS_HEATED_GJ * 1000) : []), []);
  // The estimate is a year's gas for a home like this, scaled to the period: plans are compared on the average so the answer holds all year.
  const mj = fromEstimate ? (estimate.total * days) / 365 : parseFloat(mjRaw);
  const mjOk = Number.isFinite(mj) && mj > 0;
  const bill = billRaw === "" ? null : parseFloat(billRaw);
  const haveBill = bill !== null && Number.isFinite(bill) && bill > 0;
  const usage = useMemo(() => ({ days, mj: mjOk ? mj : 0 }), [days, mj, mjOk]);
  const ranked = useMemo(() => (mjOk ? rankGasPlans(zone, usage) : []), [zone, usage, mjOk]);
  const bench = useMemo(() => (mjOk ? gasBenchmark(zone, usage, haveBill ? bill : null) : null), [zone, usage, bill, haveBill, mjOk]);
  // Cheapest gas plan anyone can get; members-only offers and the like stay in the list.
  const top = topOpen(ranked);
  const perYear = (v: number) => (v / Math.max(1, days)) * 365;
  const yearly = top && bench ? perYear(bench.value - top.total) : 0;
  const worth = yearly >= WORTH_SWITCHING_PER_YEAR;
  const go = (e: Entry) => { setEntry(e); window.scrollTo({ top: 0, behavior: "smooth" }); };
  // Steps: the average home skips the questions about the home.
  const gqPages: (1 | 2 | 3 | 4)[] = gasPick === "home" ? [1, 2, 3, 4] : [1, 2, 4];
  const gqIdx = Math.max(0, gqPages.indexOf(gq));
  const GQ_TITLES: Record<number, string> = { 1: "Where you live", 2: "Your gas use", 3: "About your home", 4: "Your estimate" };
  function goGq(to: 1 | 2 | 3 | 4, dir: "fwd" | "back") {
    setGqDir(dir);
    setGq(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const gqNext = () => goGq(gqPages[Math.min(gqPages.length - 1, gqIdx + 1)], "fwd");
  const gqBack = () => goGq(gqPages[Math.max(0, gqIdx - 1)], "back");
  function pickGas(p: "average" | "home" | "bill") {
    setGasPick(p);
    // The average home is the standard profile; "my home" starts there too.
    if (p === "average") setProfile(DEFAULT_GAS_PROFILE);
  }

  const networkBlock = (n: number) => (
    <div className={g.q}>
      <span className={g.qLabel}>{n ? `${n}. ` : ""}Your gas network</span>
      <span className={g.qHint}>On your bill as &ldquo;Distributor&rdquo;. Not sure? Your postcode usually tells us.</span>
      <div className={g.postcodeRow}>
        <label htmlFor="gasPostcode" className={g.postcodeLabel}>Postcode</label>
        <input
          id="gasPostcode"
          className={g.postcode}
          inputMode="numeric"
          maxLength={4}
          placeholder="e.g. 3121"
          value={postcode}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            setPostcode(v);
            const guess = guessGasZoneFromPostcode(v);
            setZoneGuess(guess);
            if (guess) setZone(guess);
          }}
        />
        {postcode.length === 4 && (
          <span className={g.postcodeNote}>
            {zoneGuess ? <>Looks like <b>{zoneGuess}</b>. Change it below if your bill says otherwise.</> : <>We can&apos;t tell from that postcode alone: pick your network below.</>}
          </span>
        )}
      </div>
      <div className={g.zones}>
        {GAS_ZONES.map((z) => (
          <button key={z} type="button" className={z === zone ? g.zoneOn : g.zone} onClick={() => setZone(z)}>
            <b>{z}</b><span>{ZONE_HELP[z]}</span>
          </button>
        ))}
      </div>
    </div>
  );
  const choice = <T extends string | number | boolean>(value: T, onChange: (v: T) => void, options: { value: T; label: string }[]) => (
    <div className={g.pills}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={o.value === value ? g.pillOn : g.pill} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );

  /* ---------- 1. Photo first ---------- */
  if (entry === "snap") {
    return (
      <>
        {pagePrompt && (
          <div className={snap.readCard}>
            <div className={snap.readHead}>
              <span className={snap.readTick} aria-hidden="true">✓</span>
              {pagePrompt.bill.retailerName ? `Got the front of your ${pagePrompt.bill.retailerName} gas bill` : "Got the front of your gas bill"}
            </div>
            <BillPagePrompt bill={pagePrompt.bill} pages={pagePrompt.pages} onApply={fromBill} typeItIn={<>Or <button type="button" className={g.textBtn} onClick={() => { setPagePrompt(null); setFromEstimate(false); go("type"); }}>type your usage in</button>: the MJ and days are on the &ldquo;understand your bill&rdquo; page.</>} />
          </div>
        )}
        <BillPhotoUpload variant="hero" fuel="gas" onApply={fromBill} highlight={zoneSaves.length > 0 && zoneSaves[0].save >= 1 ? (
          <div className={g.savePill}>
            <span className={g.saveDot} aria-hidden="true" />
            <span>Gas savings on today&apos;s prices: <b>up to $<CountUp value={Math.round(zoneSaves[0].save)} /> a year</b></span>
            <InfoTip label="About these gas savings">
              For a gas-heated Victorian home ({VIC_GAS_HEATED_GJ} GJ a year), the cheapest gas plan anyone can get against a typical plan (the middle of the market) on each network today:{" "}
              {zoneSaves.map((z, i) => <span key={z.zone}>{i > 0 ? ", " : ""}{z.zone} {money0(z.save)}</span>)}. Victoria has no default offer for gas, so the middle of the market is the yardstick. Snap your bill for your own figure.
            </InfoTip>
          </div>
        ) : null}>
          <div className={snap.otherCombo}>
            <button type="button" className={snap.otherMain} onClick={() => { setBillRaw(""); setFromPhoto(false); setFromEstimate(true); setGqDir("fwd"); setGq(1); go("estimate"); }}>
              <Icon name="home" size={18} /> No gas bill handy? <small>Use the average gas home, or a few taps</small>
            </button>
            <button type="button" className={snap.otherSub} onClick={() => { setFromEstimate(false); go("type"); }}>
              Or type in three numbers from your gas bill →
            </button>
          </div>
        </BillPhotoUpload>
        {elecOnly && (
          <div className={g.notice}>
            That looks like an electricity bill. <Link href="/check">Check it on the electricity page</Link>, or snap your gas bill here.
          </div>
        )}
        <p className={snap.underNote}>
          Victorian homes. Electricity bill? <Link href="/check">Check electricity</Link>.
        </p>
      </>
    );
  }

  /* ---------- 2. Here's what we read ---------- */
  if (entry === "read") {
    return (
      <div className={snap.readCard}>
        <div className={snap.readHead}>
          <span className={snap.readTick} aria-hidden="true">✓</span>
          {fromPhoto ? (retailer ? `Got it: your ${retailer} gas bill` : "Got it: we've read your gas bill") : "Your gas details"}
        </div>
        <p className={snap.readSub}>If anything looks wrong, change it before we work it out.</p>
        <dl className={snap.facts}>
          <div className={snap.fact}><dt>Gas network</dt><dd>{zone}</dd></div>
          <div className={snap.fact}><dt>Bill period</dt><dd>{days} days</dd></div>
          <div className={snap.fact}><dt>Gas used</dt><dd>{mjOk ? `${Math.round(mj).toLocaleString("en-AU")} MJ` : "Not found"}</dd></div>
          <div className={snap.fact}><dt>Gas charges</dt><dd>{haveBill ? money(bill as number) : "Not found"}</dd></div>
          {planName && <div className={`${snap.fact} ${g.wide}`}><dt>Your gas plan</dt><dd>{planName}</dd></div>}
        </dl>
        {warnings.length > 0 && (
          <div className={snap.readWarn}><b>Worth a check:</b><ul>{warnings.map((m, i) => <li key={i}>{m}</li>)}</ul></div>
        )}
        <button type="button" className={snap.readGo} disabled={!mjOk} onClick={() => go("result")}>See my gas result →</button>
        <button type="button" className={snap.readEdit} onClick={() => go("type")}>Check or change what we read</button>
        <NoCalls center />
      </div>
    );
  }

  /* ---------- 2b. No bill: one step at a time ---------- */
  if (entry === "estimate") {
    const months = gasByMonth(estimate);
    const gj = (mjYear: number) => (mjYear / 1000).toLocaleString("en-AU", { maximumFractionDigits: 1 });
    const avgGj = gj(estimateGasAnnual(DEFAULT_GAS_PROFILE).total);
    return (
      <>
        {gq === 1 && <BillPhotoUpload variant="strip" fuel="gas" onApply={fromBill} />}
        <div className={uc.progress} aria-label={`Step ${gqIdx + 1} of ${gqPages.length}: ${GQ_TITLES[gq]}`}>
          <div className={uc.progressText}>
            <span>Step {gqIdx + 1} of {gqPages.length}</span>
            <b>{GQ_TITLES[gq]}</b>
          </div>
          <div className={uc.progressBar} aria-hidden="true">
            {gqPages.map((n, i) => <i key={n} className={i < gqIdx ? uc.segDone : i === gqIdx ? uc.segOn : ""} />)}
          </div>
        </div>
        <div key={`gq${gq}`} className={`${styles.card} ${gqDir === "fwd" ? uc.pageFwd : uc.pageBack}`}>
          {gq === 1 && (
            <>
              <h2 className={g.h2}>Where you live</h2>
              <p className={g.qHint}>Gas prices depend on your network, so we start there.</p>
              {networkBlock(0)}
            </>
          )}

          {gq === 2 && (
            <>
              <h2 className={g.h2}>Your gas use</h2>
              <p className={g.qHint}>No bill handy? Start with a typical home. You can sharpen it with a few taps.</p>
              <div className={uc.choose} role="radiogroup" aria-label="How to work out your gas use" style={{ marginTop: 14 }}>
                <button type="button" role="radio" aria-checked={gasPick === "average"} className={`${uc.row} ${gasPick === "average" ? uc.rowOn : ""}`} onClick={() => pickGas("average")}>
                  <span className={uc.radio} aria-hidden="true" />
                  <span className={uc.rowText}>
                    <b>Use the average gas home</b>
                    <small>About {avgGj} GJ a year: gas heating, hot water and cooking. No bill needed.</small>
                  </span>
                  <span className={uc.badge}>Quickest</span>
                </button>
                {gasPick === "average" && (
                  <div className={uc.body}>
                    <p className={uc.avgLine}>
                      We&apos;ll price every plan for a typical Victorian home with <b>ducted gas heating, gas hot water and a gas cooktop, three people</b>: about <b>{avgGj} GJ a year</b>, most of it in winter.{" "}
                      <InfoTip label="About the average gas home">
                        A Victorian home with gas heating typically uses 40 to 55 GJ a year; one without it, 10 to 20 GJ. Your own home could be quite different: a bill, or a few answers, gives a sharper answer.
                      </InfoTip>
                    </p>
                  </div>
                )}

                <button type="button" role="radio" aria-checked={gasPick === "home"} className={`${uc.row} ${gasPick === "home" ? uc.rowOn : ""}`} onClick={() => pickGas("home")}>
                  <span className={uc.radio} aria-hidden="true" />
                  <span className={uc.rowText}>
                    <b>Estimate from my home</b>
                    <small>Heating, hot water, cooktop and who lives there.</small>
                  </span>
                  <span className={uc.chev} aria-hidden="true">▾</span>
                </button>
                {gasPick === "home" && (
                  <div className={uc.body}>
                    <p className={uc.avgLine}>Four taps: press <b>Next</b> for the questions.</p>
                  </div>
                )}

                <button type="button" role="radio" aria-checked={gasPick === "bill"} className={`${uc.row} ${gasPick === "bill" ? uc.rowOn : ""}`} onClick={() => pickGas("bill")}>
                  <span className={uc.radio} aria-hidden="true" />
                  <span className={uc.rowText}>
                    <b>Enter the MJ from my bill</b>
                    <small>The gas used and the charges, from your last bill. The most accurate without a photo.</small>
                  </span>
                  <span className={uc.chev} aria-hidden="true">▾</span>
                </button>
                {gasPick === "bill" && (
                  <div className={uc.body}>
                    <p className={uc.avgLine}>Press <b>Next</b> and type in the numbers from your gas bill.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {gq === 3 && (
            <>
              <h2 className={g.h2}>About your home</h2>
              <p className={g.qHint}>Four quick questions. Heating is most of a Victorian gas bill.</p>
              <div className={g.q}>
                <span className={g.qLabel}>1. Gas heating?</span>
                {choice<GasHeating>(profile.heating, (v) => setProfile({ ...profile, heating: v }), [
                  { value: "ducted", label: "Ducted (whole house)" },
                  { value: "space", label: "A space heater or wall furnace" },
                  { value: "none", label: "No gas heating" },
                ])}
                <span className={g.qHint}>A home with gas heating uses about {VIC_GAS_HEATED_GJ} GJ a year; without it, about {VIC_GAS_UNHEATED_GJ} GJ.</span>
              </div>
              <div className={g.row2}>
                <div className={g.q}>
                  <span className={g.qLabel}>2. Gas hot water?</span>
                  {choice(profile.hotWater, (v) => setProfile({ ...profile, hotWater: v }), [{ value: true, label: "Yes" }, { value: false, label: "No" }])}
                </div>
                <div className={g.q}>
                  <span className={g.qLabel}>3. Gas cooktop?</span>
                  {choice(profile.cooking, (v) => setProfile({ ...profile, cooking: v }), [{ value: true, label: "Yes" }, { value: false, label: "No" }])}
                </div>
              </div>
              <div className={g.q}>
                <span className={g.qLabel}>4. People at home</span>
                {choice(profile.people, (v) => setProfile({ ...profile, people: v }), [1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 5 ? "5+" : String(n) })))}
              </div>
              <p className={g.liveGj} aria-live="polite">
                {estimate.total > 0 ? <>About <b>{gj(estimate.total)} GJ</b> a year for a home like yours</> : <>No gas heating, hot water or cooking? Then there&apos;s no gas to compare.</>}
              </p>
            </>
          )}

          {gq === 4 && (
            <>
              <h2 className={g.h2}>Your estimate</h2>
              <p className={g.qHint}>{gasPick === "average" ? "The average gas home" : "A home like yours"} on {zone}. We price plans on a whole year, so the answer holds in summer and winter.</p>
              <GasSeasonChart heating={months.heating} other={months.other} title={gasPick === "average" ? "A year of gas for the average home" : "A year of gas for a home like yours"} note={`About ${gj(estimate.total)} GJ a year. The winter hump is heating; the flat part is hot water and cooking. Typical Melbourne-climate figures, not a measurement: snap a bill when you have one for your own numbers.`} />
              <div className={g.q}>
                <span className={g.qLabel}>How often are you billed?</span>
                <div className={g.pills}>
                  {([[30, "Monthly"], [61, "Every 2 months"], [91, "Quarterly"]] as [number, string][]).map(([d, l]) => (
                    <button key={d} type="button" className={days === d ? g.pillOn : g.pill} aria-pressed={days === d} onClick={() => setDays(d)}>{l}</button>
                  ))}
                </div>
                <span className={g.qHint}>So each bill&apos;s cost reads the way yours will.</span>
              </div>
            </>
          )}

          <div className={styles.wizardNav}>
            {gqIdx > 0 ? (
              <button type="button" className={styles.wizardBackBtn} onClick={gqBack}>← Back</button>
            ) : (
              <button type="button" className={styles.wizardBackBtn} onClick={() => go("snap")}>← Snap a bill</button>
            )}
            <span className={uc.navRight}>
              {gq === 2 && gasPick === "bill" ? (
                <button type="button" className={styles.heroCta} onClick={() => { setFromEstimate(false); go("type"); }}>Next →</button>
              ) : gq !== 4 ? (
                <button type="button" className={styles.heroCta} disabled={gq === 3 && estimate.total === 0} onClick={gqNext}>Next →</button>
              ) : (
                <button type="button" className={styles.heroCta} disabled={!mjOk || estimate.total === 0} onClick={() => go("result")}>See my gas result →</button>
              )}
            </span>
          </div>
          {/* 4 Nov 2026: same as electricity, the promise after the last question. */}
          {gq === 4 && <NoCalls center />}
        </div>
      </>
    );
  }

  /* ---------- 3. Type it in ---------- */
  if (entry === "type") {
    return (
      <>
        {!fromPhoto && <BillPhotoUpload variant="strip" fuel="gas" onApply={fromBill} />}
        <div className={styles.card}>
          <h2 className={g.h2}>Your gas bill</h2>
          {warnings.length > 0 && <div className={snap.readWarn}><ul>{warnings.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}

          {networkBlock(1)}

          <div className={g.q}>
            <span className={g.qLabel}>2. How long the bill covers</span>
            <div className={g.pills}>
              {([[30, "Monthly"], [61, "2 months"], [91, "Quarterly"]] as [number, string][]).map(([d, l]) => (
                <button key={d} type="button" className={days === d ? g.pillOn : g.pill} onClick={() => setDays(d)}>{l}</button>
              ))}
              <label className={g.inline}>or <input type="number" min={1} max={366} value={days} onChange={(e) => setDays(clampDays(parseInt(e.target.value) || 91))} aria-label="Days on the bill" /> days</label>
            </div>
          </div>

          <div className={g.row2}>
            <label className={g.field}>
              <span className={g.qLabel}>3. Gas used</span>
              <span className={g.suffixWrap}><input type="number" inputMode="decimal" min={0} placeholder={`e.g. ${TYPICAL_MJ_PER_DAY * 91}`} value={mjRaw} onChange={(e) => setMjRaw(e.target.value)} /><span>MJ</span></span>
              <span className={g.qHint}>Megajoules, usually in the usage table. A typical home uses about {TYPICAL_MJ_PER_DAY} MJ a day, more in winter.</span>
            </label>
            <label className={g.field}>
              <span className={g.qLabel}>4. Gas charges <span className={g.opt}>(recommended)</span></span>
              <span className={g.suffixWrap}><span>$</span><input type="number" inputMode="decimal" min={0} step="0.01" placeholder="e.g. 245.60" value={billRaw} onChange={(e) => setBillRaw(e.target.value)} /></span>
              <span className={g.qHint}>The gas total including GST. Without it we compare with a typical plan.</span>
            </label>
          </div>

          <button type="button" className={snap.readGo} disabled={!mjOk} onClick={() => go("result")}>See my gas result →</button>
          {!mjOk && <p className={g.block}>Enter the MJ from your bill, or snap the bill above.</p>}
          <NoCalls center />
        </div>
      </>
    );
  }

  /* ---------- 4. Result ---------- */
  return (
    <>
      <div className={g.topBar}>
        <button type="button" className={styles.backLink} onClick={() => go(fromPhoto ? "read" : fromEstimate ? "estimate" : "type")}>← Edit my details</button>
        {gasDataReady && <span className={g.meta}>{ranked.length} gas plans on {zone}, from the {GAS_RETAILER_COUNT} gas retailers we track · prices checked {fmtDate(GAS_PLAN_DATA_DATE)}</span>}
      </div>
      {fromPhoto && haveBill && (
        <div className={styles.readStrip}>
          <span className={styles.readStripTick} aria-hidden="true">✓</span>
          <span className={styles.readStripText}>
            <b>Read from your {retailer ? `${retailer} ` : ""}gas bill</b>
            <span>{Math.round(parseFloat(mjRaw) || 0).toLocaleString("en-AU")} MJ over {days} days · {money(bill ?? 0)}{planName ? ` · ${planName}` : ""}{zone ? ` · ${zone}` : ""}</span>
            {billBasis && <span className={styles.readStripNote}>Your bill&apos;s printed total ({money(billBasis.printed)}) includes a one-off credit or adjustment, so we&apos;ve priced your plan from its rates and your usage instead.</span>}
            {estimatedRead && <span className={styles.readStripNote}>Your retailer estimated this read, so the next bill may correct the usage. The ranking holds; the dollars can move a little.</span>}
          </span>
          <button type="button" className={styles.readStripEdit} onClick={() => go("read")}>Check</button>
        </div>
      )}

      {!gasDataReady || !top || !bench ? (
        <div className={g.waiting}>
          <b>Gas prices are on their way.</b>
          <p>We&apos;ve saved your details on this device. Your result appears here as soon as today&apos;s gas prices are loaded. Meanwhile, the <Link href="/check">electricity check</Link> works now.</p>
        </div>
      ) : (
        <>
          {haveBill && !worth ? (
            <div className={`${styles.resultHero} ${styles.resultHeroGood}`}>
              <span className={styles.resultHeroKicker}>Based on your gas bill</span>
              <div className={styles.resultHeroLabel}>Good news</div>
              <div className={styles.resultHeroNum}>You&apos;re on a good gas deal</div>
              <div className={styles.resultHeroSub}>Nothing beats it by {money0(WORTH_SWITCHING_PER_YEAR)} a year or more. Plus members get told when that changes.</div>
            </div>
          ) : (
            <div className={`${styles.resultHero} ${haveBill ? styles.resultHeroBad : ""}`}>
              <span className={styles.resultHeroKicker}>{haveBill ? "Based on your gas bill" : fromEstimate ? (gasPick === "average" ? "For the average gas home, vs a typical gas plan" : "For a home like yours, vs a typical gas plan") : "Compared with a typical gas plan"}</span>
              <div className={styles.resultHeroLabel}>{haveBill ? "You could save about" : "The cheapest gas plan saves up to"}</div>
              <div className={styles.resultHeroNum}>{money0(Math.max(0, yearly))}</div>
              <div className={styles.resultHeroSub}>a year with {top.plan[0]}{haveBill ? ", vs your gas bill" : ". Add your gas charges for your own saving."}</div>
              <div className={styles.heroPlusRow}>
                <a href="#gas-plus" className={styles.resultHeroBtn} onClick={(e) => { e.preventDefault(); document.getElementById("gas-plus")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Keep this checked every day →</a>
                {RETAILER_LINKS[top.plan[0]] && <a href={RETAILER_LINKS[top.plan[0]]} data-plan={top.plan[2]} data-network={zone} data-fuel="G" target="_blank" rel="noopener noreferrer" className={styles.quietLink}>or see the plan on {top.plan[0]}&apos;s site ↗</a>}
              </div>
              <span className={styles.resultHeroFine}>{fromEstimate ? "Priced on a whole year of typical use for a home like yours. " : "From this bill, scaled to a year. Gas use swings with the seasons (a winter bill overstates it), so treat it as a guide. "}{PRICE_CHANGE_CLAUSE}</span>
            </div>
          )}

          <div className={styles.bestCard}>
            <span className={styles.bestTag}>{worth || !haveBill ? "Cheapest gas plan for you" : "Cheapest we found"}</span>
            {/* 7 Nov 2026 (Phil): the logo sits with the name; no sign-up terms or "get this plan" box, since that's the retailer's process. */}
            <div className={styles.retailerRow}><RetailerLogo name={top.plan[0]} size={44} /><div className={styles.retailer}>{top.plan[0]}</div></div>
            <div className={styles.plan}>{top.plan[2]}</div>
            <div className={styles.offerDateRow}><OfferDate retailer={top.plan[0]} plan={top.plan[2]} dark /></div>
            <div className={styles.nums}>
              <div className={styles.numBlock}>
                <div className={`${styles.v} mono`}>{money(top.total)}</div>
                <div className={styles.l}>for these {days} days</div>
              </div>
            </div>
            <p className={styles.saveLine}>
              {bench.value - top.total >= 0
                ? <><b>{money(bench.value - top.total)} less</b> than {bench.label} for the same gas</>
                : <><b>{money(top.total - bench.value)} more</b> than {bench.label}</>}
            </p>
            {RETAILER_LINKS[top.plan[0]] && (
              <a href={RETAILER_LINKS[top.plan[0]]} data-plan={top.plan[2]} data-network={zone} data-fuel="G" target="_blank" rel="noopener noreferrer" className={styles.quietLinkDark}>See the plan on {top.plan[0]}&apos;s site ↗</a>
            )}
          </div>

          {!haveBill && (
            <div className={g.tip}>
              <b>Want your own saving?</b> We compared with the middle of the market because we don&apos;t know what you pay{fromEstimate ? ", on typical use for a home like yours" : ""}. <button type="button" onClick={() => go("snap")}>Snap your gas bill</button> for the exact figure.
            </div>
          )}

          <RepeatNudge href="/pricing" fuel="gas" />
          <div className={g.member} id="gas-plus">
            <div>
              <b>Keep both bills watched</b>
              <span>Plus members get gas and electricity re-checked every morning, and an email only when switching saves {money0(WORTH_SWITCHING_PER_YEAR)}+ a year.</span>
            </div>
            <Link href="/pricing" className={g.memberBtn}>Join for {fmtPrice(listPriceNow("monthly"))} a month →</Link>
          </div>

          {(() => {
            const k = 365 / Math.max(1, days);
            const mjPerDay = mj / Math.max(1, days);
            const heatingShare = heatingShareFor(fromEstimate ? profile : null, mjPerDay);
            const annual = fromEstimate ? estimate.total : annualFromGasBill(mj, days, periodEnd, heatingShare);
            const months = fromEstimate ? gasByMonth(estimate) : monthsFromAnnual(annual, heatingShare);
            return (
              <>
                <GasPlanTable
                  ranked={ranked}
                  days={days}
                  mj={mj}
                  k={k}
                  you={bench.value}
                  youLabel={haveBill ? "Your bill" : "A typical plan"}
                  perLabel="a year"
                  zone={zone}
                  currentRetailer={retailer || null}
                  yourRates={haveBill ? yourRates : null}
                />
                <GasSeasonChart
                  heating={months.heating}
                  other={months.other}
                  highlight={fromEstimate ? [] : periodMonths(days, periodEnd)}
                  title={fromEstimate ? "A year of gas for a home like yours" : "Your gas through the year"}
                  note={fromEstimate
                    ? "Typical Melbourne-climate figures for a home like yours: the winter hump is heating, the flat part hot water and cooking."
                    : periodEnd
                      ? `Your bill's ${Math.round(mj).toLocaleString("en-AU")} MJ spread across a typical Victorian year (the outlined months are the ones it covered). Winter bills run well above the yearly average; summer ones well below.`
                      : `Your bill's ${Math.round(mj).toLocaleString("en-AU")} MJ over ${days} days, spread across a typical Victorian year. Winter bills run well above the yearly average; summer ones well below.`}
                />
              </>
            );
          })()}
        </>
      )}
    </>
  );
}

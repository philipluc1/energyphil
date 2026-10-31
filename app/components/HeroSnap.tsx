"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Icon from "./Icon";
import NbnNotify from "./NbnNotify";
import s from "./herosnap.module.css";

// The home page hook. The photo is the strong point, so the headline is about
// snapping a bill, the word "electricity" / "gas" turns over, and the three
// bills we cover sit in one card under it: pick one and the button follows.

type Fuel = "elec" | "gas" | "nbn";
const WORDS = ["electricity", "gas"];

export default function HeroSnap({ plans, retailers, gasPlans, gasRetailers }: { plans: number; retailers: number; gasPlans: number; gasRetailers: number }) {
  const [fuel, setFuel] = useState<Fuel>("elec");
  // -1 until the first tick: the word turns only once the page is up (and never under "reduce motion").
  const [word, setWord] = useState(-1);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2800);
    return () => clearInterval(t);
  }, []);
  // The fuel they picked wins over the turning word.
  const shownWord = fuel === "gas" ? "gas" : fuel === "nbn" ? "internet" : word < 0 ? "electricity" : WORDS[word];
  const idx = fuel === "elec" ? 0 : fuel === "gas" ? 1 : 2;

  return (
    <div className={s.wrap}>
      <p className={s.eyebrow}>Built from your bill</p>
      <h1 className={s.title}>
        Snap your <span className={s.word} aria-live="polite"><span key={shownWord} className={s.wordIn}>{shownWord}</span></span> bill.
        <br />
        <span className={s.titleLine2}>Stop overpaying.</span>
      </h1>
      <p className={s.lede}>
        Bills creeping up? One photo tells us what you really pay. We check it against {plans.toLocaleString("en-AU")} plans from {retailers} retailers, then keep checking every morning.
      </p>

      <div className={s.card} data-fuel={fuel}>
        <div className={s.cardHead}>
          <b>Which bill?</b>
          <span className={s.cardPill}>3 bills · one membership</span>
        </div>

        <div className={s.tiles} role="tablist" aria-label="Which bill" style={{ "--i": idx } as CSSProperties}>
          <span className={`${s.thumb} ${fuel === "elec" ? s.thumbElec : fuel === "gas" ? s.thumbGas : s.thumbNbn}`} aria-hidden="true" />
          <button type="button" role="tab" aria-selected={fuel === "elec"} className={`${s.tile} ${fuel === "elec" ? s.tileOn : ""}`} onClick={() => setFuel("elec")}>
            <span className={`${s.tileIcon} ${s.iElec}`}><Icon name="bolt" size={22} /></span>
            <b>Electricity</b>
            <span className={s.live}><i aria-hidden="true" /> Live</span>
            {fuel === "elec" && <span className={s.tick} aria-hidden="true"><Icon name="check" size={12} /></span>}
          </button>
          <button type="button" role="tab" aria-selected={fuel === "gas"} className={`${s.tile} ${fuel === "gas" ? s.tileOn : ""}`} onClick={() => setFuel("gas")}>
            <span className={`${s.tileIcon} ${s.iGas}`}><Icon name="flame" size={22} /></span>
            <b>Gas</b>
            <span className={s.live}><i aria-hidden="true" /> Live</span>
            {fuel === "gas" && <span className={s.tick} aria-hidden="true"><Icon name="check" size={12} /></span>}
          </button>
          <button type="button" role="tab" aria-selected={fuel === "nbn"} className={`${s.tile} ${fuel === "nbn" ? s.tileOn : ""}`} onClick={() => setFuel("nbn")}>
            <span className={`${s.tileIcon} ${s.iNbn}`}><Icon name="wifi" size={22} /></span>
            <b>Internet</b>
            <span className={s.soon}>Coming</span>
            {fuel === "nbn" && <span className={s.tick} aria-hidden="true"><Icon name="check" size={12} /></span>}
          </button>
        </div>

        <p key={fuel} className={s.detail} aria-live="polite">
          {fuel === "elec" && <><b>{plans.toLocaleString("en-AU")} plans from {retailers} retailers</b>, priced on your real usage. Snap → read in about 30 seconds → your cheapest plan.</>}
          {fuel === "gas" && <>{gasPlans > 0 ? <><b>{gasPlans.toLocaleString("en-AU")} gas plans from {gasRetailers} retailers.</b> </> : null}Gas-only or dual-fuel bills both work. Victoria has no default offer for gas, so your own bill is the yardstick.</>}
          {fuel === "nbn" && <><b>Being built.</b> Snap your internet bill, we check the speed tier you&apos;re on against every provider, and warn you before a promo rolls off. Plus members get it first, at no extra cost.</>}
        </p>

        {fuel === "nbn" ? (
          <div className={s.nbnRow}><NbnNotify /></div>
        ) : (
          <div className={s.actions}>
            <Link href={fuel === "gas" ? "/gas" : "/check"} className={s.primary}>
              <span className={s.shutter} aria-hidden="true"><Icon name="camera" size={22} /></span>
              <span key={fuel} className={s.ctaText}>Snap my {fuel === "gas" ? "gas" : "electricity"} bill</span>
              <span className={s.ctaArrow} aria-hidden="true">→</span>
            </Link>
            <Link href={fuel === "gas" ? "/gas" : "/check?start=questions"} className={s.secondary}>No bill handy? Use the average home</Link>
          </div>
        )}
        <p className={s.fine}>
          {fuel === "nbn"
            ? "Electricity and gas are live today. Internet joins the same Utilo Plus when it opens, at no extra cost."
            : <>Free, no sign-up, about a minute. Paper bill, PDF or a screenshot from your retailer&apos;s app.</>}
        </p>
      </div>
    </div>
  );
}

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

      <div className={s.steps} aria-hidden="true">
        <span className={s.step} style={{ "--n": 0 } as CSSProperties}><i><Icon name="camera" size={14} /></i> Snap</span>
        <span className={s.stepArrow}>→</span>
        <span className={s.step} style={{ "--n": 1 } as CSSProperties}><i><Icon name="check" size={14} /></i> Read in ~30s</span>
        <span className={s.stepArrow}>→</span>
        <span className={s.step} style={{ "--n": 2 } as CSSProperties}><i><Icon name="dollar" size={14} /></i> Cheapest plan</span>
      </div>

      <div className={s.card}>
        <div className={s.cardHead}>
          <b>Which bill?</b>
          <span>One membership covers all of them.</span>
        </div>
        <div className={s.tiles} role="tablist" aria-label="Which bill" style={{ "--i": idx } as CSSProperties}>
          <span className={s.thumb} aria-hidden="true" />
          <button type="button" role="tab" aria-selected={fuel === "elec"} className={`${s.tile} ${fuel === "elec" ? s.tileOn : ""}`} onClick={() => setFuel("elec")}>
            <span className={`${s.tileIcon} ${s.iElec}`}><Icon name="bolt" size={20} /></span>
            <span className={s.tileText}><b>Electricity</b><small>{plans.toLocaleString("en-AU")} plans · {retailers} retailers</small></span>
            <span className={s.live}><i aria-hidden="true" /> Live</span>
          </button>
          <button type="button" role="tab" aria-selected={fuel === "gas"} className={`${s.tile} ${fuel === "gas" ? s.tileOn : ""}`} onClick={() => setFuel("gas")}>
            <span className={`${s.tileIcon} ${s.iGas}`}><Icon name="flame" size={20} /></span>
            <span className={s.tileText}><b>Gas</b><small>{gasPlans > 0 ? `${gasPlans.toLocaleString("en-AU")} plans · ${gasRetailers} retailers` : "Dual-fuel bills work too"}</small></span>
            <span className={s.live}><i aria-hidden="true" /> Live</span>
          </button>
          <button type="button" role="tab" aria-selected={fuel === "nbn"} className={`${s.tile} ${fuel === "nbn" ? s.tileOn : ""}`} onClick={() => setFuel("nbn")}>
            <span className={`${s.tileIcon} ${s.iNbn}`}><Icon name="wifi" size={20} /></span>
            <span className={s.tileText}><b>Internet (NBN)</b><small>Speed tier vs every provider</small></span>
            <span className={s.soon}>Coming</span>
          </button>
        </div>

        {fuel === "nbn" ? (
          <div className={s.nbnRow}>
            <p>Internet checks are being built. Members get them first, at no extra cost.</p>
            <NbnNotify />
          </div>
        ) : (
          <div className={s.actions}>
            <Link href={fuel === "gas" ? "/gas" : "/check"} className={s.primary}>
              <span className={s.shutter} aria-hidden="true"><Icon name="camera" size={20} /></span>
              <span key={fuel} className={s.ctaText}>Snap my {fuel === "gas" ? "gas" : "electricity"} bill</span>
            </Link>
            <Link href={fuel === "gas" ? "/gas" : "/check?start=questions"} className={s.secondary}>No bill? Estimate it</Link>
          </div>
        )}
        <p className={s.fine}>Free, no sign-up, about a minute. Paper bill, PDF or a screenshot from your retailer&apos;s app.</p>
      </div>
    </div>
  );
}

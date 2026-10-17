"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import styles from "./EnergyTips.module.css";

// Written energy-saving guidance for the account portal. Kept deliberately
// general (no invented savings percentages) so nothing here could be read as
// a guarantee.
export interface EnergyTip {
  title: string;
  body: string;
  icon: string;
}

export const ENERGY_TIPS: EnergyTip[] = [
  { title: "Check your plan each month", body: "The plan itself is usually the biggest saving. Upload your latest bill.", icon: "refresh" },
  { title: "Use off-peak hours", body: "Run the dishwasher, washer or EV charger outside the evening peak.", icon: "moon" },
  { title: "Set heating and cooling sensibly", body: "Around 18–20°C in winter and 25–26°C in summer.", icon: "snow" },
  { title: "Seal draughts", body: "Door seals and closing off unused rooms cut heating and cooling.", icon: "home" },
  { title: "Switch off standby", body: "Turn TVs, consoles and chargers off at the wall.", icon: "power" },
  { title: "Full loads, cold wash", body: "Fewer cycles, and no energy spent heating wash water.", icon: "waves" },
  { title: "Solar? Use it by day", body: "Run appliances in daylight to use your own power first.", icon: "sun" },
  { title: "LEDs, and a fridge at 3–4°C", body: "LEDs use a fraction of old bulbs; a colder fridge wastes power.", icon: "bulb" },
];

const STEP_MS = 6500;

/** One tip at a time: slides on by itself, pauses while you hover or focus it,
 *  and has arrows and dots to move through by hand. */
export function TipCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const set = () => setReduced(mq.matches);
    const t = setTimeout(set, 0);
    mq.addEventListener?.("change", set);
    return () => { clearTimeout(t); mq.removeEventListener?.("change", set); };
  }, []);
  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => setI((n) => (n + 1) % ENERGY_TIPS.length), STEP_MS);
    return () => clearTimeout(t);
  }, [i, paused, reduced]);
  const tip = ENERGY_TIPS[i];
  const go = (n: number) => setI((n + ENERGY_TIPS.length) % ENERGY_TIPS.length);

  return (
    <section
      className={styles.carousel}
      aria-roledescription="carousel"
      aria-label="Ways to use less energy"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={styles.carHead}>
        <span className={styles.carKicker}>Ways to use less energy</span>
        <span className={styles.carCount}>{i + 1} / {ENERGY_TIPS.length}</span>
      </div>
      <div key={i} className={styles.slide} aria-live="polite">
        <span className={styles.slideIcon}><Icon name={tip.icon} size={28} /></span>
        <b className={styles.slideTitle}>{tip.title}</b>
        <p className={styles.slideBody}>{tip.body}</p>
      </div>
      <div className={styles.progress} aria-hidden="true">
        <span key={`${i}-${paused}-${reduced}`} className={paused || reduced ? styles.barStill : styles.bar} style={{ animationDuration: `${STEP_MS}ms` }} />
      </div>
      <div className={styles.carNav}>
        <button type="button" onClick={() => go(i - 1)} aria-label="Previous tip">←</button>
        <div className={styles.dots}>
          {ENERGY_TIPS.map((t, n) => (
            <button key={t.title} type="button" className={n === i ? styles.dotOn : styles.dot} onClick={() => go(n)} aria-label={`Tip ${n + 1}: ${t.title}`} />
          ))}
        </div>
        <button type="button" onClick={() => go(i + 1)} aria-label="Next tip">→</button>
      </div>
    </section>
  );
}

/** The full list, for anyone who'd rather read them all. */
export default function EnergyTips() {
  return (
    <details className={styles.tipsBox}>
      <summary className={styles.tipsHead}>
        <span className={styles.tipsIcon}>
          <Icon name="bulb" size={20} />
        </span>
        <div>
          <div className={styles.tipsTitle}>Ways to use less energy</div>
          <p className={styles.tipsSub}>{ENERGY_TIPS.length} quick tips</p>
        </div>
      </summary>
      <div className={styles.tipsGrid}>
        {ENERGY_TIPS.map((tip) => (
          <div className={styles.tipCard} key={tip.title}>
            <div className={styles.tipTitle}>{tip.title}</div>
            <p className={styles.tipBody}>{tip.body}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

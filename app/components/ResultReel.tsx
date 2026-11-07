"use client";

import ReelPlayer from "./ReelPlayer";
import { REELS } from "@/lib/reels";
import styles from "./resultreel.module.css";

/** Free result (7 Nov 2026): the "we check every morning" reel beside the Plus pitch. */
export default function ResultReel({ onJoin, retailer }: { onJoin: () => void; retailer?: string | null }) {
  const reel = REELS.find((r) => r.id === "daily") ?? REELS[0];
  return (
    <section className={styles.band} aria-labelledby="result-reel-title">
      <div className={styles.phone}><ReelPlayer reel={reel} /></div>
      <div className={styles.copy}>
        <p className={styles.kicker}>We check this every day</p>
        <h2 id="result-reel-title">Today&apos;s cheapest won&apos;t be next week&apos;s.</h2>
        <p>Retailers change offers every week and discounts quietly end. Utilo Plus re-checks {retailer ? `your ${retailer} bill` : "your bill"} against every plan each morning and emails you only when switching pays. You decide; we never switch you.</p>
        <button type="button" className={styles.btn} onClick={onJoin}>Keep this checked every day →</button>
      </div>
    </section>
  );
}

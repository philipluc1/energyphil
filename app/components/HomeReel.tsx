"use client";

import Link from "next/link";
import { useState } from "react";
import ReelPlayer from "./ReelPlayer";
import { REELS } from "@/lib/reels";
import styles from "./homereel.module.css";

/**
 * Home page (7 Nov 2026): the "Snap, check, save" reel beside three lines on
 * how Utilo works. 8 Nov: no stand-in clip. Until the reel file is on the site
 * the band is the three lines alone.
 */
export default function HomeReel() {
  const reel = REELS[0];
  const [noReel, setNoReel] = useState(false);
  return (
    <section className={`${styles.band} ${noReel ? styles.textOnly : ""}`} data-motion="">
      {!noReel && <div className={styles.phone}><ReelPlayer reel={reel} fallback="none" onUnavailable={() => setNoReel(true)} /></div>}
      <div className={styles.copy}>
        <p className={styles.kicker}>Watch how it works</p>
        <h2>Snap your bill. We do the rest.</h2>
        <ul>
          <li><b>1</b> Take a photo of your power or gas bill.</li>
          <li><b>2</b> We price every plan on your own usage and rates.</li>
          <li><b>3</b> Utilo Plus re-checks it every morning and emails you the day a plan beats it.</li>
        </ul>
        <div className={styles.actions}>
          <Link href="/check" className={styles.primary}>Snap my bill, free</Link>
          <Link href="/pricing" className={styles.secondary}>See Utilo Plus →</Link>
        </div>
      </div>
    </section>
  );
}

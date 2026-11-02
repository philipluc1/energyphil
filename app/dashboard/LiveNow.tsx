"use client";

import { useEffect, useState } from "react";
import { pageLabel } from "@/lib/visits";
import styles from "./dashboard.module.css";

type Live = { ok: boolean; count?: number; pages?: { path: string; n: number }[]; message?: string };

/** "On the site now": everyone with a tab open in the last two minutes, refreshed every 15 seconds. */
export default function LiveNow({ initial }: { initial: Live }) {
  const [live, setLive] = useState<Live>(initial);
  const [at, setAt] = useState<string>("");
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await fetch("/api/admin/live", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (!stop && r) {
        setLive(r);
        setAt(new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit" }));
      }
    };
    const t = window.setInterval(load, 15_000);
    return () => { stop = true; window.clearInterval(t); };
  }, []);

  return (
    <div className={`${styles.statCard} ${styles.liveCard}`}>
      <div className={styles.liveTop}>
        <span className={`${styles.liveDot} ${live.count ? styles.liveDotOn : ""}`} aria-hidden="true" />
        <div className={styles.statValue}>{live.ok ? live.count ?? 0 : "–"}</div>
      </div>
      <div className={styles.statLabel}>
        {live.ok ? <>On the site now{at ? <> · updated {at}</> : <> · updates every 15s</>}</> : live.message ?? "Couldn't load"}
      </div>
      {live.ok && live.pages && live.pages.length > 0 && (
        <ul className={styles.livePages}>
          {live.pages.map((p) => <li key={p.path}><span>{pageLabel(p.path)}</span><b>{p.n}</b></li>)}
        </ul>
      )}
    </div>
  );
}

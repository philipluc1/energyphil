"use client";

import Link from "next/link";
import FunEquivalents from "./FunEquivalents";
import styles from "./latestcheck.module.css";

export interface LatestCheck {
  savedAt: string; distributor: string; days: number; haveBill: boolean; bench: number;
  bestRetailer: string; bestPlan: string; bestTotal: number; source: "answers" | "bill" | "manual";
}

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The free check's result, shown on the dashboard. Green when the person's
 *  own bill already beats the cheapest plan, red when they're overpaying,
 *  teal when it's only an estimate against the default offer. */
export default function LatestCheckCard({ c, member }: { c: LatestCheck; member: boolean }) {
  const saving = c.bench - c.bestTotal;
  const yearly = (saving / Math.max(1, c.days)) * 365;
  const verdict = c.haveBill ? (saving <= 1 ? "good" : "bad") : "estimate";
  const max = Math.max(c.bench, c.bestTotal, 1);
  const when = new Date(c.savedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return (
    <div className={`${styles.card} ${styles[verdict]}`}>
      <div className={styles.head}>
        <span className={styles.kicker}>
          {verdict === "good" ? "You're on a good deal" : verdict === "bad" ? "You're paying more than you need to" : "Your latest check (estimate)"}
        </span>
        <span className={styles.when}>{when} · {c.distributor}</span>
      </div>
      {verdict !== "good" && (
        <div className={styles.big}>
          {money(Math.max(0, Math.round(yearly)))} <span>a year with {c.bestRetailer}</span>
        </div>
      )}
      <div className={styles.bars}>
        <div className={styles.row}>
          <span>{c.haveBill ? "Your bill" : "Default offer"}</span>
          <div className={styles.track}><div className={`${styles.bar} ${styles.barRef}`} style={{ width: `${(c.bench / max) * 100}%` }} /></div>
          <b>{money(c.bench)}</b>
        </div>
        <div className={styles.row}>
          <span>{c.bestRetailer}</span>
          <div className={styles.track}><div className={`${styles.bar} ${styles.barBest}`} style={{ width: `${(c.bestTotal / max) * 100}%` }} /></div>
          <b>{money(c.bestTotal)}</b>
        </div>
      </div>
      <p className={styles.note}>
        {c.bestRetailer} — {c.bestPlan}, for {c.days} days.
        {verdict === "estimate" && " Prices are exact; your usage is a typical figure. Upload your bill for real numbers."}
      </p>
      {verdict === "bad" && yearly > 0 && <FunEquivalents dollars={yearly} dark />}
      <div className={styles.actions}>
        <Link href="/check" className={styles.btnGhost}>Run it again</Link>
        {!member && <Link href="/pricing" className={styles.btn}>Join to get this checked every month →</Link>}
      </div>
    </div>
  );
}

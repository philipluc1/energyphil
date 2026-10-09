import Link from "next/link";
import { TIMELINE } from "@/lib/learnContent";
import styles from "./learncard.module.css";

/** Learn, inside the dashboard: the next price event and quick links. */
export default function LearnCard() {
  const next = TIMELINE.find((t) => t.status === "expected");
  return (
    <div className={styles.card}>
      <div className={styles.title}>Learn</div>
      {next && (
        <p className={styles.next}>
          <b>Next price event:</b> {next.title}, {next.when.replace(/^About /, "about ")}. {next.detail}
        </p>
      )}
      <div className={styles.links}>
        <Link href="/learn#charts">Price trends</Link>
        <Link href="/learn#timeline">When prices change</Link>
        <Link href="/learn#save">Ways to save</Link>
        <Link href="/learn#compare">Utilo vs VEC &amp; ESC</Link>
        <Link href="/ev">EV charging cost</Link>
        <Link href="/gas">Gas check</Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import { marketEvents } from "@/lib/marketActivity";
import Icon from "./Icon";
import s from "./feelingcard.module.css";

/**
 * "Sound familiar?" A short card that meets people where they are (the bill
 * keeps going up and they don't know why), with an illustration, not data:
 * it's labelled as such, since prices don't rise for everyone every year.
 * The one number on it is real: offer changes in the last 30 days.
 */
export default function FeelingCard() {
  const changes = marketEvents({ days: 30 }).length;
  return (
    <section className={s.card} aria-labelledby="feeling-title">
      <div className={s.text}>
        <p className={s.eyebrow}>Sound familiar?</p>
        <h2 id="feeling-title" className={s.title}>Bill keeps creeping up, and you don&apos;t know why or where to start?</h2>
        <p className={s.body}>
          It&apos;s not just you: {changes > 0 ? <>retailers changed {changes.toLocaleString("en-AU")} offers in the last 30 days.</> : <>retailers change their offers all year.</>}
          <br />
          One photo of your bill shows what you really pay.
        </p>
        <Link href="/check" className={s.cta}><Icon name="camera" size={18} /> Price my bill, free</Link>
      </div>
      <div className={s.art}>
        <span className={s.artLabel}>Illustration</span>
        <div className={s.bars} role="img" aria-label="Illustration: the same bill getting bigger three times in a row">
          <span className={s.bar}><i style={{ height: "56%" }} /><em>Then</em></span>
          <span className={s.bar}><i style={{ height: "74%" }} /><em>Later</em></span>
          <span className={`${s.bar} ${s.barNow}`}><i style={{ height: "100%" }} /><em>Now</em></span>
        </div>
        <p className={s.artNote}>Same house. Same habits. <b>Why is it dearer?</b> Often a discount ended or the plan was repriced.</p>
      </div>
    </section>
  );
}

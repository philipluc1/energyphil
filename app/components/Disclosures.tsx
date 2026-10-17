import Link from "next/link";
import { GENERAL_DISCLOSURES, RECEIVES_RETAILER_FEES, independenceLine } from "@/lib/disclosures";
import s from "./disclosures.module.css";

/** "Important information" under results and on the dashboard. */
export default function Disclosures({ priceDate }: { priceDate?: string }) {
  return (
    <section className={s.box} aria-labelledby="disclosures-title">
      <h3 id="disclosures-title" className={s.title}>Important information</h3>
      <p className={s.lead}>
        {RECEIVES_RETAILER_FEES ? "" : "Utilo is independent. "}
        {independenceLine()}
        {priceDate ? ` Prices last checked ${priceDate}.` : ""}
      </p>
      <dl className={s.grid}>
        {GENERAL_DISCLOSURES.map((d) => (
          <div key={d.title} className={s.item}>
            <dt>{d.title}</dt>
            <dd>{d.body}</dd>
          </div>
        ))}
      </dl>
      <p className={s.more}>
        More in our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </section>
  );
}

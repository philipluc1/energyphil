import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import JoinDirect from "../components/JoinDirect";
import PlanBand from "../components/PlanBand";
import SiteHeader from "../components/SiteHeader";
import Icon from "../components/Icon";
import InfoTip from "../components/InfoTip";
import { PLUS_NAME, plusValue } from "@/lib/pricingPlans";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import styles from "../components/Comparator.module.css";
import h from "../home3.module.css";
import p from "./pricing.module.css";

export const metadata = pageMeta({ title: "Utilo Plus: $7 a month or $39 a year", description: "The bill check is free. Utilo Plus re-prices every plan against your home each morning and emails you only when switching is worth it.", path: "/pricing" });

// Free check vs Plus, one line each. Detail lives in the (i) pop-ups.
const ROWS: { label: string; free: boolean | string; plus: boolean | string; tip?: string }[] = [
  { label: "Your saving, from a photo of your bill", free: true, plus: true },
  { label: "The two cheapest plans by name", free: false, plus: true },
  { label: "Every plan re-checked every morning", free: false, plus: true, tip: "Each day's new and updated offers, priced against the usage on your bill. You don't lift a finger." },
  { label: `An email when switching saves $${WORTH_SWITCHING_PER_YEAR}+`, free: false, plus: true, tip: "Silence otherwise. You can set your own amount on your dashboard." },
  { label: "A month's warning before a discount ends", free: false, plus: true },
  { label: "Dashboard, bill history and savings tally", free: false, plus: true },
  { label: "Electricity and gas", free: true, plus: true },
];

function Mark({ v }: { v: boolean | string }) {
  if (v === true) return <span className={p.yes} aria-label="Included"><Icon name="check" size={16} /></span>;
  if (v === false) return <span className={p.no} aria-label="Not included">–</span>;
  return <span>{v}</span>;
}

export default function PricingPage() {
  const v = plusValue();
  return (
    <>
      <SiteHeader active="pricing" />
      <main className={h.page}>
        <section className={p.hero}>
          <span className={h.kicker}><Icon name="bolt" size={14} /> {PLUS_NAME}</span>
          <h1 className={p.h1}>We check. You save.</h1>
          <p className={h.lede}>Every plan, priced against your bill, every morning. One email when it&apos;s worth switching.</p>
          <div className={p.value}>
            <div className={p.vBox}><b>{v.monthly}</b><span>a month</span></div>
            <span className={p.vEq}>=</span>
            <div className={p.vBox}><b>{v.monthlyYear}</b><span>a year</span></div>
            <span className={p.vOr}>or</span>
            <div className={`${p.vBox} ${p.vBest}`}><b>{v.annual}</b><span>a year, save {v.save}</span></div>
          </div>
        </section>

        <section className={p.compare} aria-label="Free check compared with Utilo Plus" data-motion="" data-stagger=":scope > div">
          <div className={p.cHead}>
            <span />
            <span>Free check</span>
            <span className={p.cPlus}>{PLUS_NAME}</span>
          </div>
          {ROWS.map((r) => (
            <div key={r.label} className={p.cRow}>
              <span className={p.cLabel}>
                {r.label}
                {r.tip && <InfoTip label={`About: ${r.label}`}>{r.tip}</InfoTip>}
              </span>
              <span className={p.cCell}><Mark v={r.free} /></span>
              <span className={`${p.cCell} ${p.cPlusCell}`}><Mark v={r.plus} /></span>
            </div>
          ))}
        </section>

        <PlanBand title="Pick how you pay" intro={<>Same {PLUS_NAME} either way. Yearly keeps {v.save} in your pocket.</>} cards={<JoinDirect />} />

        <section className={h.section} data-motion="" data-stagger="details">
          <div className={h.faq}>
            <details>
              <summary>What happens after I pay?</summary>
              <p>You snap your bill on the next screen and your dashboard sets itself up from it. From then on we check every morning.</p>
            </details>
            <details>
              <summary>Can I cancel?</summary>
              <p>Any time, from your dashboard. <Link href="/cancellation-policy">Cancellation policy</Link></p>
            </details>
            <details>
              <summary>Rather try the free check first?</summary>
              <p><Link href="/check">Run it here</Link>. You can join from the result.</p>
            </details>
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            <Link href="/faq">FAQ</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/cancellation-policy">Cancellation</Link> · <Link href="/terms">Terms</Link>
          </p>
        </footer>
      </main>
    </>
  );
}

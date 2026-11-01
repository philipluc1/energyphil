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

export const metadata = pageMeta({ title: "Utilo Plus: $7 a month or $39 a year", description: "The bill check is free, with every plan by name. Utilo Plus keeps watching: every plan re-priced against your bill each morning, a warning before your discount ends, and an email only when switching is worth it.", path: "/pricing" });

// Free check vs Plus, one line each. Detail lives in the (i) pop-ups.
// "On your own": what it takes without Utilo (the free government and
// retailer sites, by hand). Short words only: they sit in a narrow column on phones.
const ROWS: { label: string; own: false | string; free: boolean | string; plus: boolean | string; tip?: string }[] = [
  { label: "Your saving, from a photo of your bill", own: "Type it in", free: true, plus: true },
  { label: "Every plan by name, with rates", own: "Search sites", free: true, plus: true },
  { label: "Your result by email", own: false, free: true, plus: true },
  { label: "Every plan re-checked every morning", own: "By hand", free: false, plus: true, tip: "Each day's new and updated offers, priced against the usage and rates on your bill. You don't lift a finger." },
  { label: `An email when switching saves $${WORTH_SWITCHING_PER_YEAR}+`, own: false, free: false, plus: true, tip: "Silence otherwise. You can set your own amount on your dashboard." },
  { label: "A month's warning before a discount ends", own: "Diary it", free: false, plus: true, tip: "Most discounts end after a year, and the price usually jumps. We count down and warn you while there's time to move." },
  { label: "A monthly summary of your bill and the market", own: false, free: false, plus: true },
  { label: "Dashboard: your year ahead, bill history, savings tally", own: false, free: false, plus: true },
  { label: "Gas watched too, same membership", own: "Separately", free: false, plus: true, tip: "The free gas check works for anyone. Plus re-checks your gas bill every morning as well." },
];

function Mark({ v }: { v: boolean | string }) {
  if (v === true) return <span className={p.yes} aria-label="Included"><Icon name="check" size={16} /></span>;
  if (v === false) return <span className={p.no} aria-label="Not included">–</span>;
  return <span className={p.part}>{v}</span>;
}

export default function PricingPage() {
  const v = plusValue();
  return (
    <>
      <SiteHeader active="pricing" />
      <main className={h.page}>
        <section className={p.hero}>
          <span className={h.kicker}><Icon name="bolt" size={14} /> {PLUS_NAME}</span>
          <h1 className={p.h1}>We keep watching.</h1>
          <p className={h.lede}>The free check gives you today&apos;s answer, every plan by name. {PLUS_NAME} re-checks your bill every morning and warns you before your discount ends.</p>
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
            <span className={p.cOwn}>On your own</span>
            <span>Free check</span>
            <span className={p.cPlus}>{PLUS_NAME}</span>
          </div>
          {ROWS.map((r) => (
            <div key={r.label} className={p.cRow}>
              <span className={p.cLabel}>
                {r.label}
                {r.tip && <InfoTip label={`About: ${r.label}`}>{r.tip}</InfoTip>}
              </span>
              <span className={`${p.cCell} ${p.cOwnCell}`}><Mark v={r.own} /></span>
              <span className={p.cCell}><Mark v={r.free} /></span>
              <span className={`${p.cCell} ${p.cPlusCell}`}><Mark v={r.plus} /></span>
            </div>
          ))}
          <p className={p.cFoot}>On your own: the free government and retailer sites, done by hand whenever you remember to.</p>
        </section>

        <PlanBand gets={false} title="Pick how you pay" intro={<>Same {PLUS_NAME} either way. Yearly keeps {v.save} in your pocket.</>} cards={<JoinDirect />} />

        <section className={h.section} data-motion="" data-stagger="details">
          <div className={h.faq}>
            <details>
              <summary>Why pay if the check is free?</summary>
              <p>Because today&apos;s cheapest plan rarely stays cheapest. Retailers update offers every week, most discounts end after a year, and 1 July resets prices. The money usually goes quietly, months after you switch. {PLUS_NAME} watches for that, so you don&apos;t have to.</p>
            </details>
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

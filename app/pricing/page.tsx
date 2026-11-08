import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import JoinDirect from "../components/JoinDirect";
import PlanBand from "../components/PlanBand";
import SiteHeader from "../components/SiteHeader";
import Icon from "../components/Icon";
import InfoTip from "../components/InfoTip";
import { PLUS_NAME, plusValue, FOUNDING_OFFER, SPECIAL_NAME, foundingLine, regularPrice, fmtPrice, perWeekWords } from "@/lib/pricingPlans";

// Re-built every hour, so the New Year special ends on time without a deploy.
export const revalidate = 3600;
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import h from "../home3.module.css";
import p from "./pricing.module.css";
import SiteFooter from "../components/SiteFooter";

export const metadata = pageMeta({ title: `Utilo Plus: ${plusValue().monthly} a month or ${plusValue().annual} a year`, description: "The bill check is free. Utilo Plus re-prices every plan against your bill each morning and emails you only when switching is worth it.", path: "/pricing" });

// Free check vs Plus, one line each. Detail lives in the (i) pop-ups.
// "On your own": the free government and retailer sites, by hand. Ticks and
// dashes only (7 Nov 2026): the words made the column busy on phones.
const ROWS: { label: string; short: string; own: boolean | string; free: boolean | string; plus: boolean | string; tip?: string }[] = [
  { label: "Instant email results", short: "Instant email results", own: false, free: true, plus: true, tip: "Snap your bill, get your result on the spot and a copy by email. Your first photo is free, then one free electricity and one free gas photo every 3 months. Plus: unlimited." },
  { label: "Re-checked every morning", short: "Re-checked every morning", own: true, free: false, plus: true, tip: "Each day's new and updated offers, priced against the usage and rates on your bill. You don't lift a finger." },
  { label: `Email when you can save $${WORTH_SWITCHING_PER_YEAR}+`, short: `Email when you can save $${WORTH_SWITCHING_PER_YEAR}+`, own: false, free: false, plus: true, tip: "Quiet means you're fine. We only email when a plan beats yours by that much a year. You can set your own amount on your dashboard." },
  { label: "Live retailer changes", short: "Live retailer changes", own: true, free: false, plus: true, tip: "Every new offer, price change and discount ending, as it happens, and a month's warning before your own discount ends." },
  { label: "Billing and analytics", short: "Billing and analytics", own: false, free: false, plus: true, tip: "Your bill in plain English, why each bill went up or down (in dollars), bill history, your year ahead, usage through the day and solar." },
  { label: "Monthly savings", short: "Monthly savings", own: false, free: false, plus: true, tip: "A monthly summary of your bill, what you've saved and what moved in the market." },
  { label: "Power and gas", short: "Power and gas", own: true, free: true, plus: true, tip: "The free check works for either. Plus watches both on the one membership." },
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
          <h1 className={p.h1}>Stop paying the loyalty tax.</h1>
          <p className={h.lede}>Discounts quietly end. Prices change every 1 July. People who stay put often pay more. {PLUS_NAME} watches your power and gas every day, from your own bill, and tells you when to move, and when not to bother.</p>
          <div className={p.value}>
            <div className={`${p.vBox} ${p.vBest}`}><b>{regularPrice("annual") ? <s className={p.was}>{fmtPrice(regularPrice("annual")!)}</s> : null}{v.annual}</b><span>a year{FOUNDING_OFFER ? `, ${SPECIAL_NAME}` : ""}</span></div>
            <span className={p.vEq}>=</span>
            <div className={p.vBox}><b>{v.perWeek}</b><span>a week</span></div>
            <span className={p.vOr}>or</span>
            <div className={p.vBox}><b>{regularPrice("monthly") ? <s className={p.was}>{fmtPrice(regularPrice("monthly")!)}</s> : null}{v.monthly}</b><span>month to month</span></div>
          </div>
          {FOUNDING_OFFER && <p className={p.founding}>{foundingLine()} Cancel any time from your dashboard.</p>}
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
                <span className={p.cLong}>{r.label}</span>
                <span className={p.cShort}>{r.short}</span>
                {r.tip && <InfoTip label={`About: ${r.label}`}>{r.tip}</InfoTip>}
              </span>
              <span className={`${p.cCell} ${p.cOwnCell}`}><Mark v={r.own} /></span>
              <span className={p.cCell}><Mark v={r.free} /></span>
              <span className={`${p.cCell} ${p.cPlusCell}`}><Mark v={r.plus} /></span>
            </div>
          ))}
          <p className={p.quiet}><Icon name="check" size={16} /> <span><b>We email when you can save ${WORTH_SWITCHING_PER_YEAR} or more. Quiet means you&apos;re fine.</b> Most people only switch for $50 a year or more, so that&apos;s where we set the line. Change it any time.</span></p>
          <p className={p.cFoot}>On your own: the free government and retailer sites, done by hand whenever you remember to.</p>
        </section>

        <PlanBand gets={false} title="One membership, every bill we watch" intro={<>Power and gas now, more to come. {perWeekWords().replace(/^u/, "U")}, paid yearly.</>} cards={<JoinDirect />} />

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

        <SiteFooter />
      </main>
    </>
  );
}

import Link from "next/link";
import PlanCards from "../components/PlanCards";
import PlanBand from "../components/PlanBand";
import Tag from "../components/Tag";
import MarketPulse from "../components/MarketPulse";
import SiteHeader from "../components/SiteHeader";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";

export const metadata = { title: "Pricing | Utilo" };

export default function PricingPage() {
  return (
    <>
      <SiteHeader active="pricing" />
      <div className={styles.wrap}>
        <section className={home.pageHead}>
          <Tag tone="amber">Cancel any time</Tag>
          <h1>Never chase an energy deal again. $7 a month.</h1>
          <p className={styles.lede}>
            Or $39 a year, less than $1 a week. Offers change every week. New plans, price changes, discounts with conditions, plans with the same
            name: you don&apos;t need to follow any of it. Members&apos;
            homes are re-priced against every plan every morning, with an email only when switching is worth it, a check every month, a running
            tally of what you&apos;ve saved, and bill reading from a photo or PDF. The check itself is always free, for electricity and gas.
          </p>
          <MarketPulse />
        </section>
        <PlanBand
          title="Electricity and gas, re-checked every morning"
          intro={<>Same checking either way. Yearly works out at $3.25 a month; monthly lets you try it first.</>}
          cards={<PlanCards href="/check" cta="Start free check" dark />}
        />
        <p className={home.dataNote}>
          Joining happens right after your free check, so we can match you to the right plan.{" "}
          <Link href="/cancellation-policy">Cancellation policy</Link>
        </p>
        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            <Link href="/">Home</Link> · <Link href="/faq">FAQ</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/cancellation-policy">Cancellation</Link> · <Link href="/terms">Terms</Link>
          </p>
        </footer>
      </div>
    </>
  );
}

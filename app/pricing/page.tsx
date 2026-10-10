import Link from "next/link";
import PlanCards from "../components/PlanCards";
import PlanBand from "../components/PlanBand";
import Tag from "../components/Tag";
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
          <Tag tone="amber" shine>Cancel any time</Tag>
          <h1>Keep an eye on it for $39 a year.</h1>
          <p className={styles.lede}>
            The check is always free, for electricity and gas. Members get a check every month, an email when something cheaper appears,
            a running tally of what you&apos;ve saved, and bill reading from a photo or PDF.
          </p>
        </section>
        <PlanBand
          title="One membership. Electricity and gas. Checked every morning."
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

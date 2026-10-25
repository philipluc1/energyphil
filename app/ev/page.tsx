import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { evNetworkRates } from "@/lib/evCalc";
import SiteHeader from "../components/SiteHeader";
import Tag from "../components/Tag";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";
import EvCalculator from "./EvCalculator";

// Kept out of search until the plan data has overnight rates to show.
export function generateMetadata() {
  const m = pageMeta({ title: "EV charging costs in Victoria", description: "What a full charge costs on your Victorian power network, and how much a cheaper overnight rate could save.", path: "/ev" });
  return evNetworkRates().length > 0 ? m : { ...m, robots: { index: false, follow: true } };
}

export default function EvPage() {
  const rates = evNetworkRates();
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={home.pageHead}>
          <Tag tone="green">New</Tag>
          <h1>What does a charge cost you?</h1>
          <p className={styles.lede}>Pick your car, your network and how far you drive. See the cost per charge, per 100 km and per year, and what a cheap overnight rate could save.</p>
        </section>
        {rates.length > 0 ? (
          <EvCalculator rates={rates} />
        ) : (
          <section className={styles.sectionGap}>
            <p className={styles.lede}>
              Today&apos;s plan data has no retailer plans with a separate overnight rate, so we can&apos;t price overnight charging yet. Your whole-bill
              check below still compares every plan we track for your usage, car charging included.
            </p>
          </section>
        )}
        <section className={styles.sectionGap}>
          <Link href="/check" className={styles.heroCta}>Check my whole bill</Link>
        </section>
        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            <Link href="/">Home</Link> · <Link href="/learn">Learn</Link> · <Link href="/pricing">Pricing</Link> · <Link href="/faq">FAQ</Link> ·{" "}
            <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
          </p>
        </footer>
      </div>
    </>
  );
}

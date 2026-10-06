import Link from "next/link";
import { evNetworkRates } from "@/lib/evCalc";
import SiteHeader from "../components/SiteHeader";
import Tag from "../components/Tag";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";
import EvCalculator from "./EvCalculator";

export const metadata = {
  title: "EV charging savings | Utilo",
  description: "What does a full charge cost on your network, and how much could a cheaper overnight rate save you?",
};

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
        <EvCalculator rates={rates} />
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

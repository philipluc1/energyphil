import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import SiteHeader from "../components/SiteHeader";
import MarketBoard from "../components/MarketBoard";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";

export const metadata = pageMeta({
  title: "What changed in Victoria's power market",
  description: "Every new electricity offer and price change from Victorian retailers in the last 30 days, from their published plan data, updated daily.",
  path: "/market",
});

// Re-render a few times a day so the board stays current between deploys.
export const revalidate = 21600;

export default function MarketPage() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={home.pageHead}>
          <h1>What changed in the market</h1>
          <p className={styles.lede}>
            Every new offer and price change from the retailers we track, from their own published plan data, checked every morning. Plan names are the
            retailers&apos; own.
          </p>
        </section>
        <MarketBoard />
        <p className={styles.lede} style={{ marginTop: 24 }}>
          Members get each of these priced against their own bill. <Link href="/check">Start with the free check</Link>.
        </p>
      </div>
    </>
  );
}

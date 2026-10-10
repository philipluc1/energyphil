import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import Tag from "../components/Tag";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";
import GasCheck from "./GasCheck";

export const metadata = {
  title: "Gas plan check | Utilo",
  description: "Compare Victorian residential gas plans from your bill. Free, no sign-up.",
};

export default function GasPage() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={home.pageHead}>
          <Tag tone="teal">Gas</Tag>
          <h1>Check your gas plan</h1>
          <p className={styles.lede}>
            Three numbers from your gas bill: the network, the days, and the megajoules. We price every gas plan we hold for your network and show the
            cheapest. Got electricity too? Check that as well; members see both on their dashboard.
          </p>
        </section>
        <GasCheck />
        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            <Link href="/">Home</Link> · <Link href="/check">Electricity check</Link> · <Link href="/pricing">Pricing</Link> ·{" "}
            <Link href="/faq">FAQ</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
          </p>
        </footer>
      </div>
    </>
  );
}

import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import styles from "../components/Comparator.module.css";
import GasCheck from "./GasCheck";

export const metadata = {
  title: "Gas plan check | Utilo",
  description: "Snap your gas bill and see the cheapest Victorian gas plan for your home. Free, no sign-up.",
};

export default function GasPage() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
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

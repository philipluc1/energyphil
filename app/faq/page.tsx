import Link from "next/link";
import { totalEvFriendly } from "@/lib/plans";
import SiteHeader from "../components/SiteHeader";
import { PRICE_CHANGE_CLAUSE } from "@/lib/dataPolicy";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";

export const metadata = { title: "FAQ | Utilo" };

export default function FaqPage() {
  return (
    <>
      <SiteHeader active="faq" />
      <div className={styles.wrap}>
        <section className={home.pageHead}>
          <h1>Questions people ask</h1>
          <p className={styles.lede}>Short answers. Still stuck? Start the free check and see how it goes.</p>
        </section>
        <section className={styles.sectionGap}>
          
          <div className={home.faq}>
            <details className={home.faqItem} open>
              <summary>Is it really free?</summary>
              <p>Yes. The check is free and you don&apos;t need an account. Members pay a small fee for extras like monthly checks and bill reading.</p>
            </details>
            <details className={home.faqItem}>
              <summary>Do I need my bill?</summary>
              <p>No. We estimate your usage from your answers. If you have a bill handy, you can type in the numbers for a sharper result.</p>
            </details>
            <details className={home.faqItem}>
              <summary>Are you part of the government?</summary>
              <p>No. We&apos;re an independent, privately run service, not affiliated with the Victorian Government or Victorian Energy Compare. Our results come from each retailer&apos;s published prices.</p>
            </details>
            <details className={home.faqItem}>
              <summary>I switched, and now something cheaper has appeared. Did I waste my time?</summary>
              <p>No. {PRICE_CHANGE_CLAUSE} Members are only alerted when a new plan beats their current one by about $50 a year or more, and not at all in the first two months after a switch unless the saving is large.</p>
            </details>
            <details className={home.faqItem}>
              <summary>What happens to my details?</summary>
              <p>We only use them to work out your result. We never sell or share them. <Link href="/privacy">Read our privacy policy</Link>.</p>
            </details>
            <details className={home.faqItem}>
              <summary>I&apos;ve got an EV. Does that matter?</summary>
              <p>It does. {totalEvFriendly()} plans have free or very cheap overnight rates, which suits home charging. We flag them in your results. Try the <Link href="/ev">EV charging calculator</Link> to see what a charge costs.</p>
            </details>
          </div>
        </section>

        <section className={styles.sectionGap}>
          <Link href="/check" className={styles.heroCta}>
            Start my free check
          </Link>
        </section>
        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            <Link href="/">Home</Link> · <Link href="/pricing">Pricing</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/cancellation-policy">Cancellation</Link> · <Link href="/terms">Terms</Link>
          </p>
        </footer>
      </div>
    </>
  );
}

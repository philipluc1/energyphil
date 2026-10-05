import Link from "next/link";
import { totalEvFriendly } from "@/lib/plans";
import SiteHeader from "../components/SiteHeader";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";

export const metadata = { title: "FAQ | VIC Energy Check" };

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
              <summary>What happens to my details?</summary>
              <p>We only use them to work out your result. We never sell or share them. <Link href="/privacy">Read our privacy policy</Link>.</p>
            </details>
            <details className={home.faqItem}>
              <summary>I&apos;ve got an EV. Does that matter?</summary>
              <p>It does. {totalEvFriendly()} plans have free or very cheap overnight rates, which suits home charging. We flag them in your results.</p>
            </details>
          </div>
        </section>

        <section className={styles.sectionGap}>
          <Link href="/check" className={styles.heroCta}>
            Start my free check
          </Link>
        </section>
        <footer className={styles.footer}>
          <div className={styles.fbrand}>VIC Energy Check</div>
          <p>
            <Link href="/">Home</Link> · <Link href="/pricing">Pricing</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/cancellation-policy">Cancellation</Link>
          </p>
        </footer>
      </div>
    </>
  );
}

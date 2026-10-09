import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import styles from "../components/StaticPage.module.css";
import { PRICE_CHANGE_CLAUSE } from "@/lib/dataPolicy";

export const metadata = { title: "Terms of Service | Utilo" };

const LAST_UPDATED = "6 October 2026";

// Plain-English terms. Draft for review by a lawyer before launch.
export default function TermsPage() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Policy</span>
          <h1>Terms of Service</h1>
          <div className={styles.updated}>Last updated {LAST_UPDATED}</div>
          <p className={styles.lede}>
            These terms cover your use of Utilo, both the free check and the paid membership. By using the site you agree to them.
            They&apos;re written to be read, not skimmed, so they&apos;re short.
          </p>
        </section>

        <div className={styles.calloutGood}>
          <strong>The short version:</strong> our results are estimates from retailers&apos; published prices. We help you choose; the
          retailer sells you the energy. Confirm the price with them before you switch.
        </div>

        <section className={styles.section}>
          <h2>1. What Utilo is</h2>
          <p>
            Utilo is an independent comparison and monitoring service for Victorian residential electricity and gas, with other states to follow. We are not an energy
            retailer, we don&apos;t sell energy, and we are not affiliated with the Victorian Government, Victorian Energy Compare, the
            Essential Services Commission or any retailer. Utilo is operated by [YOUR COMPANY NAME] (ABN [YOUR ABN]).
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. Results are estimates</h2>
          <p>
            We price plans from each retailer&apos;s published rates on the date shown with every result, using the usage you give
            us or an estimate from your answers about your home. Results exclude sign-up credits, conditional discounts, exit fees,
            concessions and rebates, and cover only the plans we can see. They are a guide to help you decide, not a quote or
            financial advice. Always confirm the price and conditions with the retailer before switching.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. Prices and offers change</h2>
          <p>
            {PRICE_CHANGE_CLAUSE} A cheaper plan appearing after you switch is not a fault in the service and is not grounds for a
            refund.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. Switching is between you and the retailer</h2>
          <p>
            When you switch, you enter a contract with that retailer, on their terms. We don&apos;t take part in that contract,
            we don&apos;t receive commissions from retailers, and we aren&apos;t responsible for a retailer&apos;s prices, service or
            conduct. Victorian law gives you a cooling-off period after agreeing to a new energy contract; the retailer will tell
            you how long.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. Membership</h2>
          <p>
            Membership is a paid subscription billed through Stripe at the price shown when you join. It renews automatically
            until you cancel, which you can do at any time from My Dashboard. Cancelling stops future charges; you keep access to
            the end of the period you&apos;ve paid for. Refund rules are in the{" "}
            <Link href="/cancellation-policy">Cancellation Policy</Link>. Bill reading is limited to a fair number of reads a day.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. Your information</h2>
          <p>
            We collect only what&apos;s needed to work out your result and run your membership. Bill photos and PDFs are sent to
            an AI service to read the numbers and are not kept afterwards. How we handle your data is in the{" "}
            <Link href="/privacy">Privacy Policy</Link>. You&apos;re responsible for the accuracy of what you enter.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. Fair use</h2>
          <p>
            Don&apos;t use Utilo to scrape data, resell results, or interfere with the service. We may limit or suspend access that
            breaks these terms.
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. Liability</h2>
          <p>
            Nothing in these terms excludes rights you have under the Australian Consumer Law. To the extent the law allows, we
            aren&apos;t liable for loss arising from reliance on an estimate, from a retailer&apos;s conduct, or from a price change
            after you switch. Our liability for the paid service is limited to the fees you paid in the previous 12 months.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Changes and contact</h2>
          <p>
            We may update these terms; the date at the top tells you when. Questions go to{" "}
            <a href="mailto:support@utilo.com.au">support@utilo.com.au</a>. These terms are governed by the laws of Victoria,
            Australia.
          </p>
        </section>

        <div className={styles.policyNav}>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/cancellation-policy">Cancellation Policy</Link>
          <Link href="/">Home</Link>
        </div>
      </div>
    </>
  );
}

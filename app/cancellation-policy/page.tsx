import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import styles from "../components/StaticPage.module.css";
import { PRICE_CHANGE_CLAUSE } from "@/lib/dataPolicy";

const LAST_UPDATED = "6 October 2026";

export default function CancellationPolicyPage() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Policy</span>
          <h1>Cancellation Policy</h1>
          <div className={styles.updated}>Last updated {LAST_UPDATED}</div>
          <p className={styles.lede}>
            The comparison on <Link href="/check">the check page</Link> is always free, with no sign-up. This
            page covers the paid monitoring subscription — Monthly, Quarterly, and Half-yearly — plus the
            once-off plan.
          </p>
        </section>

        <div className={styles.calloutGood}>
          <strong>The short version:</strong> cancel any time, no lock-in contract. You keep full access through
          to the end of the period you&apos;ve already paid for — right up to your renewal date — and you&apos;re
          simply not charged again after that.
        </div>

        <section className={styles.section}>
          <h2>Cancelling a Monthly, Quarterly, or Half-yearly plan</h2>
          <p>There&apos;s no lock-in and no cancellation fee. You can cancel at any time by:</p>
          <ul>
            <li>
              Signing in to <Link href="/account">your account</Link> and selecting <strong>Manage billing</strong>,
              or
            </li>
            <li>
              Emailing us at{" "}
              <a href="mailto:support@utilo.com.au">support@utilo.com.au</a> and asking us to
              cancel on your behalf.
            </li>
          </ul>
          <p>
            When you cancel, you keep full benefit of the plan — ongoing price monitoring, alert emails, and your
            dashboard — for the <strong>rest of the period you&apos;ve already paid for</strong>, right up
            to your existing renewal date. You won&apos;t be charged again after that date, and your subscription
            simply doesn&apos;t renew.
          </p>
          <p>
            Because you keep full access through to that date, cancelling partway through a period doesn&apos;t
            come with a partial refund for the unused portion — you&apos;ve already got, and keep, what you paid
            for that period.
          </p>
        </section>

        <section className={styles.section}>
          <h2>The once-off plan</h2>
          <p>
            The once-off plan is a single payment with ongoing monitoring and no renewal — there&apos;s no
            recurring charge to cancel. If you&apos;d like us to stop monitoring and remove your details anyway,
            just email us at{" "}
            <a href="mailto:support@utilo.com.au">support@utilo.com.au</a> and we&apos;ll action
            it; see our <Link href="/privacy">Privacy Policy</Link> for how we handle data deletion requests.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Refunds</h2>
          <p>
            Outside of the usual consumer guarantees under Australian Consumer Law (for example, if the service
            doesn&apos;t work as described), we don&apos;t offer refunds for the unused portion of a billing
            period you&apos;ve already paid for — see above for why: you keep the benefit for that whole period
            regardless of when within it you cancel. If something&apos;s gone wrong with your billing or you
            think you&apos;ve been charged in error, contact us at{" "}
            <a href="mailto:support@utilo.com.au">support@utilo.com.au</a> and we&apos;ll sort
            it out.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Prices and offers change</h2>
          <p>
            {PRICE_CHANGE_CLAUSE} Our results are estimates from retailers&apos; published rates on the day shown, and a
            cheaper plan appearing after you switch is not a fault in the service and is not grounds for a refund.
            Before switching, confirm the price and conditions with the retailer.
          </p>
        </section>

        <section className={styles.section}>
          <h2>What happens to your data if you cancel</h2>
          <p>
            Cancelling your subscription stops billing and ongoing monitoring — it doesn&apos;t automatically
            delete your account or history. Your savings history stays visible in your dashboard if you sign back
            in, and you&apos;re welcome to resubscribe at any time. If you&apos;d prefer we delete your data
            entirely, just ask — see our <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>

        <div className={styles.policyNav}>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/default-offer">About the Victorian Default Offer</Link>
          <Link href="/">Home</Link>
        </div>
      </div>
    </>
  );
}

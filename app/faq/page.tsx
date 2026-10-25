import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { PLANS, RETAILER_COUNT, totalEvFriendly } from "@/lib/plans";
import SiteHeader from "../components/SiteHeader";
import { PRICE_CHANGE_CLAUSE } from "@/lib/dataPolicy";
import { REFERRAL_CREDIT_CENTS, REFERRAL_FRIEND_CENTS, referralDollars } from "@/lib/referralOffer";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";

export const metadata = pageMeta({ title: "Questions about Utilo", description: "Is it free, do you need a bill, is it independent, how it differs from Victorian Energy Compare, and what happens to your details.", path: "/faq" });

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
              <p>Yes. The check is free, including up to 5 bill photo reads a day, and you don&apos;t need an account. Members pay for the ongoing part: every plan re-priced against their home each morning, an email when switching is worth it, and a saved result each month.</p>
            </details>
            <details className={home.faqItem}>
              <summary>I&apos;m not in Victoria. Can I use it?</summary>
              <p>Not yet. We&apos;re starting with Victoria, then rolling out to New South Wales, South Australia and Queensland. Leave your email on the <Link href="/#waitlist">home page</Link> and we&apos;ll tell you when your state opens.</p>
            </details>
            <details className={home.faqItem}>
              <summary>Do I need my bill?</summary>
              <p>No. Answer a few questions about your home and we estimate your usage. A bill gives a sharper result: snap a photo or upload the PDF and we read it for you, or type in the numbers yourself.</p>
            </details>
            <details className={home.faqItem}>
              <summary>Are you part of the government?</summary>
              <p>No. We&apos;re an independent, privately run service, not affiliated with the Victorian Government or Victorian Energy Compare. Our results come from each retailer&apos;s published prices.</p>
            </details>
            <details className={home.faqItem}>
              <summary>How is this different from Victorian Energy Compare?</summary>
              <p>
                Victorian Energy Compare is the Government&apos;s free comparison site, and it&apos;s good. If you enter your meter number it uses your
                smart meter data, which it calls the most accurate way to compare; otherwise it estimates your use from your answers about your home. It
                finds the best deals on the day you check.
              </p>
              <p>
                Utilo is built around your bill rather than a typical household. A photo gives us how much you use and when, the rates you pay now and the
                plan you&apos;re on, so the saving is against what you actually pay, and we can tell you if you&apos;re on an older, dearer version of a plan
                with the same name. It takes about a minute. Then, for members, it keeps going: prices re-checked every morning, a heads-up before your
                discount or fixed price ends, and a re-check after the 1 July changes. We track {PLANS.length} plans from {RETAILER_COUNT} retailers, not
                every plan in the market, so using both is a good idea.{" "}
                <Link href="/learn#compare">See who does what</Link>.
              </p>
            </details>
            <details className={home.faqItem}>
              <summary>I switched, and now something cheaper has appeared. Did I waste my time?</summary>
              <p>No. {PRICE_CHANGE_CLAUSE} Members are only alerted when a new plan beats their current one by $50 a year or more (or the amount they choose on their dashboard), and not at all in the first two months after a switch unless the saving is large.</p>
            </details>
            <details className={home.faqItem}>
              <summary>What happens to my details?</summary>
              <p>We use them to work out your result and, if you ask or join, to email you and keep checking your plan. We never sell them or pass them to retailers, and we don&apos;t keep photos of your bill, only the numbers. Your answers are also saved in your own browser so you can pick up where you left off. You can delete everything we hold from your dashboard at any time. <Link href="/privacy">Read our privacy policy</Link>.</p>
            </details>
            <details className={home.faqItem}>
              <summary>Can I share Utilo with a friend?</summary>
              <p>Yes, please. Members have a referral link on the Membership tab of their dashboard. A friend who joins through it (and hasn&apos;t been a member before) gets {referralDollars(REFERRAL_FRIEND_CENTS)} off their first payment, and you get {referralDollars(REFERRAL_CREDIT_CENTS)} off your next one. <Link href="/terms#referrals">Referral terms</Link>.</p>
            </details>
            <details className={home.faqItem}>
              <summary>I&apos;ve got an EV. Does that matter?</summary>
              {totalEvFriendly() > 0 ? (
                <p>It does. {totalEvFriendly()} plans have free or very cheap overnight rates, which suits home charging. We flag them in your results. Try the <Link href="/ev">EV charging calculator</Link> to see what a charge costs.</p>
              ) : (
                <p>It does: charging adds a lot of use, so tick &ldquo;Electric car&rdquo; in the check and we include it. Plans with a cheap overnight rate are flagged in your results when retailers publish them.</p>
              )}
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

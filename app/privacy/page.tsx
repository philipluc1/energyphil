import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import styles from "../components/StaticPage.module.css";

const LAST_UPDATED = "5 October 2026";

export default function PrivacyPolicyPage() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Policy</span>
          <h1>Privacy Policy</h1>
          <div className={styles.updated}>Last updated {LAST_UPDATED}</div>
          <p className={styles.lede}>
            Utilo (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an independent electricity comparison service
            for Victorian residential households. This page explains what we collect when you use the free
            comparison tool or subscribe to ongoing monitoring, why we collect it, and what we do — and don&apos;t
            do — with it.
          </p>
        </section>

        <section className={styles.section}>
          <h2>What we collect</h2>
          <p>Depending on how you use the site, we may collect:</p>
          <ul>
            <li>
              <strong>Bill details you enter</strong> — your network/distributor, billing period length, usage
              figures (total or peak/shoulder/off-peak), controlled load usage, solar export, and what you&apos;re
              currently paying, if you choose to tell us.
            </li>
            <li>
              <strong>A photo or PDF of your bill</strong>, if you use the &ldquo;snap or upload your bill&rdquo;
              feature. The image is sent directly to our AI provider (Anthropic&apos;s Claude) to read the
              relevant figures off it. <strong>We don&apos;t keep a copy of the image itself</strong> — once the
              figures are extracted and shown to you on screen, the photo is discarded on our end.
            </li>
            <li>
              <strong>Optional identity and property details</strong> — name, street address, suburb, and
              postcode, if you type them in or they&apos;re read off a photographed bill. These are only used to
              help set your network correctly and, if you subscribe, to identify your account — never sold or
              shared.
            </li>
            <li>
              <strong>Your email address</strong>, if you ask for a one-off copy of your result, opt in to
              free price-alert emails, or subscribe to paid monitoring.
            </li>
            <li>
              <strong>Payment details</strong>, if you subscribe. Card and payment information is entered
              directly into Stripe, our payment processor — it passes through their secure checkout and is never
              seen or stored by us.
            </li>
            <li>
              <strong>Standard technical logs</strong> (such as IP address and browser type) collected
              automatically by our hosting provider for security and performance, as with any website.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Why we collect it</h2>
          <p>We use this information only to:</p>
          <ul>
            <li>Calculate and show you an accurate electricity cost comparison;</li>
            <li>Set your electricity network/distributor correctly;</li>
            <li>Send you the result by email, if you ask us to;</li>
            <li>Run your paid subscription — ongoing price monitoring, alert emails, billing, and your account
            portal — if you sign up for it;</li>
            <li>Keep a record of your estimated savings over time, shown back to you in your dashboard; and</li>
            <li>Operate, secure, and improve the service itself.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Where it&apos;s stored</h2>
          <p>
            Comparison inputs, subscriber details, and savings history are stored in our database, hosted by
            Supabase. Account sign-in uses passwordless &ldquo;magic link&rdquo; email authentication, also
            provided by Supabase — there&apos;s no password of yours for us to store or lose. Payment processing
            and billing records are handled by Stripe. We don&apos;t run our own copy of your card details
            anywhere.
          </p>
          <p>
            A free, one-off comparison you run without subscribing is only saved if you explicitly give us your
            email (to send you a copy of the result, or to opt into free price alerts). If you don&apos;t enter an
            email, nothing from that session is kept after you close the page.
          </p>
        </section>

        <section className={styles.section}>
          <h2>What we never do</h2>
          <ul>
            <li>We never sell your personal information to anyone.</li>
            <li>We never share it with other retailers, marketers, or data brokers.</li>
            <li>We&apos;re not affiliated with the Victorian Government, the Essential Services Commission, or
            any retailer — your details aren&apos;t passed to them, and switching retailers (if you choose to) is
            always done by you, directly with that retailer.</li>
            <li>We don&apos;t run third-party advertising trackers on this site.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>How long we keep it</h2>
          <p>
            We keep subscriber and savings-history data for as long as your subscription is active, plus a
            reasonable period afterwards in case you resubscribe or have a billing query. A one-off lead (email
            left for a single result or free price alerts) is kept until you unsubscribe or ask us to delete it.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Your rights</h2>
          <p>
            You can ask us what personal information we hold about you, ask us to correct it, or ask us to delete
            it, at any time. Subscribers can also manage and cancel their own subscription directly from{" "}
            <Link href="/account">their account page</Link> — see our{" "}
            <Link href="/cancellation-policy">Cancellation Policy</Link> for how that works. For anything else,
            contact us at{" "}
            <a href="mailto:privacy@utilo.com.au">privacy@utilo.com.au</a>.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Changes to this policy</h2>
          <p>
            If we make a material change to how we collect or use your information, we&apos;ll update this page
            and change the &ldquo;last updated&rdquo; date above.
          </p>
        </section>

        <div className={styles.policyNav}>
          <Link href="/cancellation-policy">Cancellation Policy</Link>
          <Link href="/default-offer">About the Victorian Default Offer</Link>
          <Link href="/">Home</Link>
        </div>
      </div>
    </>
  );
}

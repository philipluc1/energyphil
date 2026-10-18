import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import { Fill, MailLink } from "../components/Fill";
import { ABOUT, PRIVACY } from "@/lib/about";
import styles from "../components/StaticPage.module.css";

export const metadata = { title: "Privacy Policy | Utilo" };

// Business details and the bits you'll fill in later (contact email, database
// region, retention) come from lib/about.ts. Empty ones show as highlighted
// [placeholders] here until they're filled in.

export default function PrivacyPolicyPage() {
  const operator = ABOUT.businessName;
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Policy</span>
          <h1>Privacy Policy</h1>
          <div className={styles.updated}>Last updated {PRIVACY.lastUpdated}</div>
          <p className={styles.lede}>
            Utilo is an independent electricity and gas comparison service for Victorian households, operated by{" "}
            <Fill value={operator} label="business name" /> (ABN <Fill value={ABOUT.abn} label="ABN" />). This policy explains what personal information
            we collect, why, where it goes, and how you can see, correct or delete it. We aim to handle your information in line with the Australian
            Privacy Principles in the Privacy Act 1988.
          </p>
        </section>

        <section className={styles.section}>
          <h2>The short version</h2>
          <ul>
            <li>We collect what we need to compare your plan and, if you join, to keep checking it. Nothing more.</li>
            <li>We don&apos;t keep photos of your bill. We keep the numbers read from them.</li>
            <li>We never sell your information or share it with retailers, marketers or data brokers. We take no money from retailers.</li>
            <li>Some of the services we use store or process data outside Australia. They&apos;re listed below.</li>
            <li>You can ask us what we hold, have it corrected, or have it deleted.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>What we collect</h2>
          <p>Depending on how you use Utilo, we may collect:</p>
          <ul>
            <li>
              <strong>Your energy details:</strong> your electricity network, billing period, usage (in total or by time of day), controlled load
              (off-peak hot water), solar export, the rates you pay, your retailer and plan name, whether your price is fixed or variable, and when a
              discount or fixed price ends. For gas: your gas network, usage in megajoules and gas charges.
            </li>
            <li>
              <strong>Your meter number (NMI)</strong>, if it&apos;s read from a bill a member uploads. We use it only to identify the right bill and
              network.
            </li>
            <li>
              <strong>Answers about your home</strong>, if you use the questions instead of a bill: how many people live there, heating, cooling, hot
              water, pool, solar and whether you charge an electric car.
            </li>
            <li>
              <strong>Name and address</strong>, if you type them in or they&apos;re read from your bill. Used to set your network correctly and, for
              members, to identify your account.
            </li>
            <li>
              <strong>Your email address</strong>, if you ask for your result by email, opt in to price alerts, or join.
            </li>
            <li>
              <strong>Membership details</strong>, if you join: your plan, payment status, Stripe customer reference, the date you switched, and
              your estimated savings over time. We never see or store your card details; Stripe handles them.
            </li>
            <li>
              <strong>Bill photos and PDFs.</strong> When you snap or upload a bill, the file is sent to our bill-reading provider (Anthropic) to
              read the figures. We don&apos;t keep a copy of the file; only the figures you then see on screen. If a bill shows an overdue amount or
              a payment plan, we use that only on screen, to suggest talking to your retailer before switching. We don&apos;t store it, and it&apos;s
              never used in emails.
            </li>
            <li>
              <strong>How the check is used, anonymously:</strong> a count of checks started and finished, clicks to join, which network, and how
              you arrived (a partner&apos;s link, a member&apos;s referral link, or an ad&apos;s campaign name). These counts carry no name, email
              or IP address. They tell us which parts of the site and which partners help people.
            </li>
            <li>
              <strong>Where you came from:</strong> if you arrive through a partner&apos;s link, a member&apos;s referral link or an ad, a small
              cookie remembers that for 90 days, so the partner is counted, your friend&apos;s discount applies and the right member gets their
              credit. If you join, we store it with your membership.
            </li>
            <li>
              <strong>Technical information:</strong> your IP address and browser details, logged by our hosting provider for security, and a record
              of free bill reads linked to your IP address, which we use to apply the daily free-read limit and delete after{" "}
              {PRIVACY.billReadRetentionDays} days.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>On your own device</h2>
          <p>
            To save you typing everything again, the check saves your answers and last result in your browser (local storage) on the device you
            used. This stays on your device and isn&apos;t sent to us unless you ask for your result by email or join. To clear it, use{" "}
            <strong>Start fresh</strong> on the check page, or clear your browser&apos;s site data. If you sign in, your browser also keeps a sign-in
            session. We don&apos;t use third-party advertising or analytics trackers: the anonymous counts above are our own.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Why we use it</h2>
          <ul>
            <li>To compare your plan against current plans and show you the result.</li>
            <li>To email you your result, if you ask.</li>
            <li>
              To send follow-up and price-alert emails, <strong>only if you opt in</strong>. Every email has an unsubscribe link.
            </li>
            <li>For members: to re-check prices every morning, alert you before a discount or fixed price ends, send a monthly summary, run billing
              and show your savings on your dashboard.</li>
            <li>To keep the service secure, prevent misuse and fix problems.</li>
          </ul>
          <p>We don&apos;t use your information for anything unrelated to these purposes without asking you first.</p>
        </section>

        <section className={styles.section}>
          <h2>Who we share it with</h2>
          <p>
            We use a small number of service providers to run Utilo. They handle your information on our behalf, only for the purposes above. Some
            are based overseas, so your information may be stored or processed outside Australia.
          </p>
          <table className={styles.rateTable}>
            <thead>
              <tr><th>Provider</th><th>What they do</th><th>Where</th></tr>
            </thead>
            <tbody>
              <tr><td>Supabase</td><td>Database and sign-in links</td><td><Fill value={PRIVACY.databaseRegion} label="database region" /></td></tr>
              <tr><td>Vercel</td><td>Website hosting</td><td>United States and other regions</td></tr>
              <tr><td>Anthropic</td><td>Reading the figures from bill photos and PDFs</td><td>United States</td></tr>
              <tr><td>Stripe</td><td>Payments and billing</td><td>United States and other regions</td></tr>
              <tr><td>Resend</td><td>Sending emails</td><td>United States</td></tr>
            </tbody>
          </table>
          <p className={styles.tableNote}>
            We don&apos;t pass your details to energy retailers. If you decide to switch, you do that directly with the retailer.
          </p>
        </section>

        <section className={styles.section}>
          <h2>How long we keep it</h2>
          <ul>
            <li>
              <strong>Members:</strong> while your membership is active, and for <Fill value={PRIVACY.memberRetention} label="retention period, e.g. 12 months" />{" "}
              after it ends (for billing questions or if you rejoin). Then it&apos;s deleted. Payment records are kept by Stripe as the law requires.
            </li>
            <li>
              <strong>Email-only results and price alerts:</strong> until you unsubscribe or ask us to delete them.
            </li>
            <li>
              <strong>Free bill-read records:</strong> {PRIVACY.billReadRetentionDays} days.
            </li>
            <li>
              <strong>Bill photos and PDFs:</strong> not kept.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Keeping it secure</h2>
          <p>
            Data is encrypted in transit, and each member&apos;s records are locked to their own account. Sign-in is by emailed link, so there&apos;s no
            password to steal. If a data breach is likely to cause you serious harm, we&apos;ll tell you and, where required, the Office of the
            Australian Information Commissioner (OAIC).
          </p>
        </section>

        <section className={styles.section}>
          <h2>Seeing, correcting or deleting your information</h2>
          <p>
            You can ask what we hold about you, ask us to correct it, or ask us to delete it. Email{" "}
            <MailLink email={PRIVACY.email} label="privacy email" />
            {ABOUT.postalAddress ? <>, or write to {ABOUT.postalAddress}</> : null}. We&apos;ll reply within {PRIVACY.responseDays} days. Members can
            also update their details by uploading a newer bill, and cancel any time, from their <Link href="/account">dashboard</Link>; see the{" "}
            <Link href="/cancellation-policy">Cancellation Policy</Link>. Anyone signed in can delete everything we hold about them with{" "}
            <strong>Delete my data</strong> on the dashboard&apos;s Membership tab (cancel a membership first). Stripe keeps payment records, as the
            law requires.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Complaints</h2>
          <p>
            If you&apos;re unhappy with how we&apos;ve handled your information, email <MailLink email={PRIVACY.email} label="privacy email" /> and
            tell us what happened. We&apos;ll look into it and respond within {PRIVACY.responseDays} days. If you&apos;re not satisfied with our
            response, you can complain to the Office of the Australian Information Commissioner at{" "}
            <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer">oaic.gov.au</a> or on 1300 363 992.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Changes to this policy</h2>
          <p>
            If we change how we collect or use your information, we&apos;ll update this page and the date at the top. If a change materially affects
            members, we&apos;ll email them first.
          </p>
        </section>

        <div className={styles.policyNav}>
          <Link href="/terms">Terms</Link>
          <Link href="/cancellation-policy">Cancellation Policy</Link>
          <Link href="/">Home</Link>
        </div>
      </div>
    </>
  );
}

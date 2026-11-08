import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import CopyBlock from "./CopyBlock";
import styles from "../components/StaticPage.module.css";
import c from "./cantpay.module.css";

// 8 Nov 2026: "I can't pay this bill". A customer's rights in Victoria, in
// plain words, and what to say. Static: nothing typed or read here is stored.
// No phone numbers (house rule): links to the official pages instead.
// Facts as at Nov 2026 from the ESC's "Getting help paying your energy bills",
// the Department of Families, Fairness and Housing's Utility Relief Grant page
// and the ESC's Energy Consumer Reforms final decision (30 Sep 2025).

export const metadata = pageMeta({
  title: "Can't pay your energy bill? Your rights in Victoria",
  description: "Behind on your power or gas bill in Victoria? Your retailer must offer help: a payment plan of up to two years, no disconnection under $1,000 or while you're on a plan, the Utility Relief Grant and your best offer. What to say, in plain words.",
  path: "/cant-pay-my-bill",
});

const MESSAGE = `Hi, I'm [your name], account number [account number].

I'm having trouble paying my [electricity / gas] bill of $[amount], due [date]. I'd like payment difficulty assistance, please:

1. A payment plan I can afford. I can pay about $[amount] a [fortnight / month].
2. A check that I'm on your best offer for my usage.
3. Help applying for the Utility Relief Grant, if I'm eligible.
[4. I hold a [Pensioner Concession / Health Care / DVA Gold] card. Please make sure the concession is on my account.]

Please confirm what we agree in writing. Thank you.`;

export default function CantPayPage() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Help with a bill</span>
          <h1>Can&apos;t pay your energy bill? You have rights.</h1>
          <p className={styles.lede}>
            In Victoria your retailer has to help you, and you don&apos;t have to prove anything to ask. The rules got stronger on 1 October 2026. Here&apos;s what you&apos;re entitled to, and what to say.
          </p>
          <p className={c.private}>Nothing on this page is saved. We don&apos;t ask, and we don&apos;t keep, anything about what you owe.</p>
        </section>

        <section className={styles.section} aria-labelledby="first">
          <h2 id="first">1. Tell your retailer, early</h2>
          <p>
            Contact them through their app, online chat or contact form, ideally before the due date. Say you&apos;re having trouble paying and you&apos;d like <strong>payment difficulty assistance</strong>. Those words matter: they switch on the help below. You don&apos;t need to show payslips or explain why.
          </p>
          <div className={c.steps}>
            <div><b>If you&apos;re a bit short</b><span>They must offer at least three of: smaller, more frequent payments; a different payment cycle; one bill delay a year; or paying ahead.</span></div>
            <div><b>Once you miss a bill over $55</b><span>They must contact you and offer a payment plan to clear what you owe over up to <strong>two years</strong>, plus help using less and information on grants and concessions.</span></div>
            <div><b>If you can&apos;t cover what you use now</b><span>You can pay less than your ongoing usage for a while, with what you owe put on hold for at least <strong>six months</strong>, and get practical help to bring your bills down.</span></div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="cutoff">
          <h2 id="cutoff">2. When they can&apos;t cut you off</h2>
          <ul>
            <li>From 1 October 2026, not while you owe <strong>less than $1,000</strong> (it was $300).</li>
            <li>Not while you&apos;re on a payment plan with them.</li>
            <li>Not while a Utility Relief Grant application is being looked at: asking for the form puts a hold on your account.</li>
            <li>They must take your circumstances into account, such as losing a job, family violence, illness or a death in the family. Disconnection is a last resort.</li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="best">
          <h2 id="best">3. The cheapest plan, automatically</h2>
          <p>
            From 1 October 2026, if you&apos;re getting payment difficulty help, your retailer must move you to <strong>its own best offer</strong> for your usage. They&apos;ll tell you first, and you have 10 business days to say no. It&apos;s worth checking whether another retailer is cheaper still, but if you&apos;re on a payment plan, ask your retailer before you switch: moving can end the arrangement.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="urg">
          <h2 id="urg">4. The Utility Relief Grant</h2>
          <p>A Victorian Government grant paid straight to your retailer to clear an overdue bill after a hard patch.</p>
          <div className={c.facts}>
            <div><b>Up to $650</b><span>for electricity, and the same for gas, every two years. Up to $1,300 if your home has only one kind of energy.</span></div>
            <div><b>Who</b><span>Pensioner Concession, Health Care or DVA Gold card holders, or a low-income household without one.</span></div>
            <div><b>When</b><span>You can&apos;t pay without help and you&apos;ve had a drop in income, big unexpected costs, family violence, or housing costs over 30% of your income.</span></div>
            <div><b>How</b><span>Ask your retailer for the form. They must help you fill it in. It takes about 4 to 6 weeks.</span></div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="concession">
          <h2 id="concession">5. Concessions, if you hold a card</h2>
          <p>
            The <strong>Annual Electricity Concession</strong> takes 17.5% off your electricity bill, and the <strong>Winter Gas Concession</strong> 17.5% off gas from May to October. They aren&apos;t automatic: the card has to be in the account holder&apos;s name and registered with your retailer. If you&apos;ve moved house or changed retailer, check it came with you.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="say">
          <h2 id="say">What to say</h2>
          <p>Copy this into your retailer&apos;s chat, app or contact form. Fill in the [brackets] and delete what doesn&apos;t apply.</p>
          <CopyBlock text={MESSAGE} />
        </section>

        <section className={`${styles.section} ${c.links}`} aria-labelledby="stuck">
          <h2 id="stuck">If it isn&apos;t sorted</h2>
          <ul>
            <li><strong>Energy and Water Ombudsman Victoria (EWOV)</strong> is free and independent, and can step in if your retailer won&apos;t help. Their details are on the front of your bill. <a href="https://www.ewov.com.au" target="_blank" rel="noopener">ewov.com.au</a></li>
            <li><strong>A free financial counsellor</strong> can talk to your retailer with you. <a href="https://ndh.org.au" target="_blank" rel="noopener">National Debt Helpline</a></li>
            <li>The full rules: <a href="https://www.esc.vic.gov.au/getting-help-paying-your-energy-bills" target="_blank" rel="noopener">Essential Services Commission</a> · <a href="https://services.dffh.vic.gov.au/node/226" target="_blank" rel="noopener">Utility Relief Grant</a></li>
          </ul>
        </section>

        <section className={`${styles.section} ${c.links}`} aria-labelledby="next">
          <h2 id="next">Stopping the next one</h2>
          <p>
            A cheaper plan won&apos;t clear what you owe, but it stops the next bill growing. The <Link href="/check">free bill check</Link> shows what every retailer would charge for your usage in about a minute.
          </p>
          <p className={styles.updated}>Rules as at November 2026. This is general information, not financial or legal advice.</p>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}

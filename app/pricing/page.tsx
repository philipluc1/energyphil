import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import JoinDirect from "../components/JoinDirect";
import PlanBand from "../components/PlanBand";
import Tag from "../components/Tag";
import MarketPulse from "../components/MarketPulse";
import SiteHeader from "../components/SiteHeader";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";

export const metadata = pageMeta({ title: "Membership: $7 a month or $39 a year", description: "The bill check is free. Members get every plan re-priced against their home each morning, an email when switching is worth it, and a monthly bill check.", path: "/pricing" });

export default function PricingPage() {
  return (
    <>
      <SiteHeader active="pricing" />
      <div className={styles.wrap}>
        <section className={home.pageHead}>
          <Tag tone="amber">Cancel any time</Tag>
          <h1>We check every plan for you, automatically. $7 a month.</h1>
          <p className={styles.lede}>You never chase a deal again: every retailer, every offer, checked against your own bill each morning. Or $39 a year, less than $1 a week. The check itself is always free.</p>
          <ul className={home.leadList}>
            <li><b>Automatic.</b> Every plan re-priced against your bill, every morning, without you lifting a finger</li>
            <li>An email only when switching is worth it; otherwise, silence</li>
            <li>A monthly summary and a running tally of what you&apos;ve saved</li>
            <li>Electricity and gas today <span className={home.soon}>More household bills on the way</span></li>
          </ul>
          <MarketPulse />
        </section>
        <PlanBand
          title="Electricity and gas, re-checked every morning"
          intro={<>Same checking either way. Yearly works out at $3.25 a month; monthly lets you try it first.</>}
          cards={<JoinDirect />}
        />
        <p className={home.dataNote}>
          Pay now and snap your bill on the next screen, or <Link href="/check">run the free check first</Link>: joining is offered at the end of it too.{" "}
          <Link href="/cancellation-policy">Cancellation policy</Link>
        </p>
        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            <Link href="/">Home</Link> · <Link href="/faq">FAQ</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/cancellation-policy">Cancellation</Link> · <Link href="/terms">Terms</Link>
          </p>
        </footer>
      </div>
    </>
  );
}

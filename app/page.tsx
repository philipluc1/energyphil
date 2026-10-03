import Link from "next/link";
import { PLANS, PLAN_DATA_DATE } from "@/lib/plans";
import { PRICING_PLANS, fmtPrice } from "@/lib/pricingPlans";
import SiteHeader from "./components/SiteHeader";
import styles from "./components/Comparator.module.css";

const PLAN_COUNT = PLANS.length;

function fmtUpdated(): string {
  return new Date(PLAN_DATA_DATE + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Home() {
  return (
    <>
      <SiteHeader active="home" />
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <h1>Stop overpaying for electricity — and stop having to check it yourself.</h1>
          <p className={styles.lede}>
            VIC Energy Check compares your bill live against {PLAN_COUNT} current residential plans from 15
            Victorian retailers and shows your cheapest options — completely free, no sign-up needed. If
            you&apos;d rather not keep checking by hand, subscribe and we&apos;ll keep watching the market for
            you instead.
          </p>
          <div className={styles.trustRow}>
            <div className={styles.trustChip}>
              <span className={styles.num}>{PLAN_COUNT}</span>
              <span className={styles.lbl}>live plans</span>
            </div>
            <div className={styles.trustChip}>
              <span className={styles.num}>15</span>
              <span className={styles.lbl}>retailers</span>
            </div>
            <div className={styles.trustChip}>
              <span className={styles.num}>5</span>
              <span className={styles.lbl}>VIC networks</span>
            </div>
            <div className={styles.trustChip}>
              <span className={styles.num}>{fmtUpdated()}</span>
              <span className={styles.lbl}>data pulled</span>
            </div>
          </div>
          <Link href="/check" className={styles.heroCta}>
            Check my bill — it&apos;s free →
          </Link>
        </section>

        <section className={styles.sectionGap}>
          <div className={styles.resultsHead}>
            <h2>How it works</h2>
          </div>
          <div className={styles.howSteps}>
            <div className={styles.howStepCard}>
              <div className={styles.howStepNum}>1</div>
              <h3>Snap or upload your bill</h3>
              <p>
                Take a photo, or upload a photo or PDF — we read the numbers off it for you. Prefer to type it
                in yourself? That works too.
              </p>
            </div>
            <div className={styles.howStepCard}>
              <div className={styles.howStepNum}>2</div>
              <h3>See your cheapest options</h3>
              <p>
                We check your usage against every current plan we can see live from Victorian retailers and
                rank them for you — free, no sign-up, nothing saved unless you choose to.
              </p>
            </div>
            <div className={styles.howStepCard}>
              <div className={styles.howStepNum}>3</div>
              <h3>Stay on the cheapest plan, automatically</h3>
              <p>
                Not fussed on checking back yourself? Subscribe to ongoing monitoring and we&apos;ll email you
                the moment something cheaper shows up for your area.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.sectionGap}>
          <div className={styles.trustBadges}>
            <div className={styles.trustBadge}>
              <strong>Independent.</strong> VIC Energy Check is a privately run comparison service. We&apos;re
              not affiliated with, operated by, or endorsed by the Victorian Government or its &ldquo;Victorian
              Energy Compare&rdquo; service — our results are our own calculations from each retailer&apos;s
              published data.
            </div>
            <div className={styles.trustBadge}>
              <strong>Private.</strong> We only use the bill details you give us to calculate your result. We
              never sell or share your information with anyone.
            </div>
            <div className={styles.trustBadge}>
              <strong>Transparent.</strong> See what you&apos;d pay on every comparable plan, not just one
              &ldquo;recommended&rdquo; deal.
            </div>
          </div>
        </section>

        <section className={styles.sectionGap} id="monitoring">
          <div className={styles.resultsHead}>
            <h2>Ongoing monitoring &amp; alerts</h2>
          </div>
          <p className={styles.lede} style={{ maxWidth: 640, fontSize: 14 }}>
            The comparison above always stays free. On top of it, you can subscribe — monthly, quarterly,
            half-yearly, or a once-off payment — and we&apos;ll keep watching the market and email you the
            moment something cheaper appears, instead of you having to come back and check.
          </p>
          <div className={styles.pricingGrid} style={{ marginTop: 18 }}>
            {PRICING_PLANS.map((plan) => (
              <div key={plan.id} className={styles.pricingCard}>
                <div className={styles.pricingName}>{plan.name}</div>
                <div className={styles.pricingPrice}>
                  {fmtPrice(plan.priceCents)}
                  <span className={styles.pricingCadence}>{plan.cadenceLabel}</span>
                </div>
                <div className={styles.pricingBlurb}>{plan.blurb}</div>
              </div>
            ))}
          </div>
          <Link href="/check#pricing" className={styles.heroCta} style={{ marginTop: 18 }}>
            Check my bill to get started →
          </Link>
        </section>

        <footer className={styles.footer}>
          <div className={styles.fbrand}>VIC Energy Check</div>
          <p>
            An independent comparison tool for Victorian residential electricity customers, not affiliated with
            the Victorian Government or any official energy comparison service. Plan data is pulled from each
            retailer&apos;s own Consumer Data Right (CDR) product reference feed and reflects each retailer&apos;s
            most recently published rates; always confirm final pricing with the retailer before switching. This
            tool does not sell or transfer energy and is not an authorised retailer.
          </p>
        </footer>
      </div>
    </>
  );
}

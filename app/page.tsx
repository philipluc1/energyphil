import Link from "next/link";
import { PLANS, PLAN_DATA_DATE } from "@/lib/plans";
import { PRICING_PLANS, fmtPrice } from "@/lib/pricingPlans";
import { typicalHouseholdExample } from "@/lib/savings";
import SiteHeader from "./components/SiteHeader";
import ScrollReveal from "./components/ScrollReveal";
import styles from "./components/Comparator.module.css";
import home from "./home.module.css";

const PLAN_COUNT = PLANS.length;

function fmtUpdated(): string {
  return new Date(PLAN_DATA_DATE + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtCurrency0(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

// Simple, consistent-stroke inline icons — no external icon library needed
// for a handful of marks, and it keeps the page a single self-contained file.
function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4.5 5.5V11c0 4.9 3.2 8.8 7.5 10 4.3-1.2 7.5-5.1 7.5-10V5.5L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function Home() {
  const example = typicalHouseholdExample();

  return (
    <>
      <SiteHeader active="home" />
      <div className={styles.wrap}>
        <section className={home.hero}>
          <div className={home.heroGrid}>
            <div className={home.heroCopy}>
              <span className={home.eyebrow}>Free · Independent · No sign-up to check</span>
              <h1>Stop overpaying for electricity — and stop having to check it yourself.</h1>
              <p className={styles.lede}>
                VIC Energy Check compares your bill live against {PLAN_COUNT} current residential plans from 15
                Victorian retailers and shows your cheapest options. If you&apos;d rather not keep checking by
                hand, subscribe and we&apos;ll keep watching the market for you instead.
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
            </div>

            <div className={home.heroProof}>
              <div className={home.proofCard}>
                <div className={home.proofTag}>Example, not a quote</div>
                <div className={home.proofHeadline}>
                  A typical household using ~{example.annualUsageKwh.toLocaleString("en-AU")}kWh a year could
                  save around
                </div>
                <div className={home.proofTiles}>
                  <div className={home.proofTile}>
                    <div className={`${home.proofTileV} mono`}>{fmtCurrency0(example.quarterly)}</div>
                    <div className={home.proofTileL}>per quarter</div>
                  </div>
                  <div className={home.proofTile}>
                    <div className={`${home.proofTileV} mono`}>{fmtCurrency0(example.halfYearly)}</div>
                    <div className={home.proofTileL}>per half-year</div>
                  </div>
                  <div className={`${home.proofTile} ${home.proofTileHighlight}`}>
                    <div className={`${home.proofTileV} mono`}>{fmtCurrency0(example.annual)}</div>
                    <div className={home.proofTileL}>per year</div>
                  </div>
                </div>
                <div className={home.proofNote}>
                  By switching from the Victorian Default Offer to the cheapest comparable market plan on their
                  network. Your own saving depends on your actual usage and bill — check yours below for your
                  real number, broken down the same way.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.sectionGap}>
          <div className={styles.resultsHead}>
            <h2>How it works</h2>
          </div>
          <div className={styles.howSteps}>
            <ScrollReveal className={styles.howStepCard}>
              <div className={home.howIcon}>
                <IconCamera />
              </div>
              <h3>Snap or upload your bill</h3>
              <p>
                Take a photo, or upload a photo or PDF — we read the numbers off it for you. Prefer to type it
                in yourself? That works too.
              </p>
            </ScrollReveal>
            <ScrollReveal className={styles.howStepCard} delayMs={120}>
              <div className={`${home.howIcon} ${home.howIconTeal}`}>
                <IconChart />
              </div>
              <h3>See your cheapest options, by period</h3>
              <p>
                We check your usage against every current plan we can see live from Victorian retailers and
                show what switching saves — per quarter, half-year, and year — free, no sign-up.
              </p>
            </ScrollReveal>
            <ScrollReveal className={styles.howStepCard} delayMs={240}>
              <div className={`${home.howIcon} ${home.howIconAmber}`}>
                <IconBell />
              </div>
              <h3>Stay on the cheapest plan, automatically</h3>
              <p>
                Not fussed on checking back yourself? Subscribe to ongoing monitoring and we&apos;ll email you
                the moment something cheaper shows up for your area.
              </p>
            </ScrollReveal>
          </div>

          <ScrollReveal className={home.howSummary} delayMs={320}>
            <div className={home.howSummaryText}>
              <strong>The short version:</strong> checking is always free, every result is broken down by
              quarter, half-year and year so it actually means something — and if you&apos;d rather not keep
              checking yourself, we can do it for you automatically.
            </div>
            <Link href="/check" className={styles.heroCta}>
              Check my bill now →
            </Link>
          </ScrollReveal>
        </section>

        <section className={styles.sectionGap}>
          <div className={styles.trustBadges}>
            <div className={styles.trustBadge}>
              <div className={home.badgeIcon}>
                <IconShield />
              </div>
              <strong>Independent.</strong> VIC Energy Check is a privately run comparison service. We&apos;re
              not affiliated with, operated by, or endorsed by the Victorian Government or its &ldquo;Victorian
              Energy Compare&rdquo; service — our results are our own calculations from each retailer&apos;s
              published data.
            </div>
            <div className={styles.trustBadge}>
              <div className={`${home.badgeIcon} ${home.badgeIconTeal}`}>
                <IconLock />
              </div>
              <strong>Private.</strong> We only use the bill details you give us to calculate your result. We
              never sell or share your information with anyone.
            </div>
            <div className={styles.trustBadge}>
              <div className={`${home.badgeIcon} ${home.badgeIconAmber}`}>
                <IconEye />
              </div>
              <strong>Transparent.</strong> See what you&apos;d pay on every comparable plan, not just one
              &ldquo;recommended&rdquo; deal — and what it adds up to by quarter, half-year, and year.
            </div>
          </div>
        </section>

        <section className={styles.sectionGap} id="monitoring">
          <ScrollReveal className={home.monitoringPanel}>
            <div className={styles.resultsHead}>
              <h2>Ongoing monitoring &amp; alerts</h2>
            </div>
            <p className={styles.lede} style={{ maxWidth: 640, fontSize: 14 }}>
              The comparison above always stays free. On top of it, you can subscribe — monthly, quarterly,
              half-yearly, or a once-off payment — and we&apos;ll keep watching the market and email you the
              moment something cheaper appears, instead of you having to come back and check.
            </p>
            <div className={styles.pricingGrid} style={{ marginTop: 18 }}>
              {PRICING_PLANS.map((plan, i) => (
                <ScrollReveal key={plan.id} className={styles.pricingCard} delayMs={i * 90}>
                  <div className={styles.pricingName}>{plan.name}</div>
                  <div className={styles.pricingPrice}>
                    {fmtPrice(plan.priceCents)}
                    <span className={styles.pricingCadence}>{plan.cadenceLabel}</span>
                  </div>
                  <div className={styles.pricingBlurb}>{plan.blurb}</div>
                </ScrollReveal>
              ))}
            </div>
            <Link href="/check#pricing" className={styles.heroCta} style={{ marginTop: 18 }}>
              Check my bill to get started →
            </Link>
          </ScrollReveal>
        </section>

        <footer className={styles.footer}>
          <div className={styles.fbrand}>VIC Energy Check</div>
          <p>
            An independent comparison tool for Victorian residential electricity customers, not affiliated with
            the Victorian Government or any official energy comparison service. Plan data is pulled from each
            retailer&apos;s own Consumer Data Right (CDR) product reference feed and reflects each retailer&apos;s
            most recently published rates; always confirm final pricing with the retailer before switching. This
            tool does not sell or transfer energy and is not an authorised retailer. The example above is
            illustrative, calculated from a typical ~4,000kWh/year single-rate household against each
            network&apos;s Victorian Default Offer — it is not a quote for any individual household.
          </p>
        </footer>
      </div>
    </>
  );
}

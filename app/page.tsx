import { pageMeta } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { PLANS } from "@/lib/plans";
import { ABOUT, hasFounderStory } from "@/lib/about";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import { findPlan, fmtPrice, savePct, type PricingPlan } from "@/lib/pricingPlans";
import SiteHeader from "./components/SiteHeader";
import StateWaitlist from "./components/StateWaitlist";
import Reveal from "./components/Reveal";
import Icon from "./components/Icon";
import SourceBanner from "./components/SourceBanner";
import MarketBoard from "./components/MarketBoard";
import NbnNotify from "./components/NbnNotify";
import { GAS_PLANS, GAS_RETAILER_COUNT, gasDataReady } from "@/lib/gasPlans";
import styles from "./components/Comparator.module.css";
import h from "./home2.module.css";

export const metadata = pageMeta({ title: "Utilo: compare Victorian electricity plans against your own bill", description: "Bill keeps creeping up? Snap your Victorian electricity bill and see which plans would cost less for your home, priced on your own usage and rates. Free check, no sign-up.", path: "/", absoluteTitle: true });

const RETAILER_COUNT = new Set(PLANS.map((p) => p[0])).size;
// Gas plans are listed once per network: count each plan once.
const GAS_PLAN_COUNT = new Set(GAS_PLANS.map((p) => `${p[0]}|${p[2]}`)).size;
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");
// Prices from the price list so the home page never drifts from checkout.
const MONTHLY = findPlan("monthly") as PricingPlan;
const ANNUAL = findPlan("annual") as PricingPlan;
const ANNUAL_SAVE = savePct(ANNUAL);

// Re-render a few times a day so the "last 30 days" board stays current between deploys.
export const revalidate = 21600;

// Who we are, for search engines (Google's "Organization" and "WebSite").
// Business details are added automatically once they're filled in lib/about.ts.
function structuredData() {
  const org: Record<string, unknown> = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: ABOUT.businessName || SITE_NAME,
    alternateName: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon`,
    description: "Independent electricity and gas plan comparison for Victorian households, priced against your own bill.",
    areaServed: { "@type": "State", name: "Victoria, Australia" },
  };
  if (ABOUT.contactEmail) org.email = ABOUT.contactEmail;
  if (ABOUT.abn) org.taxID = `ABN ${ABOUT.abn}`;
  return {
    "@context": "https://schema.org",
    "@graph": [org, { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: SITE_URL, inLanguage: "en-AU", publisher: { "@id": `${SITE_URL}/#organization` } }],
  };
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }} />
      <SiteHeader active="home" />

      <main className={h.page}>
        <SourceBanner />

        {/* 1. The hook, with the membership right beside it (straight under it on a phone) */}
        <section className={h.heroTop}>
          <div className={h.heroText}>
            <p className={h.eyebrow}>Built from your bill</p>
            <h1 className={h.title}>Bills creeping up?</h1>
            <p className={h.lede}>
              Start saving with one bill. We show what you&apos;re really paying against {PLANS.length} plans from {RETAILER_COUNT} retailers.
            </p>
            <div className={h.actions}>
              <Link href="/check" className={h.primary}>
                <Icon name="camera" size={20} /> Let&apos;s start saving
              </Link>
              <Link href="/check?start=questions" className={h.secondary}>No bill? Estimate it</Link>
            </div>
            <p className={h.fine}>Free, no sign-up, about a minute. <Link href="/gas">Gas bill?</Link></p>
          </div>

          <aside className={h.memberCard} aria-labelledby="membership-title">
            <p className={h.memberEyebrow}>Membership · electricity and gas</p>
            <h2 id="membership-title" className={h.memberPrice}>
              {fmtPrice(MONTHLY.priceCents)}<small> a month</small>
            </h2>
            <p className={h.memberAlt}>
              or <b>{fmtPrice(ANNUAL.priceCents)} a year</b>, less than $1 a week
              {ANNUAL_SAVE ? <span className={h.saveTag}>Save {ANNUAL_SAVE}%</span> : null}
            </p>
            <ul className={h.memberTicks}>
              <li><Icon name="check" size={18} /> Every plan re-checked against your bill, every morning</li>
              <li><Icon name="check" size={18} /> An email only when switching is worth it</li>
              <li><Icon name="check" size={18} /> Warned before a discount or fixed price ends</li>
            </ul>
            <Link href="/check" className={h.memberCta}>Start with the free check</Link>
            <Link href="/pricing" className={h.memberGhost}>What&apos;s included</Link>
            <p className={h.memberFine}>The check is free. Cancel any time.</p>
          </aside>
        </section>

        {/* 2. One membership, every household bill: what's live and what's next */}
        <section className={h.utilStrip} aria-labelledby="util-strip-title">
          <p className={h.eyebrow}>One membership, every household bill</p>
          <h2 id="util-strip-title" className={h.h2}>Electricity and gas today. Internet next.</h2>
          <Reveal className={h.utilCards}>
            <article className={h.utilCard} style={{ "--n": 0 } as CSSProperties}>
              <div className={h.utilHead}>
                <span className={`${h.utilIcon} ${h.utilElec}`}><Icon name="bolt" size={22} /></span>
                <b>Electricity</b>
                <span className={h.utilLive}><i aria-hidden="true" /> Live</span>
              </div>
              <p>Snap a bill. {PLANS.length} plans from {RETAILER_COUNT} retailers priced on your real usage, re-checked every morning, and 30 days&apos; warning before a discount ends.</p>
              <Link href="/check" className={h.utilLink}>Check my electricity bill <span aria-hidden="true">→</span></Link>
            </article>
            <article className={h.utilCard} style={{ "--n": 1 } as CSSProperties}>
              <div className={h.utilHead}>
                <span className={`${h.utilIcon} ${h.utilGas}`}><Icon name="flame" size={22} /></span>
                <b>Gas</b>
                <span className={h.utilLive}><i aria-hidden="true" /> Live</span>
              </div>
              <p>A gas or dual-fuel bill works.{gasDataReady ? ` ${GAS_PLAN_COUNT} plans from ${GAS_RETAILER_COUNT} retailers.` : ""} Victoria has no default offer for gas, so your own bill is the yardstick, and we flag when a dual-fuel discount beats the gap.</p>
              <Link href="/gas" className={h.utilLink}>Check my gas bill <span aria-hidden="true">→</span></Link>
            </article>
            <article className={`${h.utilCard} ${h.utilSoonCard}`} style={{ "--n": 2 } as CSSProperties}>
              <div className={h.utilHead}>
                <span className={`${h.utilIcon} ${h.utilNbn}`}><Icon name="wifi" size={22} /></span>
                <b>Internet (NBN)</b>
                <span className={h.utilSoon}>Coming</span>
              </div>
              <p>Same idea: snap your internet bill, we check the speed tier you&apos;re on against every provider&apos;s price, and tell you before a promo rolls off. Members get it first, at no extra cost.</p>
              <NbnNotify />
            </article>
          </Reveal>
        </section>

        {/* 3. Live: how much the market changed in the last 30 days (hidden until the daily pull has dated offers) */}
        <MarketBoard compact />

        {/* 4. When members hear from us: four promises */}
        <section className={h.section}>
          <p className={h.eyebrow}>Membership</p>
          <h2 className={h.h2}>You stop checking. We never do.</h2>
          <p className={h.lede2}>Retailers change their offers every week. Your bill gets re-priced against all {PLANS.length} plans we track, every single morning, and you hear from us only when it pays to move.</p>
          <Reveal as="ul" className={h.promises}>
            <li style={{ "--n": 0 } as CSSProperties}>
              <span className={h.promiseIcon}><Icon name="refresh" size={22} /></span>
              <b>Every morning, while you sleep</b>
              <span>Your bill, re-priced against every plan we track. Seven days a week, forever.</span>
            </li>
            <li style={{ "--n": 1 } as CSSProperties}>
              <span className={h.promiseIcon}><Icon name="bell" size={22} /></span>
              <b>30 days&apos; warning</b>
              <span>Discounts and fixed prices end quietly. Yours won&apos;t. We tell you a month out.</span>
            </li>
            <li style={{ "--n": 2 } as CSSProperties}>
              <span className={h.promiseIcon}><Icon name="calendar" size={22} /></span>
              <b>1 July, handled</b>
              <span>When retailers reprice for the new year, you&apos;re re-checked as soon as the new prices land.</span>
            </li>
            <li style={{ "--n": 3 } as CSSProperties}>
              <span className={h.promiseIcon}><Icon name="mail" size={22} /></span>
              <b>No news is good news</b>
              <span>An email only when a switch saves you {money(WORTH_SWITCHING_PER_YEAR)}+ a year. Set your own bar if you like.</span>
            </li>
          </Reveal>
          <p className={h.note}>
            Used Victorian Energy Compare? Good, it finds the best deal on the day. We start from your bill and keep checking.{" "}
            <Link href="/learn#compare">How the two fit together</Link>
          </p>
        </section>

        {/* 4. How it works, in three pictures */}
        <section className={h.section}>
          <h2 className={h.h2}>How it works</h2>
          <Reveal as="ol" className={h.steps}>
            <li className={h.step} style={{ "--n": 0 } as CSSProperties}>
              <div className={h.shot}><Image src="/images/product/1-photo.png" alt="The check opens on a button to take a photo of your bill" width={390} height={780} /></div>
              <span className={h.num}>1</span>
              <h3>Take a photo of your bill</h3>
              <p>Paper, PDF or an app screenshot. No bill? Answer a few questions instead.</p>
            </li>
            <li className={h.step} style={{ "--n": 1 } as CSSProperties}>
              <div className={h.shot}><Image src="/images/product/2-read.png" alt="What we read from the bill: network, days, usage, total and rates" width={390} height={780} /></div>
              <span className={h.num}>2</span>
              <h3>Check what we read</h3>
              <p>Your usage, bill total and rates, in plain English. Fix anything that looks wrong.</p>
            </li>
            <li className={h.step} style={{ "--n": 2 } as CSSProperties}>
              <div className={h.shot}><Image src="/images/product/3-result.png" alt="The result: the cheapest plan and the yearly saving (example bill)" width={390} height={780} /></div>
              <span className={h.num}>3</span>
              <h3>See whether to switch</h3>
              <p>The cheapest plan for how you use power and what it saves in a year. Example bill shown.</p>
            </li>
          </Reveal>
        </section>

        {hasFounderStory && (
          <section className={h.section}>
            <div className={h.founder}>
              {ABOUT.photo && (
                <div className={h.founderPhoto}><Image src={ABOUT.photo} alt={ABOUT.founderName} width={160} height={160} /></div>
              )}
              <div>
                <h2 className={h.h2}>Why I built this</h2>
                {ABOUT.story.map((para, i) => <p key={i} className={h.story}>{para}</p>)}
                <p className={h.sign}>{ABOUT.founderName}, {ABOUT.founderRole}</p>
              </div>
            </div>
          </section>
        )}

        <section className={h.section} id="waitlist">
          <StateWaitlist />
        </section>

        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            {ABOUT.businessName || ABOUT.abn || ABOUT.location ? (
              <>
                {[ABOUT.businessName, ABOUT.abn ? `ABN ${ABOUT.abn}` : "", ABOUT.location].filter(Boolean).join(" · ")}.{" "}
              </>
            ) : null}
            Independent: not affiliated with the Victorian Government or any retailer, and we take no money from retailers. Prices come from retailers&apos;
            published plans (their Consumer Data Right feeds), checked every day. Estimates only: confirm the price with the retailer before you switch.
          </p>
          <p>
            <Link href="/pricing">Pricing</Link> · <Link href="/learn">How it works</Link> · <Link href="/faq">FAQ</Link> ·{" "}
            <Link href="/default-offer">About the default offer</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/cancellation-policy">Cancellation</Link> · <Link href="/terms">Terms</Link>
          </p>
        </footer>
      </main>
    </>
  );
}

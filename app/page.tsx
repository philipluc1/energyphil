import { pageMeta } from "@/lib/seo";
import { GAS_PLANS } from "@/lib/gasPlans";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import Image from "next/image";
import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { ABOUT, hasFounderStory } from "@/lib/about";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import { PLUS_NAME, perWeekWords } from "@/lib/pricingPlans";
import { marketActivity } from "@/lib/marketActivity";
import { typicalHouseholdExample } from "@/lib/savings";
import SiteHeader from "./components/SiteHeader";
import Wordmark from "./components/Wordmark";
import StateWaitlist from "./components/StateWaitlist";
import Icon from "./components/Icon";
import CountUp from "./components/CountUp";
import InfoTip from "./components/InfoTip";
import SourceBanner from "./components/SourceBanner";
import PlanBand from "./components/PlanBand";
import MemberGets from "./components/MemberGets";
import JoinDirect from "./components/JoinDirect";
import PostcodeStart from "./components/PostcodeStart";
import { StepsVisual } from "./learn/LearnVisuals";
import h from "./home3.module.css";
import SiteFooter from "./components/SiteFooter";

// 7 Nov 2026: the Google snippet. A title under 60 characters that says what you get, and a
// description that reads like the page (Google swaps in footer text when the two don't match).
export const metadata = pageMeta({
  title: "Utilo: free power and gas bill check for Victorian homes",
  description: "Snap your electricity or gas bill and see the cheapest plan for your home in about a minute, priced on your own usage. Free, no account, no calls. Utilo Plus re-checks it every morning.",
  path: "/",
  absoluteTitle: true,
});

const RETAILER_COUNT = new Set(PLANS.map((p) => p[0])).size;
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

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
  const sameAs = Object.values(ABOUT.socials).filter((u) => /^https:\/\//.test(u));
  if (sameAs.length) org.sameAs = sameAs;
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      // The site name Google shows above the title (7 Nov 2026): "Utilo", not "utilo.com.au".
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, alternateName: ["Utilo Australia", "utilo.com.au"], url: SITE_URL, inLanguage: "en-AU", publisher: { "@id": `${SITE_URL}/#organization` } },
      {
        "@type": "WebApplication",
        name: "Utilo bill check",
        url: `${SITE_URL}/check`,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        description: "Upload a Victorian electricity or gas bill and see which plan is cheapest for your home.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
      },
    ],
  };
}

export default function Home() {
  const ex = typicalHouseholdExample();
  const bench = Math.round(ex.annualBench);
  const best = Math.round(ex.annualBest);
  const market = marketActivity({ days: 30 });
  const changed = market.newOffers + market.priceChanges;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }} />
      <SiteHeader active="other" still />

      <main className={h.page}>
        <SourceBanner />

        {/* 1. The intro (11 Nov 2026, Phil): the animated logo, as in the logo video, then the two
            ways to start in the middle of the screen. Everything else is a scroll away. */}
        <section className={h.intro} aria-labelledby="home-h1">
          <div className={h.introLogo}><Wordmark ink="#FFFFFF" animate="hero" /></div>
          <h1 id="home-h1" className={h.introH1}>
            Stop overpaying. <span className={h.introAccent}>Start saving.</span>
          </h1>
          <div className={h.introCard}>
            <Link href="/check" className={h.primary}>
              <Icon name="camera" size={20} /> Snap my bill, free
            </Link>
            {/* No bill to hand: the postcode, then a few questions. */}
            <div className={h.pcStart}><PostcodeStart /></div>
            <p className={h.gasLine}>Power or gas bill, PDF or photo. We work out which.</p>
          </div>
          <a href="#steps" className={h.scrollCue}>
            How it works <span aria-hidden="true">↓</span>
          </a>
        </section>

        {/* 2. Three numbers, no paragraph. */}
        <ul className={h.stats} data-motion="" data-stagger=":scope > li">
          <li className={h.stat}>
            <span className={`${h.statIcon} ${h.siPlans}`}><Icon name="search" size={20} /></span>
            <span className={h.statText}><b className={h.statNum}><CountUp value={PLANS.length + GAS_PLANS.length} /></b><span className={h.statLabel}>power and gas plans</span></span>
          </li>
          <li className={h.stat}>
            <span className={`${h.statIcon} ${h.siRetailers}`}><Icon name="bolt" size={20} /></span>
            <span className={h.statText}><b className={h.statNum}><CountUp value={RETAILER_COUNT} /></b><span className={h.statLabel}>retailers compared</span></span>
          </li>
          <li className={h.stat}>
            <span className={`${h.statIcon} ${h.siDaily}`}><Icon name="refresh" size={20} /></span>
            <span className={h.statText}><b className={h.statNum}>Daily</b><span className={h.statLabel}><span className={h.liveDot} aria-hidden="true" /> prices updated</span></span>
          </li>
          {market.ready && changed > 0 && (
            <li className={`${h.stat} ${h.statLink}`}>
              <Link href="/market">
                <span className={`${h.statIcon} ${h.siMarket}`}><Icon name="chart" size={20} /></span>
                <span className={h.statText}><b className={h.statNum}><CountUp value={changed} /></b><span className={h.statLabel}>changes in 30 days →</span></span>
              </Link>
            </li>
          )}
        </ul>

        {/* 3. How it works, as pictures. */}
        <section id="steps" className={h.section} data-motion="" data-stagger="h2, li">
          <h2 className={h.h2}>Three Easy Steps</h2>
          <StepsVisual />
        </section>

        {/* 3a. What a check shows (moved down from the top, 11 Nov 2026). */}
        <section className={`${h.section} ${h.exampleSec}`} data-motion="">
          <h2 className={h.h2}>What you&apos;ll see</h2>
          <div className={h.exampleWrap}>
            {/* A bill being read, line by line: what the check does, as a picture. Example figures, labelled. */}
            <div className={h.heroArt} aria-label="Example: a typical home's quarterly bill, checked">
              <div className={h.readCard}>
                <div className={h.readHead}>
                  <span className={h.readTitle}><Icon name="camera" size={14} /> Reading your bill</span>
                  <span className={h.readTag}>Example</span>
                </div>
                <div className={h.readScan} aria-hidden="true" />
                <dl className={h.readRows}>
                  <div><dt>Period</dt><dd>91 days</dd></div>
                  <div><dt>Usage</dt><dd>{Math.round(ex.annualUsageKwh * 91 / 365).toLocaleString("en-AU")} kWh</dd></div>
                  <div><dt>Retailers compared</dt><dd>{RETAILER_COUNT}</dd></div>
                  <div className={h.readRule} />
                  <div><dt>Your bill</dt><dd>{money(bench * 91 / 365)}</dd></div>
                  <div className={h.readBest}><dt>Cheapest plan</dt><dd>{money(best * 91 / 365)} <span aria-hidden="true">✓</span></dd></div>
                </dl>
                <div className={h.readSave}><span>You save</span><b>{money(Math.max(0, bench - best))} a year</b></div>
                <div className={h.readFoot}><Icon name="refresh" size={14} /> Re-checked every morning with {PLUS_NAME}</div>
              </div>
              <span className={h.rcFoot}>
                Typical home, 4,000 kWh a year, on the default offer
                <InfoTip label="About this example">Averaged across Victoria&apos;s five networks on today&apos;s prices, single-rate plans, pay-on-time discounts included. Your bill gives your own number.</InfoTip>
              </span>
            </div>
          </div>
        </section>

        {/* 3b. What members get (1 Nov 2026). */}
        <MemberGets />

        {/* 4. Utilo Plus, front and centre, with direct checkout. */}
        <PlanBand
          id="plus"
          title="Stop paying the loyalty tax."
          intro={<>We watch your power and gas every day, from your own bill, for {perWeekWords()}.</>}
          cards={<JoinDirect cancelPath="/" />}
        />

        {/* 5. Questions, folded. */}
        <section className={h.section} data-motion="" data-stagger="h2, details">
          <h2 className={h.h2}>Quick answers</h2>
          <div className={h.faq}>
            <details>
              <summary>Is the check really free?</summary>
              <p>Yes, every time. You see how much you&apos;d save and every plan by name, and you can email yourself the result. Your first bill photo is free; after that, one free photo a quarter with your email (or type the numbers in, always free). {PLUS_NAME} keeps watching after that: every plan re-checked each morning, and a warning before your discount ends.</p>
            </details>
            <details>
              <summary>How do you make money?</summary>
              <p>From {PLUS_NAME}, and nothing else. We take no money from retailers, so every plan is priced with the same formula.</p>
            </details>
            <details>
              <summary>What does {PLUS_NAME} do that the free check doesn&apos;t?</summary>
              <p>It re-prices every plan against your bill each morning, emails you only when switching saves {money(WORTH_SWITCHING_PER_YEAR)}+ a year, and warns you a month before a discount or fixed price ends.</p>
            </details>
            <details>
              <summary>Where do the prices come from?</summary>
              <p>Retailers&apos; own published plans (the Consumer Data Right feeds, the same source as Energy Made Easy), pulled every day. <Link href="/learn#data">More on our data</Link></p>
            </details>
            <details>
              <summary>How is this different from Victorian Energy Compare?</summary>
              <p>It finds the best deal on the day. We start from a photo of your bill and keep checking after. Using both is a good idea. <Link href="/learn#compare">Side by side</Link></p>
            </details>
            <details>
              <summary>Not in Victoria?</summary>
              <div className={h.waitlist}><StateWaitlist compact /></div>
            </details>
          </div>
        </section>

        {hasFounderStory && (
          <section className={h.section}>
            <div className={h.founder}>
              {ABOUT.photo && (
                <div className={h.founderPhoto}><Image src={ABOUT.photo} alt={ABOUT.founderName} width={120} height={120} /></div>
              )}
              <div>
                <h2 className={h.h2}>Why I built this</h2>
                {ABOUT.story.map((para, i) => <p key={i} className={h.story}>{para}</p>)}
                <p className={h.sign}>{ABOUT.founderName}, {ABOUT.founderRole}</p>
              </div>
            </div>
          </section>
        )}

        <SiteFooter />
      </main>
    </>
  );
}

import { pageMeta } from "@/lib/seo";
import { GAS_PLANS } from "@/lib/gasPlans";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import Image from "next/image";
import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { ABOUT, hasFounderStory } from "@/lib/about";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import { PLUS_NAME } from "@/lib/pricingPlans";
import { marketActivity } from "@/lib/marketActivity";
import { savingsByNetwork, typicalHouseholdExample } from "@/lib/savings";
import SiteHeader from "./components/SiteHeader";
import StateWaitlist from "./components/StateWaitlist";
import Icon from "./components/Icon";
import CountUp from "./components/CountUp";
import InfoTip from "./components/InfoTip";
import SourceBanner from "./components/SourceBanner";
import PlanBand from "./components/PlanBand";
import MemberGets from "./components/MemberGets";
import JoinDirect from "./components/JoinDirect";
import { StepsVisual } from "./learn/LearnVisuals";
import h from "./home3.module.css";
import SiteFooter from "./components/SiteFooter";

export const metadata = pageMeta({ title: "Utilo: compare Victorian electricity plans against your own bill", description: "Bill keeps creeping up? Snap your Victorian electricity bill and see your savings: which plans would cost less for your home, priced on your own usage and rates. Free check, no sign-up.", path: "/", absoluteTitle: true });

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
  return {
    "@context": "https://schema.org",
    "@graph": [org, { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: SITE_URL, inLanguage: "en-AU", publisher: { "@id": `${SITE_URL}/#organization` } }],
  };
}

export default function Home() {
  const ex = typicalHouseholdExample();
  const bench = Math.round(ex.annualBench);
  const best = Math.round(ex.annualBest);
  const market = marketActivity({ days: 30 });
  const changed = market.newOffers + market.priceChanges;
  // "Up to" today's saving for the average home: the biggest of the five networks.
  const nets = savingsByNetwork();
  const topSave = nets[0] ?? null;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }} />
      <SiteHeader active="other" />

      <main className={h.page}>
        <SourceBanner />

        {/* 1. The hook: one line, one button. */}
        <section className={h.hero}>
          <div className={h.heroText}>
            <span className={h.kicker}><Icon name="bolt" size={14} /> Victorian homes · electricity and gas</span>
            <h1 className={h.h1}>
              Stop overpaying.
              <br />
              <span className={h.h1Accent}>Start saving.</span>
            </h1>
            <p className={h.lede}>Snap your bill. See your savings.</p>
            {topSave && topSave.save >= 1 && (
              <div className={h.savePill}>
                <span className={h.saveDot} aria-hidden="true" />
                <span>
                  Savings on today&apos;s prices: <b>up to $<CountUp value={Math.round(topSave.save)} /> a year</b>
                </span>
                <InfoTip label="About these savings">
                  For the average Victorian home (4,000 kWh a year), the cheapest plan against the default offer, on each network today:{" "}
                  {nets.map((n, i) => <span key={n.network}>{i > 0 ? ", " : ""}{n.network} {money(n.save)}</span>)}. Re-worked every time prices change. Snap your bill for your own figure.
                </InfoTip>
              </div>
            )}
            <div className={h.ctas}>
              <Link href="/check" className={h.primary}>
                <Icon name="camera" size={20} /> Snap my bill, free
              </Link>
              <Link href="/check?start=questions" className={h.ghost}>No bill? Use the average home</Link>
            </div>
            {/* Internet ("Soon") is hidden for now: electricity and gas are the offer. */}
            <ul className={h.fuelsHero} aria-label="Bills we check">
              <li>
                <Link href="/check" className={`${h.fuelCard} ${h.fuelCardElec}`}>
                  <span className={h.fElec}><Icon name="bolt" size={20} /></span>
                  <span className={h.fuelCardText}><b>Electricity</b><small>Check my power bill</small></span>
                  <span className={h.fuelGo} aria-hidden="true">→</span>
                </Link>
              </li>
              <li>
                <Link href="/gas" className={`${h.fuelCard} ${h.fuelCardGas}`}>
                  <span className={h.fGas}><Icon name="flame" size={20} /></span>
                  <span className={h.fuelCardText}><b>Gas</b><small>Check my gas bill</small></span>
                  <span className={h.fuelGo} aria-hidden="true">→</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className={h.heroArt} aria-label="Example result for a typical Victorian home">
            <div className={h.resultCard}>
              <span className={h.rcTag}>Example result</span>
              <div className={h.rcRow}><span>Default offer</span><b>{money(bench)}<small>/yr</small></b></div>
              <div className={h.rcRow}><span>Cheapest plan</span><b className={h.rcGood}>{money(best)}<small>/yr</small></b></div>
              <div className={h.rcSave}>Save {money(Math.max(0, bench - best))} a year</div>
              <div className={h.rcWatch}><Icon name="refresh" size={15} /> Re-checked every morning with {PLUS_NAME}</div>
            </div>
            <span className={h.rcFoot}>
              Typical home, 4,000 kWh a year
              <InfoTip label="About this example">Averaged across Victoria&apos;s five networks on today&apos;s prices, single-rate plans, pay-on-time discounts included. Your bill gives your own number.</InfoTip>
            </span>
          </div>
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
        <section className={h.section} data-motion="" data-stagger="h2, li">
          <h2 className={h.h2}>Three steps</h2>
          <StepsVisual />
        </section>

        {/* 3b. What members get (1 Nov 2026). */}
        <MemberGets />

        {/* 4. Utilo Plus, front and centre, with direct checkout. */}
        <PlanBand
          id="plus"
          title="Join Utilo Plus. We keep watching."
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

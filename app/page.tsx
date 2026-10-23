import Image from "next/image";
import Link from "next/link";
import { PLANS, PLAN_DATA_DATE } from "@/lib/plans";
import { THREE_HOMES_NETWORK, threeHomesExample } from "@/lib/savings";
import { ABOUT, hasFounderStory } from "@/lib/about";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import { findPlan, fmtPrice, savePct, type PricingPlan } from "@/lib/pricingPlans";
import SiteHeader from "./components/SiteHeader";
import StateWaitlist from "./components/StateWaitlist";
import Icon from "./components/Icon";
import SourceBanner from "./components/SourceBanner";
import MarketPulse from "./components/MarketPulse";
import MarketBoard from "./components/MarketBoard";
import styles from "./components/Comparator.module.css";
import h from "./home2.module.css";

const RETAILER_COUNT = new Set(PLANS.map((p) => p[0])).size;
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");
// Prices from the price list so the home page never drifts from checkout.
const MONTHLY = findPlan("monthly") as PricingPlan;
const ANNUAL = findPlan("annual") as PricingPlan;
const ANNUAL_SAVE = savePct(ANNUAL);

function fmtDate(): string {
  return new Date(PLAN_DATA_DATE + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

// Re-render a few times a day so the "last 30 days" board stays current between deploys.
export const revalidate = 21600;

export default function Home() {
  const homes = threeHomesExample();
  const typical = homes.find((x) => x.key === "typical");
  const savings = homes.map((x) => x.saving);
  const lowSave = Math.min(...savings);
  const highSave = Math.max(...savings);

  return (
    <>
      <SiteHeader active="home" />

      <main className={h.page}>
        <SourceBanner />

        {/* 1. The hook: built for your home, not a typical one */}
        <section className={h.hero}>
          <div className={h.heroText}>
            <p className={h.eyebrow}>Built from your bill, not a typical household</p>
            <h1 className={h.title}>Small, medium or large? Your home is none of them.</h1>
            <p className={h.lede}>
              A &ldquo;typical household&rdquo; estimate can be hundreds of dollars out. Utilo reads your bill instead: how much power you use and when,
              the rates you pay now, and the plan you&apos;re on. Then it prices the {PLANS.length} plans we track from {RETAILER_COUNT} retailers for{" "}
              <em>your</em> home, and tells you plainly whether switching is worth it.
            </p>
            <div className={h.actions}>
              <Link href="/check" className={h.primary}>
                <Icon name="camera" size={20} /> Price my bill
              </Link>
              <Link href="/check?start=questions" className={h.textLink}>No bill? We&apos;ll estimate from a few questions</Link>
            </div>
            <p className={h.fine}>Free, no sign-up, about a minute. Gas too: <Link href="/gas">check a gas bill</Link>.</p>
          </div>
          <div className={h.heroShot}>
            <div className={h.phone}>
              <Image src="/images/product/3-result.png" alt="A Utilo result on a phone: you could save about $293 a year on the cheapest plan" width={390} height={780} priority />
            </div>
            <p className={h.caption}>A result from the check, using an example bill.</p>
          </div>
        </section>

        {/* 1b. Live: how much the market changed in the last 30 days (hidden until the daily pull has dated offers) */}
        <MarketBoard />

        {/* 2. How it works (straight after the hero, so people see the three steps first) */}
        <section className={h.section}>
          <h2 className={h.h2}>How it works</h2>
          <ol className={h.steps}>
            <li className={h.step}>
              <div className={h.shot}><Image src="/images/product/1-photo.png" alt="The check opens on a button to take a photo of your bill" width={390} height={780} /></div>
              <span className={h.num}>1</span>
              <h3>Take a photo of your bill</h3>
              <p>Paper, PDF or a screenshot from your retailer&apos;s app. No bill to hand? Answer a few questions about your home instead.</p>
            </li>
            <li className={h.step}>
              <div className={h.shot}><Image src="/images/product/2-read.png" alt="What we read from the bill: network, days, usage, total and rates" width={390} height={780} /></div>
              <span className={h.num}>2</span>
              <h3>Check what we read</h3>
              <p>Your network, usage, bill total and the rates you pay. Change anything that looks wrong before we work it out.</p>
            </li>
            <li className={h.step}>
              <div className={h.shot}><Image src="/images/product/3-result.png" alt="The result: the cheapest plan and the yearly saving" width={390} height={780} /></div>
              <span className={h.num}>3</span>
              <h3>See whether to switch</h3>
              <p>The cheapest plan for how you use power, what it saves in a year, and a link to the retailer. Switching is done with them, usually in about ten minutes.</p>
            </li>
          </ol>
        </section>

        {/* 3. What only a bill can tell us */}
        <section className={h.section}>
          <h2 className={h.h2}>Three things only your bill knows</h2>
          <p className={h.sub}>A typical-household estimate has to guess them. We read them.</p>
          <ul className={h.knows}>
            <li>
              <span className={`${h.knowIcon} ${h.kTeal}`}><Icon name="chart" size={22} /></span>
              <div>
                <h3>How you use power</h3>
                <p>Peak, off-peak, controlled load and solar.</p>
              </div>
            </li>
            <li>
              <span className={`${h.knowIcon} ${h.kAmber}`}><Icon name="receipt" size={22} /></span>
              <div>
                <h3>What you pay now</h3>
                <p>Your own rates, not a headline price.</p>
              </div>
            </li>
            <li>
              <span className={`${h.knowIcon} ${h.kNavy}`}><Icon name="tag" size={22} /></span>
              <div>
                <h3>Which plan you&apos;re on</h3>
                <p>Retailers reuse plan names. We&apos;ll tell you if yours is the dearer version.</p>
              </div>
            </li>
          </ul>
        </section>

        {/* 4. Proof: same prices, three homes, three answers */}
        {homes.length === 3 && typical && (
          <section className={h.section}>
            <h2 className={h.h2}>Same prices, three homes, three different answers</h2>
            <p className={h.sub}>
              A typical-household estimate would tell all three they save <b>{money(typical.saving)} a year</b>. Here&apos;s what each one really saves.
            </p>
            <ol className={h.homes}>
              {homes.map((x) => {
                const isTypical = x.key === "typical";
                const note = isTypical
                  ? "One figure for every home."
                  : x.differentPlan && x.typicalPickCostsMore === null
                    ? "Needs a different plan. The typical pick doesn't price its controlled load."
                    : x.differentPlan && (x.typicalPickCostsMore ?? 0) >= 1
                      ? `Needs a different plan. The typical pick costs it ${money(x.typicalPickCostsMore ?? 0)} a year more.`
                      : `Same plan as the typical home, but saves ${money(Math.abs(x.saving - typical.saving))} a year ${x.saving < typical.saving ? "less" : "more"}.`;
                return (
                  <li key={x.key} className={isTypical ? h.homeTypical : undefined}>
                    {isTypical && <span className={h.homeTag}>What a typical estimate assumes</span>}
                    <h3>{x.title}</h3>
                    <p className={h.homeDetail}>{isTypical ? x.detail : `${x.detail} · ${x.annualKwh.toLocaleString("en-AU")} kWh a year`}</p>
                    <div className={h.homeSave}>
                      <p><b>{money(x.saving)}</b> a year saved</p>
                      <span className={h.bar} aria-hidden="true"><span style={{ width: `${Math.max(8, Math.round((x.saving / highSave) * 100))}%` }} /></span>
                    </div>
                    <p className={h.homeNote}>{note}</p>
                  </li>
                );
              })}
            </ol>
            <p className={h.note}>
              Savings from switching to each home&apos;s cheapest plan, against the default offer on the {THREE_HOMES_NETWORK} network. Estimates from our household
              model, prices checked {fmtDate()}, pay-on-time discounts included. Your bill will be different again, which is why we read it.{" "}
              <Link href="/learn">How we price plans</Link>
            </p>
          </section>
        )}

        {/* 5. Why keep watching: offers never stop changing; members don't have to keep up */}
        <section className={h.section}>
          <h2 className={h.h2}>New offers every week. We check them every morning.</h2>
          <p className={h.sub}>
            Retailers launch plans, change prices, attach conditions to discounts and reuse old plan names all year. Keeping up is a part-time job.
            Members hand it to us: every plan is re-priced against your home each morning, and you hear from us only when switching is worth it.
          </p>
          <MarketPulse />
          <div className={h.trackLabel}>The confusing stuff we keep track of, so you don&apos;t have to</div>
          <ul className={h.chips}>
            <li>New plans</li>
            <li>Price changes</li>
            <li>Discounts and their conditions</li>
            <li>Older versions of plans with the same name</li>
            <li>Time-of-use and solar rates</li>
            <li>1 July price rises</li>
            <li>Your discount or fixed price ending</li>
          </ul>
          <div className={h.trackLabel}>You only hear from us when it matters</div>
          <ul className={h.watch}>
            <li><Icon name="bell" size={20} /><span><b>A month before</b> your discount or fixed price ends</span></li>
            <li><Icon name="calendar" size={20} /><span><b>After 1 July</b>, when retailers reprice</span></li>
            <li><Icon name="refresh" size={20} /><span><b>Whenever a plan</b> beats yours by {money(WORTH_SWITCHING_PER_YEAR)} a year or more (or the amount you choose)</span></li>
          </ul>
          <p className={h.note}>
            Used Victorian Energy Compare? Good: it&apos;s the Government&apos;s site and well worth a look. It finds the best deal on the day; we
            start from your bill and keep checking. <Link href="/learn#compare">How the two fit together</Link>.
          </p>
        </section>

        {/* 6. Price: lead with the small number */}
        <section className={h.section}>
          <div className={h.priceCard}>
            <div>
              <p className={h.priceEyebrow}>Membership · electricity and gas</p>
              <h2 className={h.priceTitle}>Never chase an energy deal again.</h2>
              <ul className={h.priceTicks}>
                <li><Icon name="check" size={18} /> Every plan re-checked against your bill, every morning</li>
                <li><Icon name="check" size={18} /> An email only when switching is worth it</li>
                <li><Icon name="check" size={18} /> Your discount or fixed price ending? We&apos;ll warn you</li>
              </ul>
            </div>
            <div className={h.priceBox}>
              <p className={h.bigPrice}>{fmtPrice(MONTHLY.priceCents)}<small> a month</small></p>
              <p className={h.priceAlt}>
                or <b>{fmtPrice(ANNUAL.priceCents)} a year</b>: less than $1 a week
                {ANNUAL_SAVE ? <span className={h.saveTag}>Save {ANNUAL_SAVE}%</span> : null}
              </p>
              <Link href="/check" className={h.primary}><Icon name="camera" size={20} /> Start with the free check</Link>
              <p className={h.priceFine}>The check is free. Cancel any time. <Link href="/pricing">What&apos;s included</Link></p>
            </div>
          </div>
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

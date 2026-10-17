import Image from "next/image";
import Link from "next/link";
import { PLANS, PLAN_DATA_DATE } from "@/lib/plans";
import { typicalHouseholdExample } from "@/lib/savings";
import { ABOUT, hasFounderStory } from "@/lib/about";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import SiteHeader from "./components/SiteHeader";
import StateWaitlist from "./components/StateWaitlist";
import Icon from "./components/Icon";
import styles from "./components/Comparator.module.css";
import h from "./home2.module.css";

const RETAILER_COUNT = new Set(PLANS.map((p) => p[0])).size;
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

function fmtDate(): string {
  return new Date(PLAN_DATA_DATE + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function Home() {
  const ex = typicalHouseholdExample();
  const gap = Math.max(0, ex.annualBench - ex.annualBest);

  return (
    <>
      <SiteHeader active="home" />

      <main className={h.page}>
        {/* 1. What it is */}
        <section className={h.hero}>
          <div className={h.heroText}>
            <p className={h.eyebrow}>For Victorian households</p>
            <h1 className={h.title}>Are you paying too much for electricity?</h1>
            <p className={h.lede}>
              Take a photo of your bill. We read what you use and what you pay, compare it with the {PLANS.length} plans we track from {RETAILER_COUNT} retailers,
              and tell you plainly whether switching is worth it.
            </p>
            <div className={h.actions}>
              <Link href="/check" className={h.primary}>
                <Icon name="camera" size={20} /> Check my bill
              </Link>
              <Link href="/check?start=questions" className={h.textLink}>No bill? Answer a few questions</Link>
            </div>
            <p className={h.fine}>Free, no sign-up. Gas too: <Link href="/gas">check a gas bill</Link>.</p>
          </div>
          <div className={h.heroShot}>
            <div className={h.phone}>
              <Image src="/images/product/3-result.png" alt="A Utilo result on a phone: you could save about $394 a year with Alinta Energy" width={390} height={780} priority />
            </div>
            <p className={h.caption}>A result from the check, using an example bill.</p>
          </div>
        </section>

        {/* 2. How it works */}
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

        {/* 3. A worked example */}
        <section className={h.section}>
          <h2 className={h.h2}>An example: a typical home on the default offer</h2>
          <p className={h.sub}>
            The Victorian Default Offer is the government-set price many households are still on. Here&apos;s what it costs against the cheapest plan we track.
          </p>
          <table className={h.table}>
            <tbody>
              <tr><th>Electricity used</th><td>{ex.annualUsageKwh.toLocaleString("en-AU")} kWh a year</td></tr>
              <tr><th>On the default offer</th><td>{money(ex.annualBench)} a year</td></tr>
              <tr><th>On the cheapest plan we track</th><td>{money(ex.annualBest)} a year</td></tr>
              <tr className={h.total}><th>Difference</th><td>{money(gap)} a year</td></tr>
            </tbody>
          </table>
          <p className={h.note}>
            Single-rate usage, averaged across Victoria&apos;s five networks, prices checked {fmtDate()}. Your bill will be different, which is why we read it.{" "}
            <Link href="/learn">How we price plans</Link>
          </p>
        </section>

        {/* 4. Why keep watching */}
        <section className={h.section}>
          <h2 className={h.h2}>Prices don&apos;t stay put</h2>
          <p className={h.sub}>
            Many discounts only last the first year, retailers change prices around 1 July, and new plans appear all the time. A plan that&apos;s cheapest
            today often isn&apos;t a year later. Members are re-checked every morning and hear from us only when it matters:
          </p>
          <ul className={h.watch}>
            <li><Icon name="bell" size={20} /><span><b>A month before</b> your discount or fixed price ends</span></li>
            <li><Icon name="calendar" size={20} /><span><b>After 1 July</b>, when retailers reprice</span></li>
            <li><Icon name="refresh" size={20} /><span><b>Whenever a plan</b> beats yours by {money(WORTH_SWITCHING_PER_YEAR)} a year or more</span></li>
          </ul>
          <p className={h.note}>
            Already use another comparison site? <Link href="/learn#compare">Here&apos;s how we fit alongside it</Link>.
          </p>
        </section>

        {/* 5. Price */}
        <section className={h.section}>
          <div className={h.price}>
            <div>
              <h2 className={h.h2}>$39 a year to keep it watched</h2>
              <p className={h.sub}>
                The check is free. Membership covers electricity and gas: re-checked every morning, an email only when switching is worth it, and a short
                summary each month. Or $7 a month. Cancel any time.
              </p>
            </div>
            <div className={h.priceActions}>
              <Link href="/check" className={h.primary}><Icon name="camera" size={20} /> Start with the free check</Link>
              <Link href="/pricing" className={h.textLink}>What&apos;s included</Link>
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
            published data; confirm with the retailer before switching.
          </p>
          <p>
            <Link href="/pricing">Pricing</Link> · <Link href="/learn">Learn</Link> · <Link href="/gas">Gas check</Link> · <Link href="/ev">EV calculator</Link> ·{" "}
            <Link href="/faq">FAQ</Link> · <Link href="/default-offer">About the default offer</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/cancellation-policy">Cancellation</Link> · <Link href="/terms">Terms</Link>
            {ABOUT.contactEmail ? <> · <a href={`mailto:${ABOUT.contactEmail}`}>{ABOUT.contactEmail}</a></> : null}
          </p>
        </footer>
      </main>
    </>
  );
}

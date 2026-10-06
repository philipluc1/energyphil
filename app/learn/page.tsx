import Link from "next/link";
import { DISTRIBUTORS, VDO, PLANS, PLAN_DATA_DATE, rankPlans, type Distributor } from "@/lib/plans";
import { VIDEOS, VDO_HISTORY, TIMELINE, SAVE_TIPS } from "@/lib/learnContent";
import { DATA_FACTS, PRICE_CHANGE_CLAUSE } from "@/lib/dataPolicy";
import PriceFlow from "../components/PriceFlow";
import SiteHeader from "../components/SiteHeader";
import VideoSlot from "../components/VideoSlot";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";
import learn from "./learn.module.css";
import { NetworkGapChart, RetailerRankChart, VdoHistoryChart, type NetworkGap, type RetailerRow } from "./LearnCharts";

export const metadata = {
  title: "How Utilo works | Utilo",
  description: "How Utilo works, how it differs from Victorian Energy Compare and the ESC, price trends, timelines and ways to save.",
};

// A typical home: 4,000 kWh a year, single rate. Illustrative only.
const USAGE = { days: 365, peak: 0, shoulder: 0, offpeak: 0, anytime: 4000, cl: 0 };

function buildCharts() {
  const gaps: NetworkGap[] = [];
  const byNetwork: Record<string, RetailerRow[]> = {};
  for (const d of DISTRIBUTORS as readonly Distributor[]) {
    const ranked = rankPlans(d, USAGE).filter((m) => m.plan[3] === "MARKET");
    if (!ranked.length) continue;
    gaps.push({ network: d, vdo: VDO[d].annual, best: Math.round(ranked[0].total) });
    const cheapest = new Map<string, number>();
    for (const m of ranked) {
      const r = m.plan[0];
      if (!cheapest.has(r)) cheapest.set(r, m.total);
    }
    const rows: RetailerRow[] = [...cheapest.entries()].map(([retailer, total]) => ({ retailer, total: Math.round(total) }));
    rows.push({ retailer: "Default offer (VDO)", total: VDO[d].annual, isVdo: true });
    rows.sort((a, b) => a.total - b.total);
    byNetwork[d] = rows;
  }
  return { gaps, byNetwork };
}

export default function LearnPage() {
  const { gaps, byNetwork } = buildCharts();
  const retailers = new Set(PLANS.map((p) => p[0])).size;
  return (
    <>
      <SiteHeader active="learn" />
      <div className={styles.wrap}>
        <section className={home.pageHead}>
          <h1>How Utilo works</h1>
          <p className={styles.lede}>Plain-English answers: what we do, how we&apos;re different, where prices are heading and how to pay less.</p>
          <div className={learn.chips}>
            <a href="#compare">VEC &amp; ESC</a>
            <a href="#videos">Videos</a>
            <a href="#charts">Price charts</a>
            <a href="#timeline">Timeline</a>
            <a href="#save">Ways to save</a>
            <a href="#data">Our data</a>
            <Link href="/ev">EV calculator</Link>
          </div>
        </section>

        <section id="how" className={learn.block}>
          <h2 className={home.h2}>Three steps</h2>
          <ol className={learn.steps}>
            <li><b>Tell us about your home.</b> A few taps: who lives there, heating, solar, EV. No bill needed.</li>
            <li><b>See what you could save.</b> We price {PLANS.length} plans from {retailers} retailers against the default offer.</li>
            <li><b>Switch, or let us keep watching.</b> Members get a monthly recheck and email, and a savings tracker.</li>
          </ol>
        </section>

        <section id="compare" className={learn.block}>
          <h2 className={home.h2}>Utilo, Victorian Energy Compare and the ESC</h2>
          <p className={home.sub}>Three different jobs. They work well together.</p>
          <div className={learn.tableWrap}>
            <table className={learn.table}>
              <thead>
                <tr><th></th><th>ESC</th><th>Victorian Energy Compare</th><th className={learn.us}>Utilo</th></tr>
              </thead>
              <tbody>
                <tr><th>What it is</th><td>Independent regulator of Victorian energy</td><td>Victorian Government&apos;s official comparison site</td><td className={learn.us}>Independent, privately run helper</td></tr>
                <tr><th>What it does</th><td>Sets the default offer (VDO) each year and enforces the rules</td><td>Lists offers so you can compare and switch</td><td className={learn.us}>Tailors the answer to your home, then keeps checking</td></tr>
                <tr><th>Starting point</th><td>Not a comparison tool</td><td>Your usage or bill details</td><td className={learn.us}>A few taps about your home. Bill optional</td></tr>
                <tr><th>After you switch</th><td>n/a</td><td>You come back and check again yourself</td><td className={learn.us}>Monthly recheck, email alerts and savings tracking (members)</td></tr>
              </tbody>
            </table>
          </div>
          <p className={learn.note}>
            Utilo covers the {PLANS.length} plans we can see from {retailers} retailers (data from {PLAN_DATA_DATE}). Before you switch, confirm the
            price with the retailer or on{" "}
            <a href="https://compare.energy.vic.gov.au" target="_blank" rel="noopener noreferrer">Victorian Energy Compare</a>. Using both is a good idea.
            We are not affiliated with the Victorian Government.
          </p>
        </section>

        <section id="videos" className={learn.block}>
          <h2 className={home.h2}>Watch</h2>
          <p className={home.sub}>Short videos, no jargon.</p>
          <div className={learn.videoGrid}>
            {VIDEOS.map((v) => <VideoSlot key={v.id} video={v} />)}
          </div>
        </section>

        <section id="charts" className={learn.block}>
          <h2 className={home.h2}>Example charts</h2>
          <p className={home.sub}>For a typical home using 4,000 kWh a year on a single-rate plan. Yours will differ.</p>

          <h3 className={learn.h3}>Default offer vs cheapest market plan</h3>
          <NetworkGapChart data={gaps} />

          <h3 className={learn.h3}>Who&apos;s cheapest on your network</h3>
          <RetailerRankChart byNetwork={byNetwork} />

          <h3 className={learn.h3}>Default offer: yearly change</h3>
          <p className={learn.note}>Set by the ESC each year. Average residential change.</p>
          <VdoHistoryChart data={VDO_HISTORY} />
          <ul className={learn.hist}>
            {VDO_HISTORY.map((h) => <li key={h.year}><b>{h.year}</b> {h.note}</li>)}
          </ul>
        </section>

        <section id="timeline" className={learn.block}>
          <h2 className={home.h2}>When prices change</h2>
          <p className={home.sub}>The default offer resets every 1 July. Retailers adjust their own plans through the year.</p>
          <ol className={learn.timeline}>
            {TIMELINE.map((t) => (
              <li key={t.when + t.title} className={t.status === "done" ? learn.done : learn.exp}>
                <span className={learn.when}>{t.when}{t.status === "expected" ? " · expected" : ""}</span>
                <b>{t.title}</b>
                <p>{t.detail}</p>
              </li>
            ))}
          </ol>
          <p className={learn.note}>
            Dates marked expected follow past years and are not confirmed. See the{" "}
            <a href="https://www.esc.vic.gov.au" target="_blank" rel="noopener noreferrer">ESC website</a> for official dates.
          </p>
        </section>

        <section id="save" className={learn.block}>
          <h2 className={home.h2}>Other ways to save</h2>
          <p className={home.sub}>A better plan is one lever. These are the others.</p>
          {(["Plan", "Usage", "Upgrades"] as const).map((g) => (
            <div key={g}>
              <h3 className={learn.h3}>{g === "Plan" ? "Pick the right plan" : g === "Usage" ? "Use less, or at cheaper times" : "Upgrades and help"}</h3>
              <div className={learn.tips}>
                {SAVE_TIPS.filter((t) => t.group === g).map((t) => (
                  <div key={t.title} className={learn.tip}><b>{t.title}</b><p>{t.body}</p></div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section id="data" className={learn.block}>
          <h2 className={home.h2}>Where the prices come from</h2>
          <p className={home.sub}>And how often everything runs.</p>
          <div className={learn.flowWrap}><PriceFlow /></div>
          <div className={learn.tips}>
            <div className={learn.tip}><b>The source</b><p>{DATA_FACTS.source}</p></div>
            <div className={learn.tip}><b>Last price pull</b><p>{DATA_FACTS.lastPull}: {DATA_FACTS.planCount} plans from {DATA_FACTS.retailerCount} retailers. The date is shown on every result.</p></div>
            <div className={learn.tip}><b>How each plan is priced</b><p>{DATA_FACTS.howPriced}</p></div>
            <div className={learn.tip}><b>Members, every morning</b><p>{DATA_FACTS.memberRecheck}</p></div>
            <div className={learn.tip}><b>Members, every month</b><p>{DATA_FACTS.monthlyEmail}</p></div>
            <div className={learn.tip}><b>The default offer</b><p>{DATA_FACTS.defaultOffer}</p></div>
            <div className={learn.tip}><b>Not included</b><p>{DATA_FACTS.notIncluded}</p></div>
            <div className={learn.tip}><b>Prices keep moving</b><p>{PRICE_CHANGE_CLAUSE}</p></div>
            <div className={learn.tip}><b>Independence</b><p>We are not affiliated with the Victorian Government, Victorian Energy Compare or any retailer. Every plan is priced with the same formula.</p></div>
          </div>
        </section>

        <section className={styles.sectionGap}>
          <Link href="/check" className={styles.heroCta}>Start my free check</Link>
        </section>
        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            <Link href="/">Home</Link> · <Link href="/pricing">Pricing</Link> · <Link href="/ev">EV calculator</Link> · <Link href="/faq">FAQ</Link> ·{" "}
            <Link href="/privacy">Privacy</Link> · <Link href="/cancellation-policy">Cancellation</Link> · <Link href="/terms">Terms</Link>
          </p>
        </footer>
      </div>
    </>
  );
}

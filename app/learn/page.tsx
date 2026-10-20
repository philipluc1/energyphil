import Link from "next/link";
import { DISTRIBUTORS, VDO, PLANS, PLAN_DATA_DATE, rankPlans, topOpen, type Distributor } from "@/lib/plans";
import { VIDEOS, VDO_HISTORY, PRICE_CYCLE, VDO_CHANGE_2026, SAVE_TIPS, nextCycleStage } from "@/lib/learnContent";
import { DATA_FACTS, PRICE_CHANGE_CLAUSE } from "@/lib/dataPolicy";
import PriceFlow from "../components/PriceFlow";
import Icon from "../components/Icon";
import MarketPulse from "../components/MarketPulse";
import SiteHeader from "../components/SiteHeader";
import VideoSlot from "../components/VideoSlot";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";
import learn from "./learn.module.css";
import { StepsVisual, RolesVisual } from "./LearnVisuals";
import { NetworkGapChart, RetailerRankChart, VdoHistoryChart, type NetworkGap, type RetailerRow } from "./LearnCharts";

export const metadata = {
  title: "How Utilo works | Utilo",
  description: "How Utilo works, how it differs from Victorian Energy Compare and the ESC, price trends, timelines and ways to save.",
};

// A typical home: 4,000 kWh a year, single rate. Illustrative only.
const USAGE = { days: 365, peak: 0, shoulder: 0, offpeak: 0, anytime: 4000, cl: 0 };
const maxDrop = Math.max(...VDO_CHANGE_2026.byNetwork.map((n) => Math.abs(n.change)));
const fmtDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

function buildCharts() {
  const gaps: NetworkGap[] = [];
  const byNetwork: Record<string, RetailerRow[]> = {};
  for (const d of DISTRIBUTORS as readonly Distributor[]) {
    const ranked = rankPlans(d, USAGE).filter((m) => m.plan[3] === "MARKET");
    const best = topOpen(ranked);
    if (!best) continue;
    gaps.push({ network: d, vdo: VDO[d].annual, best: Math.round(best.total) });
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
  const nextStage = nextCycleStage();
  return (
    <>
      <SiteHeader active="learn" />
      <div className={styles.wrap}>
        <section className={home.pageHead}>
          <h1>How Utilo works</h1>
          <p className={styles.lede}>Plain-English answers: what we do, how we&apos;re different, where prices are heading and how to pay less.</p>
          <div className={learn.chips}>
            <a href="#compare">Who does what</a>
            <a href="#videos">Videos</a>
            <a href="#charts">Price charts</a>
            <a href="#timeline">Timeline</a>
            <a href="#save">Ways to save</a>
            <a href="#data">Our data</a>
            <Link href="/ev">EV calculator</Link>
            <Link href="/gas">Gas check</Link>
          </div>
        </section>

        <section id="how" className={learn.block}>
          <h2 className={home.h2}>Three steps</h2>
          <StepsVisual />
        </section>

        <section id="compare" className={learn.block}>
          <h2 className={home.h2}>Who does what</h2>
          <p className={home.sub}>Three different jobs. They work well together.</p>
          <RolesVisual planCount={PLANS.length} retailers={retailers} />
          <p className={learn.note}>
            Data from {PLAN_DATA_DATE}. Before you switch, confirm the price with the retailer or on{" "}
            <a href="https://compare.energy.vic.gov.au" target="_blank" rel="noopener noreferrer">Victorian Energy Compare</a>. Using both is a good idea.
            We are not affiliated with the Victorian Government. Victorian Energy Compare details are from{" "}
            <a href="https://www.victorianenergysaver.vic.gov.au/victorian-energy-compare" target="_blank" rel="noopener noreferrer">its published guide</a>{" "}
            (October 2026).
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
          <p className={learn.assume}>
            <span className={learn.assumeIcon}><Icon name="home" size={18} /></span>
            <span>
              <b>Assumes a residential home using 4,000 kWh a year</b>, the regulator&apos;s typical figure, on a single-rate plan with no solar. Yearly
              cost of each retailer&apos;s cheapest plan, pay-on-time discounts included, prices checked {fmtDay(PLAN_DATA_DATE)}.
            </span>
          </p>
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
          <p className={home.sub}>There are two kinds of price, and they change on different clocks.</p>

          <div className={learn.clocks}>
            <div className={learn.clock}>
              <span className={`${learn.clockIcon} ${learn.ciNavy}`}><Icon name="calendar" size={22} /></span>
              <div>
                <b>The default offer</b>
                <p>A price set by the regulator (the ESC) for anyone not on a retailer&apos;s own plan. It changes <strong>once a year, on 1 July</strong>.</p>
              </div>
            </div>
            <div className={learn.clock}>
              <span className={`${learn.clockIcon} ${learn.ciTeal}`}><Icon name="refresh" size={22} /></span>
              <div>
                <b>Retailers&apos; own plans</b>
                <p>Set by each retailer. They can change prices <strong>at any time of year</strong>, and new plans keep appearing.</p>
              </div>
            </div>
          </div>
          <MarketPulse compact />

          <h3 className={learn.h3}>This year: the default offer fell {Math.abs(VDO_CHANGE_2026.average)}% on {VDO_CHANGE_2026.from}</h3>
          <div className={learn.change}>
            <div className={learn.changeBig}>
              <span className={learn.changePct}>{VDO_CHANGE_2026.average}%</span>
              <span>average for homes, about <b>${VDO_CHANGE_2026.averageDollars} a year less</b> on a typical bill</span>
            </div>
            <ul className={learn.changeBars} aria-label="Change by network">
              {VDO_CHANGE_2026.byNetwork.map((n) => (
                <li key={n.network}>
                  <span className={learn.cbName}>{n.network}</span>
                  <span className={learn.cbTrack}><span style={{ width: `${Math.round((Math.abs(n.change) / maxDrop) * 100)}%` }} /></span>
                  <b>{n.change}%</b>
                </li>
              ))}
            </ul>
          </div>

          <h3 className={learn.h3}>The yearly cycle</h3>
          <ol className={learn.cycle}>
            {PRICE_CYCLE.map((s, i) => (
              <li key={s.title} className={i < nextStage ? learn.cyDone : i === nextStage ? learn.cyNext : undefined}>
                <span className={learn.cyDot}>{i < nextStage ? <Icon name="check" size={16} /> : i + 1}</span>
                {i === nextStage && <span className={learn.cyHere}>Next up</span>}
                <b>{s.title}</b>
                <p>{s.detail}</p>
                <dl>
                  <div><dt>Last time</dt><dd>{s.last}</dd></div>
                  <div><dt>{s.confirmed ? "Next" : "Next, expected"}</dt><dd>{s.next}</dd></div>
                </dl>
              </li>
            ))}
          </ol>
          <p className={learn.note}>
            Expected dates follow past years and are not confirmed. See the{" "}
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

import Link from "next/link";
import { dailyChanges, marketEvents, type MarketEvent } from "@/lib/marketActivity";
import CountUp from "./CountUp";
import Icon from "./Icon";
import RetailerLogo from "./RetailerLogo";
import { OfferChips } from "./OfferTerms";
import { describeOffer } from "@/lib/planExtras";
import s from "./marketboard.module.css";

const DAYS = 30;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

/** How one changed offer compares with this member's plan, for the dashboard. */
export interface VsYou {
  text: string;
  tone: "better" | "worse" | "muted";
}

/** The member's own view: checked against their bill (or plan, or the default offer). */
export interface MarketPersonal {
  /** "your bill", "your plan" or "the default offer". */
  against: string;
  network: string;
  checked: number;
  beat: number;
  worthPerYear: number;
  closest: string | null;
  vs: (e: MarketEvent) => VsYou | null;
}

/** The offer's discounts and conditions, as chips, for one row. */
function Deal({ e }: { e: MarketEvent }) {
  const o = describeOffer("E", e.retailer, e.plan, null, { hasSolar: false, currentRetailer: null });
  if (!o.chips.length) return null;
  return <span className={s.deal}><OfferChips o={o} /></span>;
}

function Row({ e, vs, more = 0 }: { e: MarketEvent; vs?: VsYou | null; /** Other changed offers from the same retailer, folded into this row. */ more?: number }) {
  return (
    <li className={s.row}>
      <span className={s.when}>{fmtDay(e.date)}</span>
      <RetailerLogo name={e.retailer} size={30} />
      <span className={s.what}>
        <b>{e.retailer}</b>
        <span className={s.plan} title={e.plan}>{e.plan}{more > 0 ? ` · +${more} more` : ""}</span>
        <Deal e={e} />
        {vs && <span className={vs.tone === "better" ? s.vsBetter : vs.tone === "worse" ? s.vsWorse : s.vsMuted}>{vs.text}</span>}
      </span>
      <span className={e.kind === "new" ? s.tagNew : s.tagPrice}>{e.kind === "new" ? "New offer" : "Price change"}</span>
    </li>
  );
}

/** One row per retailer: its latest changed offer, with the rest counted. */
function perRetailer(events: MarketEvent[], n: number): { e: MarketEvent; more: number }[] {
  const out: { e: MarketEvent; more: number }[] = [];
  const idx = new Map<string, number>();
  for (const e of events) {
    const i = idx.get(e.retailer);
    if (i === undefined) { idx.set(e.retailer, out.length); out.push({ e, more: 0 }); } else out[i].more++;
  }
  return out.slice(0, n);
}

/** A member's dashboard side card: the count checked, how many beat them, and the three latest. */
export function MarketSideCard({ personal, events }: { personal: MarketPersonal; events: MarketEvent[] }) {
  return (
    <section className={`${s.board} ${s.sideCard}`} aria-labelledby="market-side-title">
      <span className={s.live}><i aria-hidden="true" /> Last 30 days, {personal.network}</span>
      <h3 id="market-side-title" className={s.sideTitle}>
        <b>{personal.checked}</b> changed offers checked against {personal.against}
      </h3>
      <p className={s.sideLine}>
        {personal.beat === 0 ? <>None beat it by ${personal.worthPerYear}+ a year.</> : <><b>{personal.beat}</b> beat it by ${personal.worthPerYear}+ a year.</>}
        {personal.closest ? <> {personal.closest}.</> : null}
      </p>
      <ul className={`${s.list} ${s.teaserList}`}>
        {perRetailer(events, 3).map(({ e, more }) => <Row key={e.retailer} e={e} more={more} vs={personal.vs(e)} />)}
      </ul>
      <Link href="/market" className={s.more}>All changes in Victoria →</Link>
    </section>
  );
}

/**
 * The home page's short version: the four numbers, a sparkline of the 30
 * days, the three latest changes and a link to the full board.
 */
function MarketTeaser({ events }: { events: MarketEvent[] }) {
  if (events.length === 0) return null;
  const newOffers = events.filter((e) => e.kind === "new").length;
  const priceChanges = events.length - newOffers;
  const retailers = new Set(events.map((e) => e.retailer)).size;
  const perWeek = Math.round((events.length / DAYS) * 7);
  const days = dailyChanges(events, DAYS);
  const max = Math.max(...days.map((d) => d.newOffers + d.priceChanges), 1);
  return (
    <section className={`${s.board} ${s.teaser}`} aria-labelledby="market-board-title">
      <div className={s.teaserHead}>
        <div className={s.head}>
          <span className={s.live}><i aria-hidden="true" /> Live from retailers&apos; published offers</span>
          <h2 id="market-board-title" className={s.title}>The last 30 days in Victoria&apos;s power market</h2>
        </div>
        <span className={s.spark} role="img" aria-label={`${events.length} offer changes over the last ${DAYS} days`}>
          {days.map((d) => { const t = d.newOffers + d.priceChanges; return <i key={d.date} style={{ height: `${t ? Math.max(12, Math.round((t / max) * 100)) : 4}%` }} className={t ? (d.priceChanges > d.newOffers ? s.sparkPrice : s.sparkNew) : ""} />; })}
        </span>
      </div>
      <div className={s.stats}>
        {newOffers > 0 && <div className={s.stat}><b className={s.nNew}><CountUp value={newOffers} /></b><span>new offers</span></div>}
        {priceChanges > 0 && <div className={s.stat}><b className={s.nPrice}><CountUp value={priceChanges} /></b><span>price changes</span></div>}
        <div className={s.stat}><b><CountUp value={retailers} /></b><span>retailers involved</span></div>
        {perWeek >= 2 && <div className={`${s.stat} ${s.statWeek}`}><b>~{perWeek}</b><span>changes a week</span></div>}
      </div>
      <ul className={`${s.list} ${s.teaserList}`}>
        {perRetailer(events, 3).map(({ e, more }) => <Row key={e.retailer} e={e} more={more} />)}
      </ul>
      <div className={s.teaserFoot}>
        <p><b>Would you have spotted these?</b> Members get every one checked against their own bill each morning.</p>
        <Link href="/market" className={s.more}>See all {events.length} changes →</Link>
      </div>
    </section>
  );
}

/**
 * The last 30 days of Victoria's energy market, from the daily pull: how many
 * offers changed, a bar per day, and a scrolling feed of the actual offers
 * (long, look-alike plan names and all). Shows nothing until the pull has
 * dated offers, so it never claims activity it can't show.
 */
export default function MarketBoard({ personal, compact = false }: { personal?: MarketPersonal; compact?: boolean } = {}) {
  // On a member's dashboard: their network only, each offer against their bill.
  const events = marketEvents({ days: DAYS, network: personal?.network ?? null });
  if (compact) return <MarketTeaser events={events} />;
  if (events.length === 0) return null;
  const newOffers = events.filter((e) => e.kind === "new").length;
  const priceChanges = events.length - newOffers;
  const retailers = new Set(events.map((e) => e.retailer)).size;
  const perWeek = Math.round((events.length / DAYS) * 7);
  const days = dailyChanges(events, DAYS);
  const max = Math.max(...days.map((d) => d.newOffers + d.priceChanges), 1);
  const feed = events.slice(0, 24);
  const scroll = feed.length > 5;

  return (
    <section className={s.board} aria-labelledby="market-board-title">
      <div className={personal ? s.headRow : s.head}>
        <div className={s.head}>
          <span className={s.live}><i aria-hidden="true" /> Live from retailers&apos; published offers</span>
          <h2 id="market-board-title" className={s.title}>
            {personal ? <>The last 30 days on the {personal.network} network</> : <>The last 30 days in Victoria&apos;s power market</>}
          </h2>
          <p className={s.lede}>
            {personal
              ? <>We price every one of these against {personal.against} each morning, so you don&apos;t have to follow any of it.</>
              : <>Retailers keep changing their offers, and most people never notice. Here&apos;s what changed while you weren&apos;t looking.</>}
          </p>
        </div>
        {personal && (
          <div className={s.mine}>
            <span className={s.mineHead}>For your home</span>
            <p>
              <b>{personal.checked} checked</b> · <b>{personal.beat}</b> beat {personal.against} by ${personal.worthPerYear}+ a year
            </p>
            {personal.closest && <span className={s.mineNote}>{personal.closest}</span>}
          </div>
        )}
      </div>

      <div className={s.stats}>
        {newOffers > 0 && (
          <div className={s.stat}>
            <b className={s.nNew}><CountUp value={newOffers} /></b>
            <span>new offers</span>
          </div>
        )}
        {priceChanges > 0 && (
          <div className={s.stat}>
            <b className={s.nPrice}><CountUp value={priceChanges} /></b>
            <span>price changes</span>
          </div>
        )}
        <div className={s.stat}>
          <b><CountUp value={retailers} /></b>
          <span>retailers involved</span>
        </div>
        {perWeek >= 2 && (
          <div className={`${s.stat} ${s.statWeek}`}>
            <b>~{perWeek}</b>
            <span>changes a week</span>
          </div>
        )}
      </div>

      <div className={s.body}>
        <div className={s.chartWrap}>
          <span className={s.panelHead}>Changes by day</span>
          <div className={s.chart} role="img" aria-label={`${events.length} offer changes over the last ${DAYS} days`}>
            {days.map((d) => {
              const total = d.newOffers + d.priceChanges;
              return (
                <span key={d.date} className={s.day} title={total ? `${fmtDay(d.date)}: ${total} change${total === 1 ? "" : "s"}` : fmtDay(d.date)}>
                  <span className={s.stack} style={{ height: `${total ? Math.max(6, Math.round((total / max) * 100)) : 0}%` }}>
                    {d.priceChanges > 0 && <span className={s.segPrice} style={{ flexGrow: d.priceChanges }} />}
                    {d.newOffers > 0 && <span className={s.segNew} style={{ flexGrow: d.newOffers }} />}
                  </span>
                </span>
              );
            })}
          </div>
          <div className={s.axis}><span>{fmtDay(days[0].date)}</span><span>Today</span></div>
          <div className={s.key}>
            <span><i className={s.keyNew} /> New offer</span>
            <span><i className={s.keyPrice} /> Price change</span>
          </div>
        </div>

        <div className={s.feedWrap}>
          <span className={s.panelHead}>{personal ? <>Latest changes · against {personal.against}</> : <>Latest changes</>}</span>
          <div className={`${s.feed} ${scroll ? s.feedScroll : ""}`} tabIndex={0} aria-label="Latest offer changes">
            <ul className={s.list} style={scroll ? { animationDuration: `${feed.length * 3}s` } : undefined}>
              {feed.map((e) => <Row key={`${e.retailer}|${e.plan}`} e={e} vs={personal?.vs(e)} />)}
              {scroll && feed.map((e) => <Row key={`again-${e.retailer}|${e.plan}`} e={e} vs={personal?.vs(e)} />)}
            </ul>
          </div>
          <span className={s.feedNote}>Would you have spotted these? Plan names are the retailers&apos; own.</span>
        </div>
      </div>

      <div className={s.foot}>
        <span className={s.footIcon} aria-hidden="true"><Icon name="refresh" size={20} /></span>
        {personal ? (
          <p>
            <b>Nothing to do unless we email you.</b> When one of these would save you ${personal.worthPerYear} a year or more, you&apos;ll hear from us.
          </p>
        ) : (
          <>
            <p>
              <b>Confusing? That&apos;s the point of us.</b> Members get every one of these checked against their own bill each morning, and hear from us
              only when switching is worth it.
            </p>
            <Link href="/check" className={s.cta}>Check my bill free →</Link>
          </>
        )}
      </div>
    </section>
  );
}

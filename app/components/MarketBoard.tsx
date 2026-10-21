import Link from "next/link";
import { dailyChanges, marketEvents, type MarketEvent } from "@/lib/marketActivity";
import CountUp from "./CountUp";
import Icon from "./Icon";
import RetailerLogo from "./RetailerLogo";
import s from "./marketboard.module.css";

const DAYS = 30;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

function Row({ e }: { e: MarketEvent }) {
  return (
    <li className={s.row}>
      <span className={s.when}>{fmtDay(e.date)}</span>
      <RetailerLogo name={e.retailer} size={30} />
      <span className={s.what}>
        <b>{e.retailer}</b>
        <span className={s.plan} title={e.plan}>{e.plan}</span>
      </span>
      <span className={e.kind === "new" ? s.tagNew : s.tagPrice}>{e.kind === "new" ? "New offer" : "Price change"}</span>
    </li>
  );
}

/**
 * The last 30 days of Victoria's energy market, from the daily pull: how many
 * offers changed, a bar per day, and a scrolling feed of the actual offers
 * (long, look-alike plan names and all). Shows nothing until the pull has
 * dated offers, so it never claims activity it can't show.
 */
export default function MarketBoard() {
  const events = marketEvents({ days: DAYS });
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
      <div className={s.head}>
        <span className={s.live}><i aria-hidden="true" /> Live from retailers&apos; published offers</span>
        <h2 id="market-board-title" className={s.title}>The last 30 days in Victoria&apos;s power market</h2>
        <p className={s.lede}>Retailers keep changing their offers, and most people never notice. Here&apos;s what changed while you weren&apos;t looking.</p>
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
          <span className={s.panelHead}>Latest changes</span>
          <div className={`${s.feed} ${scroll ? s.feedScroll : ""}`} tabIndex={0} aria-label="Latest offer changes">
            <ul className={s.list} style={scroll ? { animationDuration: `${feed.length * 3}s` } : undefined}>
              {feed.map((e) => <Row key={`${e.retailer}|${e.plan}`} e={e} />)}
              {scroll && feed.map((e) => <Row key={`again-${e.retailer}|${e.plan}`} e={e} />)}
            </ul>
          </div>
          <span className={s.feedNote}>Would you have spotted these? Plan names are the retailers&apos; own.</span>
        </div>
      </div>

      <div className={s.foot}>
        <span className={s.footIcon} aria-hidden="true"><Icon name="refresh" size={20} /></span>
        <p>
          <b>Confusing? That&apos;s the point of us.</b> Members get every one of these checked against their own bill each morning, and hear from us
          only when switching is worth it.
        </p>
        <Link href="/check" className={s.cta}>Check my bill free →</Link>
      </div>
    </section>
  );
}

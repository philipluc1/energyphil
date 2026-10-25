import Link from "next/link";
import { dailyChanges, marketEvents, type MarketEvent } from "@/lib/marketActivity";
import CountUp from "./CountUp";
import Icon from "./Icon";
import RetailerLogo from "./RetailerLogo";
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

function Row({ e, vs }: { e: MarketEvent; vs?: VsYou | null }) {
  return (
    <li className={s.row}>
      <span className={s.when}>{fmtDay(e.date)}</span>
      <RetailerLogo name={e.retailer} size={30} />
      <span className={s.what}>
        <b>{e.retailer}</b>
        <span className={s.plan} title={e.plan}>{e.plan}</span>
        {vs && <span className={vs.tone === "better" ? s.vsBetter : vs.tone === "worse" ? s.vsWorse : s.vsMuted}>{vs.text}</span>}
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
export default function MarketBoard({ personal }: { personal?: MarketPersonal } = {}) {
  // On a member's dashboard: their network only, each offer against their bill.
  const events = marketEvents({ days: DAYS, network: personal?.network ?? null });
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

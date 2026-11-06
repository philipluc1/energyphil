"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import RetailerLogo from "./RetailerLogo";
import DayChanges from "./DayChanges";
import DashOverlay from "./DashOverlay";
import { MarketSideCard, type MarketPersonal } from "./MarketBoard";
import MarketRewards, { RewardsSideCard, rewardItems } from "./MarketRewards";
import { GAS_ZONES, TYPICAL_MJ_PER_DAY, gasDataReady, rankGasPlans, type GasZone, type RankedGas } from "@/lib/gasPlans";
import { topOpen } from "@/lib/planExtras";
import { heatingShareFor } from "@/lib/gasUsage";
import { forecastGasYear, gasOfferKeys, gasPricer, medianGasSupply, planGasPricer, typicalGasPricer, type GasForecast } from "@/lib/gasInsights";
import { marketEvents, type MarketEvent } from "@/lib/marketActivity";
import { MONTH_NAMES } from "@/lib/profileUsage";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import { useOpenParam } from "@/lib/useOpenParam";
import type { GasMember } from "./GasDashboard";
import s from "./insights.module.css";
import bx from "./billexplainer.module.css";
import styles from "./dashcompare.module.css";

// The gas tab's side cards (1 Nov 2026), the same set as electricity's:
// your gas year ahead, the gas market this month (top 5 retailers, latest
// changes) and gas discounts and rewards. Gas has no default offer, so
// everything is against the member's own bill, or a typical plan without one.

const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const short = (m: number) => MONTH_NAMES[m].slice(0, 3);
const dayMonth = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

interface GasCtx {
  zone: GasZone;
  days: number;
  mj: number;
  ranked: RankedGas[];
  top: RankedGas;
  /** What they pay now for the bill period: their bill, or a typical plan. */
  you: number;
  haveBill: boolean;
  against: string;
  perYear: number;
}

function useGasCtx(member: GasMember): GasCtx | null {
  return useMemo(() => {
    const zone = member.gas_zone && GAS_ZONES.includes(member.gas_zone as GasZone) ? (member.gas_zone as GasZone) : null;
    const days = member.gas_billing_days ?? 0;
    const mj = member.gas_mj ?? 0;
    if (!gasDataReady || !zone || !(days > 0) || !(mj > 0)) return null;
    const ranked = rankGasPlans(zone, { days, mj }, member.gas_current_retailer ?? null);
    const top = topOpen(ranked);
    if (!top) return null;
    const bill = member.gas_reference_total;
    const haveBill = bill !== null && bill > 0;
    const you = haveBill ? bill : ranked[Math.floor(ranked.length / 2)].total;
    return { zone, days, mj, ranked, top, you, haveBill, against: haveBill ? "your gas bill" : "a typical gas plan", perYear: 365 / days };
  }, [member.gas_zone, member.gas_billing_days, member.gas_mj, member.gas_reference_total, member.gas_current_retailer]);
}

export default function GasCards({ member, only, noRewards = false }: {
  member: GasMember;
  /** "rewardsCard": just the gas rewards card (the Savings tab). "market" / "rewards": the full
   * views for the phone's Market and Rewards tabs. "forecast": just the year-ahead card. */
  only?: "rewardsCard" | "market" | "rewards" | "forecast";
  noRewards?: boolean;
}) {
  const c = useGasCtx(member);
  if (!c) return null;
  if (only === "rewardsCard") return <GasMarket c={c} rewardsOnly />;
  if (only === "forecast") return <GasForecastCard c={c} />;
  if (only === "market") return <GasMarket c={c} inline="market" />;
  if (only === "rewards") return <MarketRewards fuel="G" matches={c.ranked} you={c.you} perYear={c.perYear} against={c.against} locked={new Set<unknown>()} whole={whole} />;
  return (
    <>
      <GasForecastCard c={c} />
      <GasMarket c={c} noRewards={noRewards} />
    </>
  );
}

/* ---------- Your gas year ahead ---------- */

function GasForecastCard({ c }: { c: GasCtx }) {
  const f = useMemo<GasForecast | null>(() => {
    const share = heatingShareFor(null, c.mj / c.days);
    const now = c.haveBill ? gasPricer({ bill: c.you, mj: c.mj, days: c.days, supplyPerDay: medianGasSupply(c.zone) }) : typicalGasPricer(c.zone);
    return forecastGasYear({ mj: c.mj, days: c.days, endIso: null, heatingShare: share, now, best: planGasPricer(c.top.plan) });
  }, [c]);
  const [open, setOpen] = useState(false);
  useOpenParam("gasyear", () => setOpen(true), !!f);
  if (!f) return null;
  const max = Math.max(...f.months.map((m) => m.now), 1);
  const save = f.next.now - f.next.best;
  return (
    <>
      <section
        className={`${s.side} ${s.sideOpen}`}
        style={{ "--accent": "#e8590c", "--tagBg": "#fff0e6", "--tagFg": "#b4400a" } as CSSProperties}
        aria-labelledby="gfc-side-title"
        onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a")) setOpen(true); }}
      >
        <span className={s.tag}><Icon name="flame" size={13} /> Your gas year ahead</span>
        <h3 id="gfc-side-title" className={s.sideTitle}>
          Next gas bill about <b>{whole(f.next.now)}</b>
        </h3>
        <p className={s.sideLine}>
          {f.next.days} days to {dayMonth(f.next.end)}.{save >= 1 ? <> On the cheapest plan: <b className={s.good}>{whole(f.next.best)}</b>.</> : null}
        </p>
        <div className={s.spark} aria-hidden="true">
          {f.months.map((m, i) => <i key={i} className={i === 0 ? s.sparkNow : ""} style={{ height: `${Math.max(8, (m.now / max) * 100)}%`, animationDelay: `${i * 30}ms` }} />)}
        </div>
        <button type="button" className={s.more} onClick={() => setOpen(true)}>See my gas year, month by month →</button>
      </section>
      {open && <GasForecastPage f={f} c={c} onClose={() => setOpen(false)} />}
    </>
  );
}

function GasForecastPage({ f, c, onClose }: { f: GasForecast; c: GasCtx; onClose: () => void }) {
  const max = Math.max(...f.months.map((m) => Math.max(m.now, m.best)), 1);
  const peak = f.months.reduce((a, m) => (m.now / m.days > a.now / a.days ? m : a), f.months[0]);
  const low = f.months.reduce((a, m) => (m.now / m.days < a.now / a.days ? m : a), f.months[0]);
  const saveYear = f.yearNow - f.yearBest;
  const nowLabel = c.haveBill ? "Your gas plan" : "A typical gas plan";
  // The months the next bill covers (for the dashed box).
  const nextMonths = new Set<number>();
  {
    let left = f.next.days;
    let i = 0;
    while (left > 0 && i < f.months.length) { nextMonths.add(i); left -= f.months[i].days; i++; }
  }
  return (
    <DashOverlay title="Your gas year ahead" lede="What your gas should cost over the next twelve months, on your plan and on the cheapest gas plan for you. Gas follows the seasons, so winter months cost far more." bar="Estimate" onClose={onClose}>
      <div className={s.tiles}>
        <div className={s.tile}><b>{whole(f.next.now)}</b><span>your next gas bill ({f.next.days} days to {dayMonth(f.next.end)}, about {f.next.mj.toLocaleString("en-AU")} MJ)</span></div>
        <div className={`${s.tile} ${saveYear >= 1 ? s.tileGood : ""}`}><b>{whole(f.next.best)}</b><span>the same bill on the cheapest gas plan{saveYear >= 1 ? `: ${whole(f.next.now - f.next.best)} less` : ""}</span></div>
        <div className={s.tile}><b>{whole(f.yearNow)}</b><span>the next 12 months on {nowLabel.toLowerCase()}{saveYear >= 1 ? `, or ${whole(f.yearBest)} on the cheapest` : ""}</span></div>
      </div>

      <section className={s.card} aria-labelledby="gfc-chart">
        <h3 id="gfc-chart">Month by month</h3>
        <p className={s.sub}>
          Dearest month: <b>{MONTH_NAMES[peak.month]}</b> ({whole(peak.now)}). Cheapest: <b>{MONTH_NAMES[low.month]}</b> ({whole(low.now)}). The dashed box is your next bill.
        </p>
        <div className={s.fcChart} role="img" aria-label={`Forecast gas cost by month, ${nowLabel.toLowerCase()} and the cheapest plan`}>
          {f.months.map((m, i) => (
            <div key={i} className={s.fcCol} title={`${MONTH_NAMES[m.month]} ${m.year}: ${whole(m.now)} on ${nowLabel.toLowerCase()}, ${whole(m.best)} on the cheapest plan, ${m.mj.toLocaleString("en-AU")} MJ`}>
              {nextMonths.has(i) && <span className={s.fcNext} aria-hidden="true" />}
              <div className={s.fcBars}>
                <i className={s.fcNow} style={{ height: `${(m.now / max) * 100}%`, animationDelay: `${i * 35}ms` }} />
                <i className={s.fcBest} style={{ height: `${(m.best / max) * 100}%`, animationDelay: `${i * 35 + 60}ms` }} />
              </div>
              <small>{short(m.month)}</small>
            </div>
          ))}
        </div>
        <div className={s.fcLegend}>
          <span><i style={{ background: "#e8590c" }} /> {nowLabel}</span>
          <span><i style={{ background: "#16a34a" }} /> Cheapest: {c.top.plan[0]}</span>
        </div>
      </section>

      <section className={s.card} aria-labelledby="gfc-how">
        <h3 id="gfc-how">How we worked it out</h3>
        <ul className={s.fineList}>
          <li>Your last gas bill ({Math.round(c.mj).toLocaleString("en-AU")} MJ over {c.days} days) makes about {(f.annualMj / 1000).toLocaleString("en-AU", { maximumFractionDigits: 1 })} GJ a year, spread across the months the way a Victorian home&apos;s gas usually falls: heating in winter, hot water and cooking all year.</li>
          {c.haveBill
            ? <li>&ldquo;Your gas plan&rdquo; is your bill split into a typical supply charge and an average price per MJ, so colder months cost more at your rate.</li>
            : <li>We don&apos;t have your gas charges, so &ldquo;now&rdquo; is a typical gas plan on {c.zone}. Add your bill total for your own figures.</li>}
          <li>We don&apos;t know which months your last bill covered, so we&apos;ve treated it as an average one. A winter bill makes this year look dearer than it will be; a summer bill, cheaper.</li>
          <li>Prices are today&apos;s; retailers can change gas prices with notice. It&apos;s an estimate, not a meter reading.</li>
        </ul>
      </section>
    </DashOverlay>
  );
}

/* ---------- The gas market this month, and gas rewards ---------- */

function GasMarket({ c, rewardsOnly = false, noRewards = false, inline }: { c: GasCtx; rewardsOnly?: boolean; noRewards?: boolean; /** Render the full market view in the page (the phone's Market tab). */ inline?: "market" }) {
  const [open, setOpen] = useState<false | "top" | "rewards">(false);
  const events = useMemo(() => marketEvents({ days: 30, keys: gasOfferKeys(c.zone) }), [c.zone]);
  const rewards = useMemo(() => rewardItems(c.ranked, c.you, c.perYear, "G"), [c]);
  useOpenParam("gasmarket", () => setOpen("top"), !rewardsOnly);
  useOpenParam("gasrewards", () => setOpen("rewards"), !rewardsOnly);
  const personal = useMemo<MarketPersonal>(() => {
    const byKey = new Map(c.ranked.map((m) => [`${m.plan[0]}|${m.plan[2]}`, m]));
    let checked = 0;
    let beat = 0;
    let closest: { retailer: string; diff: number } | null = null;
    for (const e of events) {
      const m = byKey.get(`${e.retailer}|${e.plan}`);
      if (!m) continue;
      checked++;
      if (m.restricted) continue;
      const diff = (m.total - c.you) * c.perYear;
      if (diff <= -WORTH_SWITCHING_PER_YEAR) beat++;
      if (!closest || diff < closest.diff) closest = { retailer: e.retailer, diff };
    }
    return {
      against: c.against,
      network: c.zone,
      fuel: "G",
      checked,
      beat,
      worthPerYear: WORTH_SWITCHING_PER_YEAR,
      closest: !closest ? null : closest.diff < 0 ? `Best: ${closest.retailer}, about ${whole(-closest.diff)} a year less than ${c.against}` : `Closest: ${closest.retailer}, about ${whole(closest.diff)} a year more than ${c.against}`,
      vs: (e) => {
        const m = byKey.get(`${e.retailer}|${e.plan}`);
        if (!m) return { text: "Not on your gas network", tone: "muted" };
        if (m.restricted) return { text: `Limited offer: ${m.restricted}`, tone: "muted" };
        const diff = (m.total - c.you) * c.perYear;
        const vsWhat = c.haveBill ? "you pay" : "a typical plan";
        if (Math.abs(diff) < 5) return { text: `About the same as ${vsWhat}`, tone: "muted" };
        return diff < 0 ? { text: `${whole(-diff)} a year less than ${vsWhat}`, tone: "better" } : { text: `${whole(diff)} a year more than ${vsWhat}`, tone: "worse" };
      },
    };
  }, [c, events]);
  const none = useMemo(() => new Set<unknown>(), []);
  if (inline) return <GasMarketDetail c={c} personal={personal} events={events} startAt="top" onClose={() => {}} inline />;
  return (
    <>
      {!rewardsOnly && personal.checked > 0 && <MarketSideCard personal={personal} events={events.filter((e) => personal.vs(e)?.text !== "Not on your gas network")} onOpen={() => setOpen("top")} />}
      {(rewardsOnly || !noRewards) && <RewardsSideCard items={rewards} locked={none} onOpen={() => setOpen("rewards")} wide={rewardsOnly} />}
      {open && <GasMarketDetail c={c} personal={personal} events={events} startAt={open} onClose={() => setOpen(false)} />}
    </>
  );
}

function GasMarketDetail({ c, personal, events, onClose, startAt, inline = false }: { c: GasCtx; personal: MarketPersonal; events: MarketEvent[]; onClose: () => void; startAt: "top" | "rewards"; inline?: boolean }) {
  useEffect(() => {
    if (startAt !== "rewards") return;
    const t = window.setTimeout(() => {
      const el = document.getElementById("md-rewards");
      const box = el?.closest("[role=dialog]") as HTMLElement | null;
      if (!el || !box) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 76, behavior: reduce ? "auto" : "smooth" });
    }, 250);
    return () => window.clearTimeout(t);
  }, [startAt]);
  useEffect(() => {
    if (inline) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose, inline]);
  const [allRet, setAllRet] = useState(false);
  const [allFeed, setAllFeed] = useState(false);
  const none = useMemo(() => new Set<unknown>(), []);

  // Each retailer's cheapest gas plan anyone can get.
  const perRet = useMemo(() => {
    const seen = new Set<string>();
    return c.ranked.filter((m) => !m.restricted && (seen.has(m.plan[0]) ? false : (seen.add(m.plan[0]), true)));
  }, [c.ranked]);
  const yearly = (t: number) => t * c.perYear;
  const youYear = yearly(c.you);
  const max = Math.max(youYear, ...perRet.map((m) => yearly(m.total)), 1);
  const changesBy = new Map<string, { n: number; last: string }>();
  for (const e of events) {
    const x = changesBy.get(e.retailer);
    if (!x) changesBy.set(e.retailer, { n: 1, last: e.date });
    else { x.n++; if (e.date > x.last) x.last = e.date; }
  }
  const newOffers = events.filter((e) => e.kind === "new").length;
  const cheaper = perRet.filter((m) => (c.you - m.total) * c.perYear >= 1).length;
  const best = perRet[0];
  const bestSave = best ? Math.max(0, (c.you - best.total) * c.perYear) : 0;
  const RET_SHOWN = 5;
  const FEED_SHOWN = 10;
  const retShown = allRet ? perRet : perRet.slice(0, RET_SHOWN);
  const feedShown = allFeed ? events : events.slice(0, FEED_SHOWN);

  const body = (
      <div className={`${styles.mdBody} ${inline ? styles.mdInline : ""}`}>
        <h2 id="gmd-title" className={styles.mdTitle}>Your gas market this month</h2>
        <p className={styles.mdLede}>Every gas offer that changed on your network, priced for your home against {c.against}.</p>

        <div className={styles.mdTiles}>
          <div className={styles.mdTile}><b>{personal.checked}</b><span>changed gas offers checked for you</span></div>
          <div className={`${styles.mdTile} ${styles.mdTileGood}`}><b>{personal.beat}</b><span>beat {c.against} by ${WORTH_SWITCHING_PER_YEAR}+ a year</span></div>
          <div className={styles.mdTile}><b>{cheaper}</b><span>of {perRet.length} gas retailers are cheaper than {c.against}</span></div>
          <div className={`${styles.mdTile} ${styles.mdTileSave}`}><b>{whole(bestSave)}</b><span>a year: the most you could save{best ? `, with ${best.plan[0]}` : ""}</span></div>
        </div>

        {events.length > 0 && (
          <section className={styles.mdCard} aria-labelledby="gmd-chart">
            <h3 id="gmd-chart">Changes by day</h3>
            <p className={styles.mdSub}>{newOffers} new gas offers and {events.length - newOffers} updated offers in 30 days.</p>
            <DayChanges events={events} label="gas " />
          </section>
        )}

        <section className={styles.mdCard} aria-labelledby="gmd-ret">
          <h3 id="gmd-ret">Cheapest gas retailers for your home</h3>
          <p className={styles.mdSub}>Each retailer&apos;s cheapest gas plan you can get, a year. The line is {c.against}: {whole(youYear)}.</p>
          <ol className={styles.mdRank}>
            {retShown.map((m, i) => {
              const diff = (c.you - m.total) * c.perYear;
              const ch = changesBy.get(m.plan[0]);
              return (
                <li key={`${m.plan[0]}|${m.plan[2]}`} className={styles.mdRow}>
                  <span className={styles.mdRankNo}>{i + 1}</span>
                  <RetailerLogo name={m.plan[0]} size={34} square />
                  <span className={styles.mdWho}>
                    <b>{m.plan[0]}</b>
                    <small>{m.plan[2]}</small>
                    {ch && <em className={styles.mdChg}>{ch.n} change{ch.n === 1 ? "" : "s"} · latest {shortDay(ch.last)}</em>}
                  </span>
                  <span className={styles.mdBarWrap}>
                    <span className={styles.mdTrack}>
                      <span className={diff >= 0 ? styles.mdBarGood : styles.mdBarBad} style={{ width: `${(yearly(m.total) / max) * 100}%` }} />
                      <span className={styles.mdYou} style={{ left: `${(youYear / max) * 100}%` }} aria-hidden="true" />
                    </span>
                  </span>
                  <span className={styles.mdNums}>
                    <b>{whole(yearly(m.total))}</b>
                    <small className={diff >= 0 ? styles.pos : styles.neg}>{Math.abs(diff) < 1 ? "Same" : diff > 0 ? `save ${whole(diff)}` : `+${whole(-diff)}`}</small>
                  </span>
                </li>
              );
            })}
          </ol>
          {perRet.length > RET_SHOWN && (
            <button type="button" className={styles.mdMore} aria-expanded={allRet} onClick={() => setAllRet((v) => !v)}>
              {allRet ? "Show the top 5" : `Show all ${perRet.length} gas retailers`}
            </button>
          )}
        </section>

        {!inline && <MarketRewards fuel="G" matches={c.ranked} you={c.you} perYear={c.perYear} against={c.against} locked={none} whole={whole} />}

        {events.length > 0 && (
          <section className={styles.mdCard} aria-labelledby="gmd-feed">
            <h3 id="gmd-feed">Latest gas changes on your network</h3>
            <p className={styles.mdSub}>New gas offers, and offers a retailer has republished with new rates, discounts or terms for new customers. Each one priced for your home.</p>
            <ul className={styles.mdFeed}>
              {feedShown.map((e, i) => {
                const v = personal.vs(e);
                return (
                  <li key={`${e.retailer}|${e.plan}|${i}`}>
                    <span className={styles.mdDate}>{shortDay(e.date)}</span>
                    <RetailerLogo name={e.retailer} size={28} square />
                    <span className={styles.mdWho}>
                      <b>{e.retailer}</b>
                      <small title={e.plan}>{e.plan}</small>
                    </span>
                    <span className={e.kind === "new" ? styles.mdTagNew : styles.mdTagPrice}>{e.kind === "new" ? "New offer" : "Updated offer"}</span>
                    {v && <span className={v.tone === "better" ? styles.mdVsGood : v.tone === "worse" ? styles.mdVsBad : styles.mdVsMuted}>{v.text}</span>}
                  </li>
                );
              })}
            </ul>
            {events.length > FEED_SHOWN && (
              <button type="button" className={styles.mdMore} aria-expanded={allFeed} onClick={() => setAllFeed((v) => !v)}>
                {allFeed ? "Show the latest 10" : `Show all ${events.length} changes`}
              </button>
            )}
          </section>
        )}
        {!inline && <button type="button" className={styles.mdBackBottom} onClick={onClose}>← Back to my dashboard</button>}
      </div>
  );
  if (inline) return body;
  return createPortal(
    <div className={styles.mdOverlay} role="dialog" aria-modal="true" aria-labelledby="gmd-title">
      <div className={styles.mdBar}>
        <button type="button" className={styles.mdBack} onClick={onClose}>← Back to my dashboard</button>
        <span className={styles.mdNet}>{c.zone} gas · last 30 days</span>
      </div>
      {body}
    </div>,
    document.body,
  );
}

/* ---------- My home, on the gas side (2 Nov 2026) ----------
   Gas details and gas usage only: no meter number, tariff or solar from the
   power bill. Without a gas bill: what an average gas home uses through the
   year, and a clear "add your gas bill". */
export function GasHome({ member, name, address, uploadHref = "#read-bill" }: { member: GasMember; name: string | null; address: string | null; uploadHref?: string }) {
  const c = useGasCtx(member);
  const f = useMemo<GasForecast | null>(() => {
    if (!c) return null;
    const share = heatingShareFor(null, c.mj / c.days);
    const now = c.haveBill ? gasPricer({ bill: c.you, mj: c.mj, days: c.days, supplyPerDay: medianGasSupply(c.zone) }) : typicalGasPricer(c.zone);
    return forecastGasYear({ mj: c.mj, days: c.days, endIso: null, heatingShare: share, now, best: planGasPricer(c.top.plan) });
  }, [c]);
  const est = !!member.estimate;
  const days = member.gas_billing_days ?? 0;
  const mj = member.gas_mj ?? 0;
  const perDay = days > 0 ? Math.round(mj / days) : 0;
  // 6 Nov 2026: twelve bars, not thirteen (the forecast can end part-way into the same month next year).
  const months = f ? f.months.slice(0, 12) : [];
  const maxMj = months.length ? Math.max(...months.map((m) => m.mj), 1) : 1;
  const peak = months.length ? months.reduce((a, m) => (m.mj / m.days > a.mj / a.days ? m : a), months[0]) : null;
  const row = (label: string, value: string | null, hint = est ? "From your gas bill" : "From your next gas bill") => (
    <div className={styles.ghRow}><span>{label}</span>{value ? <b>{value}</b> : <i>{hint}</i>}</div>
  );
  return (
    <div className={styles.ghWrap}>
      {!est && c && member.gas_reference_total !== null && member.gas_reference_total > 0 && (
        <GasBillPlain uploadHref={uploadHref} total={member.gas_reference_total} mj={mj} days={days} zone={c.zone} retailer={member.gas_current_retailer ?? null} planName={member.gas_current_plan_name ?? null} annualMj={f?.annualMj ?? null} yearNow={f?.yearNow ?? null} />
      )}
      <section className={styles.ghCard} aria-labelledby="gas-home-title">
        <h3 id="gas-home-title"><Icon name="flame" size={16} /> Your gas plan &amp; home</h3>
        {row("Name", name, "From your bill")}
        {row("Supply address", address, "From your bill")}
        {row("Gas network", member.gas_zone ? `${member.gas_zone}${member.zone_guessed ? " (our guess from your postcode)" : ""}` : null)}
        {row("Gas retailer", member.gas_current_retailer ?? null)}
        {row("Current gas offer", member.gas_current_plan_name ?? null)}
        {!est && row("Last gas bill", member.gas_reference_total !== null ? `${whole(member.gas_reference_total)} for ${days} days` : null)}
      </section>

      {est && (
        <section className={styles.ghAdd} aria-labelledby="gas-add-title">
          <span className={styles.ghAddIcon} aria-hidden="true"><Icon name="flame" size={20} /></span>
          <div>
            <h3 id="gas-add-title">Add your gas bill</h3>
            <p>Until then everything on the gas side is an average Victorian gas home ({perDay} MJ a day). Your bill gives your real usage, your retailer and your rates, and we start re-checking gas every morning, like power.</p>
            <a className={styles.ghAddBtn} href={uploadHref}><Icon name="camera" size={16} /> Upload my gas bill</a>
          </div>
        </section>
      )}

      {f && (
        <section className={styles.ghCard} aria-labelledby="gas-use-title">
          <h3 id="gas-use-title">{est ? "An average gas home through the year" : "Your gas use through the year"}</h3>
          <div className={styles.ghStats}>
            <div><b>{Math.round(mj).toLocaleString("en-AU")} MJ</b><span>{est ? "average home" : "last bill"} ({days} days)</span></div>
            <div><b>{perDay} MJ</b><span>a day</span></div>
            <div><b>{Math.round(f.annualMj).toLocaleString("en-AU")} MJ</b><span>expected a year</span></div>
          </div>
          <div className={styles.ghBars} role="img" aria-label={`Gas use by month for the next 12 months; most in ${peak ? MONTH_NAMES[peak.month] : "winter"}`}>
            {months.map((m, i) => (
              <div key={`${m.year}-${m.month}`} className={styles.ghBar}>
                <span className={`${styles.ghFill} ${i === 0 ? styles.ghNow : ""} ${peak && m === peak ? styles.ghPeak : ""}`} style={{ height: `${Math.max(6, (m.mj / maxMj) * 100)}%` }} />
                <span className={styles.ghMonth}>{short(m.month).slice(0, 1)}</span>
              </div>
            ))}
          </div>
          <p className={styles.ghNote}>
            {peak ? <>Most gas in <b>{MONTH_NAMES[peak.month]}</b>, about {Math.round(peak.mj).toLocaleString("en-AU")} MJ. </> : null}
            Heating drives gas: winter months use several times what summer does.{est ? <> <a href={uploadHref}>Add your gas bill</a> for your own pattern.</> : null}
          </p>
        </section>
      )}
    </div>
  );
}

/* ---------- Your gas bill in plain English (6 Nov 2026) ----------
   The gas bill gives the total, the MJ and the days, not the rates. So the
   connection charge is the usual one on their network, and the gas rate is
   what's left of the bill, per MJ. Both are shown as "about". */
function GasBillPlain({ uploadHref, total, mj, days, zone, retailer, planName, annualMj, yearNow }: {
  uploadHref: string; total: number; mj: number; days: number; zone: GasZone; retailer: string | null; planName: string | null; annualMj: number | null; yearNow: number | null;
}) {
  if (!(mj > 0) || !(days > 0)) return null;
  const perDay = mj / days;
  const typicalYear = TYPICAL_MJ_PER_DAY * 365;
  const ratio = annualMj ? annualMj / typicalYear : perDay / TYPICAL_MJ_PER_DAY;
  const supplyDay = medianGasSupply(zone);
  const supply = Math.round(Math.min(supplyDay * days, total * 0.9) * 100) / 100;
  const used = Math.round((total - supply) * 100) / 100;
  const rate = used / mj; // $ a MJ
  // Only split the bill when the result looks like a real gas rate (2c to 8c a MJ). A small summer
  // bill, a discount or a cheaper connection charge can make the split meaningless; then show the all-in cost.
  const split = rate >= 0.02 && rate <= 0.08;
  const allIn = total / mj;
  const perMonth = (total / days) * (365 / 12);
  const c$ = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const cents = (d: number) => `${(d * 100).toLocaleString("en-AU", { maximumFractionDigits: 1 })}c`;
  const n = (x: number) => Math.round(x).toLocaleString("en-AU");
  return (
    <section className={bx.box} aria-labelledby="gas-plain-title">
      <div className={bx.headRow}>
        <div className={bx.head}>
          <h3 id="gas-plain-title" className={bx.title}>Your gas bill in plain English</h3>
          <p className={bx.sub}>{[retailer, planName].filter(Boolean).join(" · ")}{retailer || planName ? " · " : ""}{days} days</p>
        </div>
        <a className={bx.upload} href={uploadHref}><Icon name="camera" size={15} /> Upload a new bill</a>
      </div>
      <div className={bx.tiles}>
        <div className={bx.tile}>
          <div className={bx.tileHead}>
            <span className={`${bx.icon} ${bx.iUse}`} aria-hidden="true"><Icon name="flame" size={18} /></span>
            <span className={bx.label}>You used</span>
            <b className={bx.big}>{n(mj)} MJ</b>
          </div>
          <p>
            About {n(perDay)} MJ a day.{" "}
            {annualMj ? <>Over a year that&apos;s about {n(annualMj)} MJ, </> : null}
            {ratio < 0.9 ? `about ${Math.round(ratio * 100)}% of a typical Victorian gas home` : ratio > 1.1 ? `about ${Math.round((ratio - 1) * 100)}% more than a typical gas home` : "about the same as a typical gas home"}
            {ratio < 0.5 ? ": the pattern of gas for cooking and hot water rather than heating." : "."}
          </p>
          <p className={bx.hint}>An MJ (megajoule) is the unit gas is sold in: a cooktop burner on high uses about 1 MJ every 5 or 6 minutes.</p>
        </div>
        <div className={bx.tile}>
          <div className={bx.tileHead}>
            <span className={`${bx.icon} ${bx.iRate}`} aria-hidden="true"><Icon name="dollar" size={18} /></span>
            <span className={bx.label}>{split ? "Each MJ costs about" : "All in, each MJ cost"}</span>
            <b className={bx.big}>{cents(split ? rate : allIn)}</b>
          </div>
          <p>
            {split
              ? "An average for this bill. Most gas plans charge more for the first MJ each day and less after that, so heavy users pay less per MJ."
              : "Including the daily connection charge. On a small bill most of the money is the connection charge, so each MJ looks dear. It evens out in winter."}
          </p>
        </div>
        {supply > 0 && (
          <div className={bx.tile}>
            <div className={bx.tileHead}>
              <span className={`${bx.icon} ${bx.iSupply}`} aria-hidden="true"><Icon name="home" size={18} /></span>
              <span className={bx.label}>Just for being connected</span>
              <b className={bx.big}>about {c$(supplyDay)} a day</b>
            </div>
            <p>
              {split
                ? <>About {c$(supply)} on this bill, {Math.round((supply / total) * 100)}% of it, going by the usual charge on {zone}.</>
                : <>The usual charge on {zone}: about {c$(supplyDay * days)} over {days} days, so most of a bill like this.</>}{" "}
              You pay it even in summer, when you hardly use gas.
            </p>
          </div>
        )}
      </div>
      {split && supply > 0 && used > 0 && (
        <div className={bx.split}>
          <span className={bx.label}>Where the money went (about)</span>
          <div className={bx.bar} role="img" aria-label={`Gas you used about ${c$(used)}, being connected about ${c$(supply)}`}>
            <span className={bx.segUse} style={{ flexGrow: used }} />
            <span className={bx.segSupply} style={{ flexGrow: supply }} />
          </div>
          <ul className={bx.key}>
            <li><i className={bx.segUse} /> Gas you used <b>{c$(used)}</b></li>
            <li><i className={bx.segSupply} /> Being connected <b>{c$(supply)}</b></li>
          </ul>
        </div>
      )}
      <p className={bx.total}>
        <span>This bill: <b>{c$(total)}</b></span>
        <span>About <b>{c$(perMonth)} a month</b> at this rate{yearNow ? <>; about <b>{whole(yearNow)} over a year</b>, with winter</> : null}</span>
      </p>
    </section>
  );
}

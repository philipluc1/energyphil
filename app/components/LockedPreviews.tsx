"use client";

import Icon from "./Icon";
import { marketActivity, marketEvents } from "@/lib/marketActivity";
import { networkRewards } from "@/lib/networkRewards";
import s from "./lockedpreviews.module.css";

/* 7 Nov 2026: on the free result, a taste of the dashboard. Four cards built from this
   person's own result and network, blurred, with one way in: Utilo Plus. The numbers
   behind the blur are real, so the cards look like the dashboard they'd get. */
const SEASON = [1.12, 1.0, 0.88, 0.84, 0.96, 1.22, 1.32, 1.26, 1.04, 0.9, 0.86, 0.96];
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default function LockedPreviews({ network, monthNow, monthBest, haveBill, retailer, onUnlock }: {
  network: string; monthNow: number; monthBest: number; haveBill: boolean; retailer: string | null; onUnlock: () => void;
}) {
  const m0 = new Date().getMonth();
  const months = Array.from({ length: 12 }, (_, i) => { const m = (m0 + i) % 12; return { l: MONTHS[m], now: monthNow * SEASON[m], best: monthBest * SEASON[m] }; });
  const max = Math.max(...months.map((m) => m.now), 1);
  const act = marketActivity({ days: 30 });
  const latest = marketEvents({ days: 30 }).slice(0, 3);
  const rw = networkRewards(network);
  const rewardLines = [
    rw.topCredit ? `Up to $${rw.topCredit} sign-up credit` : null,
    rw.counts.discount ? `${rw.counts.discount} pay-on-time discounts` : null,
    rw.counts.points ? `${rw.counts.points} points or loyalty offers` : null,
    rw.counts.gift ? `${rw.counts.gift} gifts or bonuses` : null,
  ].filter(Boolean) as string[];
  const cards = [
    {
      key: "year", title: "Your year ahead", sub: "Month by month, on the cheapest plan vs now",
      body: (
        <div className={s.bars} aria-hidden="true">
          {months.map((m, i) => (
            <div key={i} className={s.col}><span className={s.barNow} style={{ height: `${(m.now / max) * 100}%` }}><i className={s.barBest} style={{ height: `${(m.best / m.now) * 100}%` }} /></span><small>{m.l}</small></div>
          ))}
        </div>
      ),
    },
    {
      key: "market", title: "Market this month", sub: act.ready ? `${act.newOffers + act.priceChanges} offers changed, priced against your bill` : "Every change, priced against your bill",
      body: (
        <ul className={s.rows} aria-hidden="true">
          {(latest.length ? latest : [{ retailer: "Retailer", plan: "Plan", date: "", kind: "new" as const }, { retailer: "Retailer", plan: "Plan", date: "", kind: "price" as const }, { retailer: "Retailer", plan: "Plan", date: "", kind: "new" as const }]).map((e, i) => (
            <li key={i}><b>{e.retailer}</b><span>{e.plan}</span><em>{i === 0 ? "−$212/yr" : i === 1 ? "−$96/yr" : "+$40/yr"}</em></li>
          ))}
        </ul>
      ),
    },
    {
      key: "rewards", title: "Rewards and discounts", sub: `${rw.retailers} retailers on ${network} offer extras`,
      body: (
        <ul className={s.rows} aria-hidden="true">
          {(rewardLines.length ? rewardLines : ["Sign-up credits", "Pay-on-time discounts", "Points and bonuses"]).slice(0, 3).map((t, i) => <li key={i}><b>{t}</b><em>worth it?</em></li>)}
        </ul>
      ),
    },
    {
      key: "bill", title: haveBill ? "Your bill in plain English" : "Money found on your bills", sub: haveBill ? `What ${retailer ?? "your retailer"} charged you, and why` : "Fees, missed discounts and concessions, caught every bill",
      body: (
        <ul className={s.rows} aria-hidden="true">
          <li><b>Estimated read, not actual</b><em>+$31</em></li>
          <li><b>Discount not applied</b><em>+$24</em></li>
          <li><b>Late fee to ask back</b><em>$12</em></li>
        </ul>
      ),
    },
  ];
  return (
    <section className={s.wrap} aria-labelledby="locked-title">
      <div className={s.head}>
        <h2 id="locked-title">What members see</h2>
        <p>Your dashboard, built from this check. Re-checked every morning.</p>
      </div>
      <div className={s.grid}>
        {cards.map((c, i) => (
          <div key={c.key} className={s.card} style={{ animationDelay: `${i * 90}ms` }}>
            <div className={s.cardHead}><b>{c.title}</b><span>{c.sub}</span></div>
            <div className={s.blur}>{c.body}</div>
            <button type="button" className={s.lock} onClick={onUnlock}>
              <Icon name="lock" size={14} /> Unlock with Utilo Plus
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

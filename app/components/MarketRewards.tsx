"use client";

import { useMemo, useState } from "react";
import Icon from "./Icon";
import InfoTip from "./InfoTip";
import RetailerLogo from "./RetailerLogo";
import { extrasFor } from "@/lib/planExtras";
import { rewardsIn, REWARD_KIND_LABEL, type Reward, type RewardKind } from "@/lib/rewards";
import type { PlanRow } from "@/lib/plans";
import styles from "./marketrewards.module.css";

// "Discounts and rewards" on the dashboard's market page: every sign-up
// credit, points offer, gift card and % discount on the member's network,
// each with what that plan costs them a year against their bill. Credits,
// points and gifts are never in our prices; the page says so.

type Match = { plan: PlanRow; total: number; restricted: string | null };
type Item = { m: Match; r: Reward; diff: number };
type Tab = "all" | RewardKind;

const KINDS: RewardKind[] = ["credit", "points", "gift", "discount"];
const SHOW = 8;

function KindIcon({ kind }: { kind: RewardKind }) {
  if (kind === "points") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
    );
  }
  return <Icon name={kind === "credit" ? "dollar" : kind === "gift" ? "gift" : "tag"} size={18} />;
}

/** One entry per retailer and reward, on that retailer's cheapest plan carrying it. */
export function rewardItems(matches: Match[], you: number, perYear: number): Item[] {
  const best = new Map<string, Item>();
  for (const m of matches) {
    if (m.restricted) continue;
    for (const r of rewardsIn(extrasFor("E", m.plan[0], m.plan[2], m.plan[1]))) {
      const key = `${m.plan[0]}|${r.kind}|${r.headline.toLowerCase()}`;
      const had = best.get(key);
      if (!had || m.total < had.m.total) best.set(key, { m, r, diff: (you - m.total) * perYear });
    }
  }
  return [...best.values()].sort((a, b) => KINDS.indexOf(a.r.kind) - KINDS.indexOf(b.r.kind) || b.r.value - a.r.value || a.m.total - b.m.total);
}

/**
 * The dashboard's side card: the best of each kind (biggest credit, most
 * points, a gift, the biggest % off) and a button to the full section.
 */
export function RewardsSideCard({ items, locked, onOpen }: { items: Item[]; locked: Set<unknown>; onOpen: () => void }) {
  if (items.length === 0) return null;
  const picks = KINDS.map((k) => items.find((i) => i.r.kind === k)).filter((i): i is Item => !!i).slice(0, 3);
  const retailers = new Set(items.map((i) => i.m.plan[0])).size;
  return (
    <section
      className={styles.side}
      aria-labelledby="rewards-side-title"
      onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a")) onOpen(); }}
    >
      <span className={styles.sideTag}><Icon name="gift" size={13} /> On your network today</span>
      <h3 id="rewards-side-title" className={styles.sideTitle}>
        <b>{items.length}</b> discounts and rewards
      </h3>
      <p className={styles.sideLine}>Sign-up credits, points and perks from {retailers} retailers.</p>
      <ul className={styles.sideList}>
        {picks.map(({ m, r }, i) => (
          <li key={`${r.kind}|${r.headline}|${m.plan[0]}`} className={styles[r.kind]} style={{ animationDelay: `${120 + i * 90}ms` }}>
            <span className={styles.kindIcon}><KindIcon kind={r.kind} /></span>
            <span className={styles.sideWhat}>
              <b>{r.headline}</b>
              <small>{locked.has(m) ? "Plus members see the retailer" : m.plan[0]}</small>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className={styles.sideMore} onClick={onOpen}>See all {items.length} rewards →</button>
    </section>
  );
}

export default function MarketRewards({
  matches,
  you,
  perYear,
  against,
  locked,
  whole,
}: {
  matches: Match[];
  you: number;
  perYear: number;
  against: string;
  locked: Set<unknown>;
  whole: (n: number) => string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [more, setMore] = useState(false);

  const items = useMemo(() => rewardItems(matches, you, perYear), [matches, you, perYear]);

  const counts = Object.fromEntries(KINDS.map((k) => [k, items.filter((i) => i.r.kind === k).length])) as Record<RewardKind, number>;
  const shown = tab === "all" ? items : items.filter((i) => i.r.kind === tab);
  const visible = more ? shown : shown.slice(0, SHOW);
  const topCredit = items.find((i) => i.r.kind === "credit" && i.r.value > 0);
  const topPoints = items.find((i) => i.r.kind === "points" && i.r.value > 0);

  if (items.length === 0) return null;

  return (
    <section className={styles.card} aria-labelledby="md-rewards">
      <div className={styles.head}>
        <h3 id="md-rewards">Discounts and rewards</h3>
        <InfoTip label="How rewards are counted">
          Sign-up credits, points and gifts are <b>not</b> in our prices: we rank plans on what you&apos;d pay over a year. Most are for new customers, and many need you to stay a set time (often 90 days) before they&apos;re paid. % discounts marked &quot;in the price&quot; are already counted.
        </InfoTip>
      </div>
      <p className={styles.sub}>Credits, points and perks on offer on your network today, with what each plan costs you a year against {against}.</p>

      {(topCredit || topPoints) && (
        <div className={styles.highlights}>
          {topCredit && (
            <div className={`${styles.hl} ${styles.hlCredit}`}>
              <span className={styles.hlIcon}><KindIcon kind="credit" /></span>
              <span><b>{topCredit.r.headline}</b><small>Biggest sign-up credit{locked.has(topCredit.m) ? "" : `, ${topCredit.m.plan[0]}`}</small></span>
            </div>
          )}
          {topPoints && (
            <div className={`${styles.hl} ${styles.hlPoints}`}>
              <span className={styles.hlIcon}><KindIcon kind="points" /></span>
              <span><b>{topPoints.r.headline}</b><small>Most points{locked.has(topPoints.m) ? "" : `, ${topPoints.m.plan[0]}`}</small></span>
            </div>
          )}
          <div className={styles.hl}>
            <span className={styles.hlIcon}><KindIcon kind="gift" /></span>
            <span><b>{items.length}</b><small>rewards from {new Set(items.map((i) => i.m.plan[0])).size} retailers</small></span>
          </div>
        </div>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Kind of reward">
        {(["all", ...KINDS] as Tab[]).map((t) => {
          const n = t === "all" ? items.length : counts[t];
          if (t !== "all" && n === 0) return null;
          return (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${styles.tab} ${tab === t ? styles.tabOn : ""}`} onClick={() => { setTab(t); setMore(false); }}>
              {t !== "all" && <KindIcon kind={t} />}
              {t === "all" ? "All" : REWARD_KIND_LABEL[t]} <span className={styles.n}>{n}</span>
            </button>
          );
        })}
      </div>

      <ul key={tab} className={styles.grid}>
        {visible.map(({ m, r, diff }, i) => {
          const hide = locked.has(m);
          return (
            <li key={`${m.plan[0]}|${r.kind}|${r.headline}`} className={`${styles.item} ${styles[r.kind]}`} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
              <div className={styles.itemTop}>
                <span className={styles.kindIcon}><KindIcon kind={r.kind} /></span>
                <b className={styles.headline}>{r.headline}</b>
              </div>
              <p className={styles.detail}>{r.detail ?? "Check the retailer's terms for who gets it and when."}</p>
              <div className={styles.who}>
                {hide ? <span className={styles.lock}><Icon name="lock" size={13} /></span> : <RetailerLogo name={m.plan[0]} size={26} square />}
                <span>
                  <b>{hide ? "Plus members see this retailer" : m.plan[0]}</b>
                  <small title={hide ? undefined : m.plan[2]}>{hide ? "Retailer and plan hidden" : m.plan[2]}</small>
                </span>
              </div>
              {r.kind === "credit" && r.value > 0 && (() => {
                // Year one has the credit; later years don't. Against what they pay now.
                const nowYear = you * perYear;
                const planYear = nowYear - diff;
                const y1 = Math.max(0, planYear - r.value);
                const top = Math.max(nowYear, planYear, 1);
                const rows: [string, number, string][] = [
                  [against[0].toUpperCase() + against.slice(1), nowYear, styles.ybNow],
                  ["Year 1", y1, styles.ybOne],
                  ["Year 2 on", planYear, styles.ybLater],
                ];
                return (
                  <div className={styles.years} aria-label={`Year one ${whole(y1)}, later years ${whole(planYear)}, against ${whole(nowYear)} now`}>
                    {rows.map(([label, v, cls]) => (
                      <div key={label} className={styles.yRow}>
                        <span>{label}</span>
                        <span className={styles.yTrack}><i className={cls} style={{ width: `${(v / top) * 100}%` }} /></span>
                        <b>{whole(v)}</b>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className={styles.foot}>
                {r.kind === "discount" && <span className={r.inPrice ? styles.inPrice : styles.notPrice}>{r.inPrice ? "In the price" : "Not in our price"}</span>}
                <span className={diff >= 1 ? styles.pos : diff <= -1 ? styles.neg : styles.same}>
                  {Math.abs(diff) < 1 ? "Same as now" : diff > 0 ? `Plan saves ${whole(diff)}/yr` : `Plan costs ${whole(-diff)}/yr more`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length > SHOW && (
        <button type="button" className={styles.more} onClick={() => setMore((v) => !v)}>
          {more ? "Show fewer" : `Show all ${shown.length}`}
        </button>
      )}
    </section>
  );
}

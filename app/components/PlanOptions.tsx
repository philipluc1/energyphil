"use client";

import { RETAILER_LINKS } from "@/lib/retailerLinks";
import RetailerLogo from "./RetailerLogo";
import s from "./planoptions.module.css";

// 14 Nov 2026 (Phil): "Your options", so a comparison becomes a decision.
// Up to three: stay with your retailer on a better plan; the cheapest
// anywhere; the cheapest with no pay-on-time or direct-debit conditions.

export interface PlanOption {
  key: "stay" | "cheapest" | "nostrings";
  retailer: string;
  plan: string;
  /** A year. */
  cost: number;
  /** A year, against what they pay now (negative = costs more). */
  saving: number;
  pick: boolean;
  same: boolean;
}

const whole = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-AU")}`;
const TITLE: Record<PlanOption["key"], (o: PlanOption) => string> = {
  stay: (o) => `Stay with ${o.retailer}, change plan`,
  cheapest: () => "Cheapest anywhere",
  nostrings: () => "Cheapest with no conditions",
};
const SUB: Record<PlanOption["key"], string> = {
  stay: "No switching retailer. Ask them to move you.",
  cheapest: "The lowest price for your usage today.",
  nostrings: "No pay-on-time or direct-debit discount to keep.",
};

export default function PlanOptions({ options, against, network, fuel = "E", title = "Your options" }: { options: PlanOption[]; against: string; network: string; fuel?: "E" | "G"; title?: string }) {
  if (options.length < 2) return null;
  return (
    <section className={s.wrap} aria-labelledby={`opts-h-${fuel}`}>
      <h3 id={`opts-h-${fuel}`} className={s.h}>{title}</h3>
      <div className={s.grid}>
        {options.map((o) => {
          const link = RETAILER_LINKS[o.retailer];
          return (
            <article key={o.key} className={`${s.card} ${o.pick ? s.pick : ""}`}>
              {o.pick && <span className={s.pickTag}>★ Our pick</span>}
              <span className={s.title}>{TITLE[o.key](o)}</span>
              <span className={s.sub}>{SUB[o.key]}</span>
              <div className={s.who}>
                <RetailerLogo name={o.retailer} size={36} square />
                <span className={s.names}><b>{o.retailer}</b><small>{o.plan}</small></span>
              </div>
              <div className={s.money}>
                <span className={s.cost}>{whole(o.cost)}<small> a year</small></span>
                <span className={o.saving >= 1 ? s.save : s.more}>{o.saving >= 1 ? `Save ${whole(o.saving)}` : o.saving <= -1 ? `${whole(o.saving)} more` : "About the same"}</span>
              </div>
              <span className={s.vs}>vs {against}</span>
              {link && o.saving >= 1 && (
                <a href={link} data-plan={o.plan} data-network={network} data-fuel={fuel} data-same={o.same ? "1" : undefined} target="_blank" rel="noopener noreferrer" className={s.go}>
                  {o.same ? `Change plan with ${o.retailer} →` : `Go to ${o.retailer} →`}
                </a>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

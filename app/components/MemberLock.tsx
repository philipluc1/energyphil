"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";
import { plusValue } from "@/lib/pricingPlans";
import m from "./memberlock.module.css";

/** "$7 a month ($84 a year), or $39 yearly: save $45. Cancel any time." From the price list, so it never drifts. */
const v = plusValue();
export const MEMBER_PRICE_LINE = `${v.monthly} a month (${v.monthlyYear} a year), or ${v.annual} yearly: save ${v.save}. Cancel any time.`;

// Shapes for the blurred placeholder rows (no real plan names are in the page).
const BAR = [62, 48, 70, 55, 66, 44, 58, 50];

function useInView<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}

/**
 * A members-only teaser: blurred content that keeps moving behind glass, with
 * a card that rises in when it scrolls into view and a "join" button.
 *  - variant "list": a slow ticker of placeholder plan rows (startRank onwards)
 *  - variant "panel": the real content (a chart) blurred and made inert
 */
export default function MemberLock({
  variant,
  title,
  body,
  cta,
  onJoin,
  startRank = 4,
  children,
}: {
  variant: "list" | "panel";
  title: ReactNode;
  body: ReactNode;
  cta: string;
  onJoin: () => void;
  startRank?: number;
  children?: ReactNode;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const rows = BAR.map((w, i) => (
    <div className={m.row} key={i}>
      <div className={m.rowLeft}>
        <span className={m.rk}>#{startRank + i}</span>
        <div className={m.lines}>
          <span className={m.bar} style={{ width: `${w}%` }} />
          <span className={m.bar2} style={{ width: `${Math.max(30, w - 18)}%` }} />
        </div>
      </div>
      <span className={m.price}>$••.••</span>
    </div>
  ));

  return (
    <div ref={ref} className={`${m.lock} ${variant === "list" ? m.list : m.panel} ${inView ? m.in : ""}`}>
      {variant === "list" ? (
        <div className={m.ghost} aria-hidden="true">
          <div className={m.ticker}>
            {rows}
            {rows}
          </div>
        </div>
      ) : (
        <div className={m.panelGhost} aria-hidden="true" inert>
          {children}
        </div>
      )}
      <div className={m.sheen} aria-hidden="true" />
      <div className={m.card} role="region" aria-label="Members only">
        <span className={m.lockIcon}>
          <Icon name="lock" size={22} />
        </span>
        <b className={m.title}>{title}</b>
        <p className={m.body}>{body}</p>
        <button type="button" className={m.cta} onClick={onJoin}>
          {cta} <span aria-hidden="true">→</span>
        </button>
        <small className={m.price2}>{MEMBER_PRICE_LINE}</small>
      </div>
    </div>
  );
}

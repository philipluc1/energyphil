"use client";

import { useEffect, useState } from "react";
import s from "./fun.module.css";

// "That's about 84 flat whites": the yearly saving as things people buy, one
// at a time, crossfading every few seconds under the headline. Rough
// everyday prices, rounded hard, so it reads as a feel for the number rather
// than a claim. Only shown when there's a real saving.

interface Thing {
  emoji: string;
  /** Typical price in dollars. */
  price: number;
  one: string;
  many: string;
  /** Show only when the saving covers at least this many. */
  min?: number;
}

const THINGS: Thing[] = [
  { emoji: "☕", price: 5.5, one: "flat white", many: "flat whites", min: 10 },
  { emoji: "⛽", price: 90, one: "tank of petrol", many: "tanks of petrol", min: 2 },
  { emoji: "🛒", price: 220, one: "week of groceries", many: "weeks of groceries", min: 1 },
  { emoji: "🍿", price: 19, one: "month of streaming", many: "months of streaming", min: 3 },
  { emoji: "🍔", price: 30, one: "pub meal", many: "pub meals", min: 4 },
  { emoji: "🏖️", price: 450, one: "weekend away", many: "weekends away", min: 1 },
  { emoji: "🎟️", price: 45, one: "footy ticket", many: "footy tickets", min: 3 },
];

export function equivalents(dollars: number): { emoji: string; text: string }[] {
  if (!(dollars > 0)) return [];
  const out: { emoji: string; text: string }[] = [];
  for (const t of THINGS) {
    const n = Math.floor(dollars / t.price);
    if (n < (t.min ?? 1)) continue;
    out.push({ emoji: t.emoji, text: n === 1 ? `a ${t.one}` : `${n.toLocaleString("en-AU")} ${t.many}` });
  }
  return out;
}

export default function FunEquivalents({ dollars, dark = false, suffix = "a year" }: { dollars: number; dark?: boolean; /** "a year" (default) or e.g. "so far" for a running total. */ suffix?: string }) {
  const list = equivalents(dollars);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 3600);
    return () => clearInterval(t);
  }, [list.length]);
  if (list.length === 0) return null;
  const cur = list[i % list.length];
  return (
    <p className={`${s.line} ${dark ? s.dark : ""}`} aria-live="polite">
      <span className={s.lead}>That&apos;s about</span>
      <span key={cur.text} className={s.item}>
        <span className={s.emoji} aria-hidden="true">{cur.emoji}</span> <b>{cur.text}</b>
      </span>
      <span className={s.lead}>{suffix}.</span>
    </p>
  );
}

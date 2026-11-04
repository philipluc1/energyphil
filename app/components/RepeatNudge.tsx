"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { useMember } from "@/lib/useMember";
import { PLUS_NAME } from "@/lib/pricingPlans";
import { REPEAT_KEY, recordCheck, showRepeatNudge } from "@/lib/repeatChecks";
import s from "./repeatnudge.module.css";

/**
 * 4 Nov 2026: on a free result, count the check (this browser, at most once an hour)
 * and, from the third in 30 days, suggest letting Utilo Plus do it. Never blocks.
 */
export default function RepeatNudge({ href = "#pricing", fuel = "power" }: { href?: string; fuel?: "power" | "gas" }) {
  const member = useMember();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let times: number[] = [];
    try {
      const raw = window.localStorage.getItem(REPEAT_KEY);
      times = recordCheck(raw ? JSON.parse(raw) : [], Date.now());
      window.localStorage.setItem(REPEAT_KEY, JSON.stringify(times));
    } catch {
      return;
    }
    const n = showRepeatNudge(times) ? times.length : 0;
    const t = setTimeout(() => setCount(n), 0);
    return () => clearTimeout(t);
  }, []);
  if (member !== false || count === 0) return null;
  const go = href.startsWith("#") ? (
    <a href={href} className={s.go}>See {PLUS_NAME} →</a>
  ) : (
    <Link href={href} className={s.go}>See {PLUS_NAME} →</Link>
  );
  return (
    <div className={s.nudge} role="note">
      <span className={s.icon} aria-hidden="true"><Icon name="refresh" size={18} /></span>
      <p>
        <b>You&apos;ve checked {count} times this month.</b>{" "}
        Let {PLUS_NAME} do it every morning, against your own {fuel === "gas" ? "gas " : ""}bill, and email you only when switching pays.
      </p>
      {go}
    </div>
  );
}

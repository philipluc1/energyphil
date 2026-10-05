"use client";

import { useEffect, useRef, useState } from "react";

/** Counts from 0 to `value` once, when scrolled into view. With reduced
 * motion (or no IntersectionObserver) it simply shows the final number. */
export default function CountUp({ value, prefix = "", suffix = "", durationMs = 1400, decimals = 0 }: { value: number; prefix?: string; suffix?: string; durationMs?: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(value * eased);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, durationMs]);

  const n = shown ?? value;
  return (
    <span ref={ref}>
      {prefix}
      {n.toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

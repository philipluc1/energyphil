"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that counts up from 0 when it scrolls into view. The real number
 * is in the page from the start (for search engines and no-JS), and stays put
 * for people who prefer reduced motion.
 */
// 7 Nov 2026: `format` (optional) renders the value, e.g. as dollars with cents, for the result hero.
export default function CountUp({ value, duration = 900, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const run = () => {
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const v = value * (1 - Math.pow(1 - p, 3));
        setShown(format ? v : Math.round(v));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setShown(0);
          run();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration, format]);
  return <span ref={ref}>{format ? format(shown) : shown.toLocaleString("en-AU")}</span>;
}

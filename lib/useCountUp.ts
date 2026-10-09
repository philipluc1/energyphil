"use client";

import { useEffect, useRef, useState } from "react";

/** Animates a number from its previous value to `target` (ease-out), so a
 *  figure "counts" when it first appears or when the period toggle changes.
 *  Jumps straight to the value for people who prefer reduced motion. */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || start === target) {
      const t = setTimeout(() => setValue(target), 0);
      from.current = target;
      return () => clearTimeout(t);
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (target - start) * eased;
      setValue(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

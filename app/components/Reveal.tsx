"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Adds data-in="1" to its wrapper the first time it scrolls into view, so CSS
// can run an entrance animation then, not on page load when nobody's looking.
// Without JS (or IntersectionObserver) the content is simply visible.
export default function Reveal({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "ul" | "ol" | "section" }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { el.dataset.in = "1"; return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { el.dataset.in = "1"; io.disconnect(); }
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const T = Tag as any;
  return <T ref={ref} className={className} data-reveal="">{children}</T>;
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Progressive-enhancement scroll-in animation: the element renders fully
// visible (normal opacity, no transform) until this mounts and confirms the
// browser actually supports IntersectionObserver and the person hasn't asked
// for reduced motion — only then does it dip to the "hidden" starting state
// and animate back in once scrolled into view. That order means nothing ever
// gets stuck invisible (no JS, old browser, reduced motion all just show the
// content normally), and the content is already off-screen the moment it
// first becomes hidden, so there's no visible flash.
export default function ScrollReveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "visible">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Deferred (not called synchronously in the effect body) so this never
    // fires as part of the same render pass — it's a reaction to an external
    // system (the browser's layout/scroll state), not a derived value.
    const hideTimer = setTimeout(() => setState("hidden"), 0);
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          revealTimer = setTimeout(() => setState("visible"), delayMs);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      clearTimeout(hideTimer);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [delayMs]);

  const stateClass = state === "hidden" ? "revealHidden" : state === "visible" ? "revealVisible" : "";

  return (
    <div ref={ref} className={`${className} ${stateClass}`.trim()}>
      {children}
    </div>
  );
}

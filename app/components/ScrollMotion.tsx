"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Gentle motion as you scroll (Oct 2026). Anything marked `data-motion` that
 * starts below the fold fades and rises into place when it scrolls into view.
 * `data-stagger="<selector>"` animates those children one after another
 * instead (cards, rows). Content already on screen is left alone, nothing is
 * hidden without JavaScript, and "reduce motion" turns it all off.
 */
export default function ScrollMotion() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const targets = new Map<Element, HTMLElement[]>();
    const show = (el: Element) => {
      for (const t of targets.get(el) ?? []) {
        t.classList.remove("revealHidden");
        t.classList.add("revealVisible");
        // Hand the element back its own transitions (hover etc.) once it has arrived.
        const wait = (parseFloat(t.style.transitionDelay) || 0) + 750;
        setTimeout(() => { t.classList.remove("revealVisible"); t.style.transitionDelay = ""; }, wait);
      }
      targets.delete(el);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    // Wait a frame so the page has laid out before measuring.
    const raf = requestAnimationFrame(() => {
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>("[data-motion]:not([data-motion-done])").forEach((el) => {
        el.dataset.motionDone = "1";
        if (el.getBoundingClientRect().top < vh * 0.9) return;
        const sel = el.dataset.stagger;
        const kids = sel ? Array.from(el.querySelectorAll<HTMLElement>(sel)) : [];
        const list = kids.length ? kids : [el];
        list.forEach((t, i) => {
          t.classList.add("revealHidden");
          t.style.transitionDelay = `${Math.min(i, 6) * 90}ms`;
        });
        targets.set(el, list);
        io.observe(el);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      // Leave nothing hidden if we navigate away mid-way.
      for (const el of targets.keys()) show(el);
    };
  }, [pathname]);
  return null;
}

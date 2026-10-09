"use client";

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import styles from "./dashtabs.module.css";

export interface TabDef<T extends string> {
  id: T;
  label: string;
  /** Small dot on the tab, e.g. "this month's check is due". */
  dot?: boolean;
}

/** Sticky tab bar with a sliding indicator. On phones the panel also
 *  responds to a left/right swipe. Only the active panel is rendered; it
 *  slides in from the side you moved towards. */
export default function DashTabs<T extends string>({
  tabs,
  active,
  onChange,
  children,
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  children: ReactNode;
}) {
  const index = Math.max(0, tabs.findIndex((t) => t.id === active));
  // Which way to slide the new panel in (React's "adjust state while
  // rendering" pattern, so no ref is read during render).
  const [prevIndex, setPrevIndex] = useState(index);
  const [dir, setDir] = useState<"left" | "right">("right");
  if (prevIndex !== index) {
    setDir(index > prevIndex ? "right" : "left");
    setPrevIndex(index);
  }
  // Stick just under the site header, whatever height it is at this width.
  const [top, setTop] = useState(0);
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const measure = () => setTop(header.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  const touch = useRef<{ x: number; y: number; skip: boolean } | null>(null);

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    const el = e.target as HTMLElement;
    touch.current = { x: t.clientX, y: t.clientY, skip: !!el.closest("input, select, textarea, [data-noswipe]") };
  }
  function onTouchEnd(e: TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start || start.skip) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const next = dx < 0 ? index + 1 : index - 1;
    if (next >= 0 && next < tabs.length) {
      onChange(tabs[next].id);
      const bar = document.getElementById("dash-tabs");
      if (bar) {
        const y = bar.getBoundingClientRect().top + window.scrollY - top - 8;
        if (window.scrollY > y) window.scrollTo({ top: y, behavior: "smooth" });
      }
    }
  }

  return (
    <>
      <div id="dash-tabs" className={styles.bar} style={{ top }} role="tablist" aria-label="Dashboard sections">
        <div className={styles.track} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          <span
            className={styles.indicator}
            style={{ width: `calc((100% - 8px) / ${tabs.length})`, transform: `translateX(${index * 100}%)` }}
            aria-hidden="true"
          />
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={t.id === active}
              aria-controls={`panel-${t.id}`}
              className={t.id === active ? styles.tabOn : styles.tab}
              onClick={() => onChange(t.id)}
            >
              {t.label}
              {t.dot && <span className={styles.dot} aria-label="needs attention" />}
            </button>
          ))}
        </div>
        <div className={styles.dots} aria-hidden="true">
          {tabs.map((t, i) => <span key={t.id} className={i === index ? styles.pageOn : styles.page} />)}
        </div>
      </div>
      <div
        key={active}
        id={`panel-${active}`}
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className={`${styles.panel} ${dir === "right" ? styles.fromRight : styles.fromLeft}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </>
  );
}

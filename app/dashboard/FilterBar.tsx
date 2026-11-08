"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PERIODS, PLANS, SOURCES, describeFilters, isFiltered, type DashFilters } from "@/lib/adminFilters";
import styles from "./dashboard.module.css";

export const SECTIONS = [
  { id: "visitors", label: "Visitors" },
  { id: "growth", label: "Members growth" },
  { id: "funnel", label: "Funnel and ad payback" },
  { id: "plan", label: "Plan vs actual" },
  { id: "cash", label: "Revenue and cash ahead" },
  { id: "value", label: "Value delivered and churn risk" },
  { id: "launch", label: "Launch" },
  { id: "revenue", label: "Revenue and retention" },
  { id: "didnt", label: "Didn't join" },
  { id: "reviews", label: "Google reviews" },
  { id: "business", label: "Business" },
  { id: "savings", label: "Customer savings" },
  { id: "market", label: "Market" },
] as const;
const HIDE_KEY = "utilo.dash.hidden";

/** Period, plan and source filters (in the address), plus which sections to show (remembered on this browser). */
export default function FilterBar({ filters }: { filters: DashFilters }) {
  const router = useRouter();
  const path = usePathname() ?? "/dashboard";
  const [hidden, setHidden] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(window.localStorage.getItem(HIDE_KEY) ?? "[]");
      return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : [];
    } catch { return []; }
  });
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.dataset.dashHide = hidden.join(" ");
    try { window.localStorage.setItem(HIDE_KEY, JSON.stringify(hidden)); } catch { /* private window */ }
  }, [hidden]);

  function go(next: Partial<DashFilters>) {
    const f = { ...filters, ...next };
    const q = new URLSearchParams();
    if (f.period !== "all") q.set("period", f.period);
    if (f.plan !== "all") q.set("plan", f.plan);
    if (f.source !== "all") q.set("source", f.source);
    startTransition(() => router.replace(q.toString() ? `${path}?${q}` : path, { scroll: false }));
  }

  const group = <T extends string>(label: string, opts: readonly { id: T; label: string }[], value: T, key: keyof DashFilters) => (
    <div className={styles.fGroup} role="group" aria-label={label}>
      <span className={styles.fLabel}>{label}</span>
      <div className={styles.fChips}>
        {opts.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} className={value === o.id ? styles.chipOn : styles.chip} onClick={() => go({ [key]: o.id } as Partial<DashFilters>)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`${styles.filterBar} ${pending ? styles.filterPending : ""}`}>
      {group("Period", PERIODS, filters.period, "period")}
      {group("Plan", PLANS, filters.plan, "plan")}
      {group("Came from", SOURCES, filters.source, "source")}
      <div className={styles.fFoot}>
        <span className={styles.fNow}>
          Showing: <b>{describeFilters(filters)}</b>
          {isFiltered(filters) && <button type="button" className={styles.fReset} onClick={() => go({ period: "all", plan: "all", source: "all" })}>Reset</button>}
        </span>
        <button type="button" className={`${styles.fReset} ${styles.fSections}`} aria-expanded={open} onClick={() => setOpen((x) => !x)} suppressHydrationWarning>
          Sections{hidden.length ? ` (${SECTIONS.length - hidden.length} of ${SECTIONS.length})` : ""} {open ? "▴" : "▾"}
        </button>
      </div>
      {open && (
        <div className={`${styles.fChips} ${styles.fWrap}`} role="group" aria-label="Sections to show">
          {SECTIONS.map((s) => {
            const on = !hidden.includes(s.id);
            return (
              <button key={s.id} type="button" aria-pressed={on} className={on ? styles.chipOn : styles.chip} onClick={() => setHidden((h) => (on ? [...h, s.id] : h.filter((x) => x !== s.id)))}>
                {on ? "✓ " : ""}{s.label}
              </button>
            );
          })}
        </div>
      )}
      <p className={styles.fNote}>Revenue, paying members and cancellations-due are today&apos;s figures, so the period doesn&apos;t change them; plan and source do. Leads and checks have no plan, so the plan filter doesn&apos;t touch them.</p>
    </div>
  );
}

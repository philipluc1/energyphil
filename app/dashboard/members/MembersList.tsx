"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { findPlan } from "@/lib/pricingPlans";
import styles from "../dashboard.module.css";

export interface MemberListItem {
  id: string;
  email: string;
  name: string | null;
  place: string | null;
  retailer: string | null;
  plan: string;
  state: "active" | "ending" | "failed" | "cancelled";
  endsAt: string | null;
  joined: string;
  monthlyCents: number;
  source: string | null;
}

const STATE: Record<MemberListItem["state"], { label: string; cls: string }> = {
  active: { label: "Active", cls: styles.pillGood },
  ending: { label: "Ending", cls: styles.pillWarn },
  failed: { label: "Payment failed", cls: styles.pillBad },
  cancelled: { label: "Cancelled", cls: styles.pillSoft },
};
const FILTERS = [["all", "All"], ["active", "Active"], ["ending", "Ending"], ["failed", "Payment failed"], ["cancelled", "Cancelled"]] as const;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Melbourne" });

/** Searchable members table. The search runs in the browser, so nothing personal goes in the address bar. */
export default function MembersList({ items }: { items: MemberListItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number][0]>("all");
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.state] = (c[i.state] ?? 0) + 1;
    return c;
  }, [items]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => (f === "all" || i.state === f) && (!t || [i.email, i.name, i.place, i.retailer].some((x) => x?.toLowerCase().includes(t))));
  }, [items, q, f]);
  return (
    <div className={styles.tableCard}>
      <div className={styles.toolbar}>
        <input className={styles.search} type="search" placeholder="Search name, email, suburb or retailer" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className={f === k ? styles.chipOn : styles.chip} onClick={() => setF(k)}>
            {label} {counts[k] ?? 0}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className={styles.emptyNote}>{items.length === 0 ? "No members yet." : "Nobody matches that."}</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th>Member</th><th className={styles.hideSm}>Status</th><th className={styles.hideSm}>Plan</th><th className={styles.hideSm}>Joined</th><th className={styles.hideSm}>Worth a month</th><th className={styles.hideSm}>Came from</th></tr></thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.id} className={styles.clickRow} onClick={() => router.push(`/dashboard/members/${i.id}`)}>
                  <td>
                    <a className={styles.rowLink} href={`/dashboard/members/${i.id}`} onClick={(e) => e.preventDefault()}>
                      <b>{i.name ?? i.email} <span className={`${STATE[i.state].cls} ${styles.showSm}`}>{STATE[i.state].label}</span></b>
                      <small>{i.name ? i.email : ""}{i.place ? `${i.name ? " · " : ""}${i.place}` : ""}</small>
                    </a>
                  </td>
                  <td className={styles.hideSm}>
                    <span className={STATE[i.state].cls} style={{ marginLeft: 0 }}>{STATE[i.state].label}</span>
                    {i.state === "ending" && i.endsAt ? <small className={styles.notYet}> {day(i.endsAt)}</small> : null}
                  </td>
                  <td className={styles.hideSm}>{findPlan(i.plan)?.name ?? i.plan}</td>
                  <td className={styles.hideSm}>{day(i.joined)}</td>
                  <td className={styles.hideSm}>{i.monthlyCents ? `$${(i.monthlyCents / 100).toFixed(2)}` : "–"}</td>
                  <td className={styles.hideSm}>{i.source ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

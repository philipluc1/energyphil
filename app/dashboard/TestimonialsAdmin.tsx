"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TESTIMONIAL_SOURCES, type Testimonial } from "@/lib/testimonials";
import styles from "./dashboard.module.css";

/** Reviews on the home page (12 Nov 2026): approve ones left on utilo.com.au/review (14 Nov), add ones sent to you, hide or delete. */
export default function TestimonialsAdmin({ list, missing }: { list: Testimonial[]; missing: boolean }) {
  const router = useRouter();
  // Left on the review page and not yet approved.
  const isWaiting = (t: Testimonial) => t.shown === false && !t.approved_at && (t.source === "Utilo" || t.source === "Utilo member" || t.source === "Free check");
  const waiting = list.filter(isWaiting);
  const decided = list.filter((t) => !isWaiting(t));
  const [f, setF] = useState({ name: "", place: "", stars: "5", body: "", source: "Email", review_date: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((o) => ({ ...o, [k]: e.target.value }));
  async function call(method: string, url: string, body?: unknown) {
    setBusy(true); setMsg(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const b = await res?.json().catch(() => null);
    setBusy(false);
    if (!b?.ok) { setMsg(b?.message ?? "Couldn't save. Try again."); return false; }
    router.refresh();
    return true;
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call("POST", "/api/admin/testimonials", f)) { setMsg(`Added ${f.name}'s review to the home page.`); setF({ name: "", place: "", stars: "5", body: "", source: "Email", review_date: "" }); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/review`); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* clipboard blocked */ }
  }
  return (
    <div className={styles.tableCard} style={{ marginTop: 14 }}>
      <div className={styles.chartTitle}>Reviews on the home page</div>
      <p className={styles.cardNote}>
        Your review page is <b>utilo.com.au/review</b>. <button type="button" className={styles.chip} onClick={copyLink}>{copied ? "Copied" : "Copy review link"}</button> New reviews wait here until you approve them. Approve every genuine one, good or bad (leave out only abusive or fake ones): picking just the good ones, or giving anything for a review, counts as misleading.
      </p>
      {waiting.length > 0 && (
        <div className={styles.tableScroll} style={{ margin: "10px 0 14px" }}>
          <b style={{ fontSize: 14 }}>Waiting for you ({waiting.length})</b>
          <table className={styles.table}>
            <tbody>
              {waiting.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.name}</b>{t.place ? `, ${t.place}` : ""} <span className={styles.notYet}>({t.source}{t.email ? ` · ${t.email}` : ""})</span><br /><span style={{ fontSize: 13 }}>{t.body}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{"★".repeat(t.stars)}</td>
                  <td><button type="button" className={styles.chipOn} disabled={busy} onClick={() => call("PATCH", "/api/admin/testimonials", { id: t.id, shown: true })}>Approve</button></td>
                  <td><button type="button" className={styles.chip} disabled={busy} onClick={() => { if (window.confirm(`Delete ${t.name}'s review? Only for abusive or fake ones. This can't be undone.`)) void call("DELETE", `/api/admin/testimonials?id=${t.id}`); }}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.cardNote} style={{ marginBottom: 4 }}><b>Got a review by email or text?</b> Add it word for word:</p>
      {missing && <div className={styles.notice}>Run the latest SQL in Supabase to turn this on (adds the testimonials table).</div>}
      <form className={styles.spendForm} onSubmit={add} style={{ alignItems: "stretch" }}>
        <input placeholder="Name, e.g. Sarah M." value={f.name} onChange={set("name")} aria-label="Reviewer's name" style={{ width: 160 }} />
        <input placeholder="Suburb (optional)" value={f.place} onChange={set("place")} aria-label="Suburb" style={{ width: 150 }} />
        <select value={f.stars} onChange={set("stars")} aria-label="Stars">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select>
        <select value={f.source} onChange={set("source")} aria-label="Where it was left">{TESTIMONIAL_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <input type="date" value={f.review_date} onChange={set("review_date")} aria-label="Date of the review" style={{ width: 150 }} />
        <textarea placeholder="Paste the review, word for word" value={f.body} onChange={set("body")} aria-label="Review" rows={2} style={{ flex: "1 1 100%", border: "1.5px solid var(--border)", borderRadius: 9, padding: "8px 10px", font: "inherit", fontSize: 13 }} />
        <button type="submit" className={styles.chipOn} disabled={busy || !f.name || !f.body}>{busy ? "Saving…" : "Add to home page"}</button>
        {msg && <span className={styles.cardNote} style={{ margin: 0, alignSelf: "center" }}>{msg}</span>}
      </form>
      {decided.length > 0 && (
        <div className={styles.tableScroll} style={{ marginTop: 12 }}>
          <table className={styles.table}>
            <thead><tr><th>Review</th><th>Stars</th><th>Shown</th><th /></tr></thead>
            <tbody>
              {decided.map((t) => (
                <tr key={t.id} style={{ opacity: t.shown === false ? 0.5 : 1 }}>
                  <td><b>{t.name}</b>{t.place ? `, ${t.place}` : ""} <span className={styles.notYet}>({t.source})</span><br /><span style={{ fontSize: 12.5 }}>{t.body.length > 120 ? `${t.body.slice(0, 120)}…` : t.body}</span></td>
                  <td>{"★".repeat(t.stars)}</td>
                  <td><button type="button" className={styles.chip} disabled={busy} onClick={() => call("PATCH", "/api/admin/testimonials", { id: t.id, shown: t.shown === false })}>{t.shown === false ? "Hidden · show" : "Shown · hide"}</button></td>
                  <td><button type="button" className={styles.chip} disabled={busy} onClick={() => { if (window.confirm(`Delete ${t.name}'s review? This can't be undone.`)) void call("DELETE", `/api/admin/testimonials?id=${t.id}`); }}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

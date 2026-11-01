"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "../../dashboard.module.css";

export interface MemberEditable {
  email: string;
  customer_name: string | null;
  address: string | null;
  suburb: string | null;
  postcode: string | null;
  current_retailer: string | null;
  current_plan_name: string | null;
  alert_min_saving: number | null;
  monthly_summary: boolean;
  unsubscribed: boolean;
}

type Msg = { ok: boolean; text: string } | null;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" }) : "the end of their paid period");

async function call(body: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  try {
    const r = await fetch("/api/admin/member", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return await r.json();
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection." };
  }
}

/** Edit details, cancel or resume through Stripe, and delete everything. */
export default function MemberActions({ id, live, ending, hasStripeSub, periodEnd, initial }: {
  id: string; live: boolean; ending: boolean; hasStripeSub: boolean; periodEnd: string | null; initial: MemberEditable;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState<Msg>(null);
  const [subMsg, setSubMsg] = useState<Msg>(null);
  const [delMsg, setDelMsg] = useState<Msg>(null);
  const [confirm, setConfirm] = useState("");
  const [cancelAsk, setCancelAsk] = useState<null | "period_end" | "now">(null);
  const set = <K extends keyof MemberEditable>(k: K, val: MemberEditable[K]) => setV((x) => ({ ...x, [k]: val }));

  async function save(e: FormEvent) {
    e.preventDefault();
    const fields: Record<string, unknown> = {};
    for (const k of Object.keys(v) as (keyof MemberEditable)[]) {
      if (v[k] !== initial[k]) fields[k] = typeof v[k] === "string" ? (v[k] as string) : v[k];
    }
    if (!Object.keys(fields).length) { setEditMsg({ ok: false, text: "Nothing has changed." }); return; }
    if (fields.email && !window.confirm(`Change their email to ${String(fields.email)}? They'll sign in with the new address from now on, and their Stripe receipts go there too.`)) return;
    setBusy("save");
    const r = await call({ action: "update", id, fields });
    setBusy(null);
    setEditMsg({ ok: r.ok, text: r.message ?? (r.ok ? "Saved." : "Couldn't save.") });
    if (r.ok) router.refresh();
  }

  async function cancel(when: "period_end" | "now") {
    setBusy("cancel");
    const r = await call({ action: "cancel", id, when });
    setBusy(null);
    setCancelAsk(null);
    setSubMsg({ ok: r.ok, text: r.message ?? "" });
    if (r.ok) router.refresh();
  }

  async function resume() {
    setBusy("resume");
    const r = await call({ action: "resume", id });
    setBusy(null);
    setSubMsg({ ok: r.ok, text: r.message ?? "" });
    if (r.ok) router.refresh();
  }

  async function del() {
    setBusy("delete");
    const r = await call({ action: "delete", id, confirm });
    setBusy(null);
    if (r.ok) { router.push("/dashboard/members"); router.refresh(); return; }
    setDelMsg({ ok: false, text: r.message ?? "Couldn't delete." });
  }

  const input = (k: "customer_name" | "address" | "suburb" | "postcode" | "current_retailer" | "current_plan_name", label: string, wide = false) => (
    <label className={wide ? styles.wide : undefined}>
      {label}
      <input type="text" value={v[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} />
    </label>
  );

  return (
    <>
      <form className={styles.tableCard} onSubmit={save}>
        <h3 className={styles.cardH}>Details</h3>
        <div className={styles.form}>
          <label className={styles.wide}>
            Email (they sign in with this)
            <input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
          </label>
          {input("customer_name", "Name", true)}
          {input("address", "Street address", true)}
          {input("suburb", "Suburb")}
          {input("postcode", "Postcode")}
          {input("current_retailer", "Current retailer")}
          {input("current_plan_name", "Current plan")}
          <label>
            Alert when they could save ($ a year)
            <input type="number" min={0} max={5000} placeholder="50 (default)" value={v.alert_min_saving ?? ""} onChange={(e) => set("alert_min_saving", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
          <span />
          <label className={`${styles.check} ${styles.wide}`}>
            <input type="checkbox" checked={v.monthly_summary} onChange={(e) => set("monthly_summary", e.target.checked)} /> Monthly summary email
          </label>
          <label className={`${styles.check} ${styles.wide}`}>
            <input type="checkbox" checked={v.unsubscribed} onChange={(e) => set("unsubscribed", e.target.checked)} /> Unsubscribed from all emails except receipts
          </label>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.btn} disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save changes"}</button>
          <button type="button" className={styles.btnGhost} disabled={busy !== null} onClick={() => { setV(initial); setEditMsg(null); }}>Undo edits</button>
        </div>
        {editMsg && <p className={editMsg.ok ? styles.msgOk : styles.msgErr} role="status">{editMsg.text}</p>}
      </form>

      <section className={styles.tableCard}>
        <h3 className={styles.cardH}>Membership</h3>
        {!live ? (
          <p className={styles.cardP}>This membership is cancelled. Nothing more will be charged.</p>
        ) : !hasStripeSub ? (
          <p className={styles.cardP}>A once-off payment, so there&apos;s no subscription to cancel.</p>
        ) : ending ? (
          <>
            <p className={styles.cardP}>Set to end on {day(periodEnd)}. They keep Plus until then and won&apos;t be charged again.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.btnGhost} disabled={busy !== null} onClick={resume}>{busy === "resume" ? "Working…" : "Undo the cancellation"}</button>
              <button type="button" className={styles.btnGhost} disabled={busy !== null} onClick={() => setCancelAsk("now")}>End it now instead</button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.cardP}>Cancelling here cancels in Stripe, so billing stops. Refunds are separate, in Stripe.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.btnGhost} disabled={busy !== null} onClick={() => setCancelAsk("period_end")}>Cancel at end of paid period</button>
              <button type="button" className={styles.btnGhost} disabled={busy !== null} onClick={() => setCancelAsk("now")}>Cancel now</button>
            </div>
          </>
        )}
        {cancelAsk && (
          <div className={styles.confirmBox} role="alertdialog" aria-label="Confirm cancellation">
            <p className={styles.cardP}>
              {cancelAsk === "now" ? "End their membership right now? They lose Plus straight away, with no refund unless you give one in Stripe." : `Stop renewing? They keep Plus until ${day(periodEnd)} and aren't charged again.`}
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.btnDanger} disabled={busy !== null} onClick={() => cancel(cancelAsk)}>{busy === "cancel" ? "Cancelling…" : "Yes, cancel"}</button>
              <button type="button" className={styles.btnGhost} disabled={busy !== null} onClick={() => setCancelAsk(null)}>Keep it</button>
            </div>
          </div>
        )}
        {subMsg && <p className={subMsg.ok ? styles.msgOk : styles.msgErr} role="status">{subMsg.text}</p>}
      </section>

      <section className={`${styles.tableCard} ${styles.danger}`}>
        <h3 className={styles.cardH}>Delete this member</h3>
        <p className={styles.cardP}>
          {live && hasStripeSub ? "Stops their billing in Stripe first, then " : ""}removes everything we hold: their membership, bills, results, savings, alerts and sign-in. It can&apos;t be undone. Their payment records stay in Stripe, which must keep them by law.
        </p>
        <div className={styles.form}>
          <label className={styles.wide}>
            Type DELETE to confirm
            <input type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </label>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btnDanger} disabled={confirm !== "DELETE" || busy !== null} onClick={del}>{busy === "delete" ? "Deleting…" : "Delete everything"}</button>
        </div>
        {delMsg && <p className={styles.msgErr} role="status">{delMsg.text}</p>}
      </section>
    </>
  );
}

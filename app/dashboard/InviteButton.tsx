"use client";

import { useState } from "react";
import styles from "./dashboard.module.css";

/** "Send invite": one personal email asking a lead to join Utilo Plus (2 Nov 2026). The server applies the rules. */
export default function InviteButton({ email, sentAt = null, disabled = false, why }: { email: string; sentAt?: string | null; disabled?: boolean; why?: string }) {
  const [state, setState] = useState<{ busy: boolean; done: string | null; err: string | null }>({ busy: false, done: sentAt, err: null });
  if (disabled) return <span className={styles.inviteNote}>{why ?? "—"}</span>;
  if (state.done) {
    return <span className={styles.inviteSent}>✓ Invited {new Date(state.done).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" })}</span>;
  }
  async function send() {
    if (!window.confirm(`Send ${email} one email inviting them to Utilo Plus?`)) return;
    setState((s) => ({ ...s, busy: true, err: null }));
    try {
      const r = await fetch("/api/admin/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json();
      setState({ busy: false, done: j.ok ? j.sentAt : null, err: j.ok ? null : j.message ?? "Couldn't send." });
    } catch {
      setState({ busy: false, done: null, err: "Couldn't reach the server." });
    }
  }
  return (
    <span className={styles.inviteWrap}>
      <button type="button" className={styles.inviteBtn} onClick={send} disabled={state.busy}>{state.busy ? "Sending…" : "Send invite"}</button>
      {state.err && <span className={styles.inviteErr}>{state.err}</span>}
    </span>
  );
}

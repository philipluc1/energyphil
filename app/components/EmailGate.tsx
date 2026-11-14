"use client";

import Link from "next/link";
import Icon from "./Icon";
import styles from "./emailgate.module.css";

// The free check's email step (9 Nov 2026, Phil): the saving is shown first,
// the retailers and plans after an email. The email gets them their results;
// marketing only with the box ticked (Spam Act: express, unticked opt-in).

export default function EmailGate({
  email, setEmail, wantsAlerts, setWantsAlerts, onSubmit, status, title, sub, dark = false, fuel = "power",
}: {
  email: string;
  setEmail: (v: string) => void;
  wantsAlerts: boolean;
  setWantsAlerts: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  status: "idle" | "saving" | "saved" | "notSent" | "error";
  title: string;
  sub: string;
  dark?: boolean;
  fuel?: "power" | "gas";
}) {
  // 14 Nov 2026 (Phil): compact, and written as a hook: the saving is "unlocked" by the email.
  return (
    <div className={`${styles.gate} ${dark ? styles.dark : ""}`} id="email-gate">
      <b className={styles.title}><span className={styles.lock} aria-hidden="true"><Icon name="lock" size={16} /></span>{title}</b>
      <span className={styles.sub}>{sub}</span>
      <form className={styles.form} onSubmit={onSubmit}>
        <input type="email" required autoComplete="email" aria-label="Your email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={status === "saving"}>{status === "saving" ? "One moment…" : "Unlock →"}</button>
      </form>
      <label className={styles.optin}>
        <input type="checkbox" checked={wantsAlerts} onChange={(e) => setWantsAlerts(e.target.checked)} />
        <span>Also send me {fuel === "gas" ? "gas " : ""}price alerts and tips</span>
      </label>
      {status === "error" && <p className={styles.err}>That didn&apos;t go through. Check the email address and try again.</p>}
      <p className={styles.fine}>No calls, no spam. Nothing else unless you tick the box; unsubscribe any time. <Link href="/privacy">Privacy</Link></p>
    </div>
  );
}

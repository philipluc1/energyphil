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
  return (
    <div className={`${styles.gate} ${dark ? styles.dark : ""}`} id="email-gate">
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true"><Icon name="mail" size={18} /></span>
        <div>
          <b className={styles.title}>{title}</b>
          <span className={styles.sub}>{sub}</span>
        </div>
      </div>
      <form className={styles.form} onSubmit={onSubmit}>
        <input type="email" required autoComplete="email" aria-label="Your email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={status === "saving"}>{status === "saving" ? "One moment…" : "Show my results →"}</button>
      </form>
      <label className={styles.optin}>
        <input type="checkbox" checked={wantsAlerts} onChange={(e) => setWantsAlerts(e.target.checked)} />
        <span>Also send me energy tips, price alerts and offers. Unsubscribe any time.</span>
      </label>
      {status === "error" && <p className={styles.err}>That didn&apos;t go through. Check the email address and try again.</p>}
      <p className={styles.fine}>
        Free. We email you a copy of your {fuel === "gas" ? "gas " : ""}results; anything else only if you tick the box. We never call or share your email. <Link href="/privacy">Privacy</Link>
      </p>
    </div>
  );
}

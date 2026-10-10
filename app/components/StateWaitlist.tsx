"use client";

import { useState, type FormEvent } from "react";
import styles from "./statewaitlist.module.css";

const STATES = ["NSW", "SA", "QLD", "Other"] as const;

/** "Victoria first" notice with a sign-up for people in the next states. */
export default function StateWaitlist({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<(typeof STATES)[number]>("NSW");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, state }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setStatus(body?.ok ? "done" : "error");
  }

  return (
    <div className={`${styles.box} ${compact ? styles.compact : ""}`}>
      <div className={styles.head}>
        <span className={styles.pill}>Victoria first</span>
        <b>Live in Victoria now. NSW, South Australia and Queensland are next.</b>
      </div>
      {status === "done" ? (
        <p className={styles.ok}>Thanks. We&apos;ll email you when Utilo opens in {state === "Other" ? "your state" : state}.</p>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <span className={styles.lbl}>Not in Victoria? Tell us where you are and we&apos;ll let you know:</span>
          <div className={styles.row}>
            <div className={styles.states}>
              {STATES.map((s) => (
                <button key={s} type="button" className={s === state ? styles.stateOn : styles.state} onClick={() => setState(s)}>{s}</button>
              ))}
            </div>
            <input type="email" required aria-label="Your email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className={styles.btn} disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Notify me"}</button>
          </div>
          {status === "error" && <span className={styles.err}>Couldn&apos;t save that. Try again.</span>}
        </form>
      )}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import s from "./nbnnotify.module.css";

/** "Tell me when internet checks open": an email, saved to the waitlist as NBN interest. */
export default function NbnNotify() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, state: "NBN" }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setStatus(body?.ok ? "done" : "error");
  }

  if (status === "done") return <p className={s.ok}>Thanks. You&apos;ll hear from us the day internet checks open.</p>;
  if (!open) {
    return (
      <button type="button" className={s.link} onClick={() => setOpen(true)}>
        Tell me when it opens <span aria-hidden="true">→</span>
      </button>
    );
  }
  return (
    <form className={s.form} onSubmit={submit}>
      <label htmlFor="nbn-email" className={s.srOnly}>Your email</label>
      <input id="nbn-email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      <button type="submit" className={s.btn} disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Notify me"}</button>
      {status === "error" && <span className={s.err}>Couldn&apos;t save that. Try again.</span>}
    </form>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import s from "./step1.module.css";

/** "Tell me when you cover this": saves an email to the waitlist under a label (e.g. "Business"). */
export default function NotifyMe({ label, postcode }: { label: "Business" | "Embedded network"; postcode?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, state: label, postcode: postcode && /^\d{4}$/.test(postcode) ? postcode : null }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    setStatus(body?.ok ? "done" : "error");
  }

  if (status === "done") return <p className={s.notifyDone}>Thanks. We&apos;ll email you when we can check it.</p>;
  return (
    <form className={s.notify} onSubmit={submit}>
      <label className={s.srOnly} htmlFor={`notify-${label}`}>Email address</label>
      <input id={`notify-${label}`} type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Tell me when"}</button>
      {status === "error" && <span className={s.notifyErr}>Couldn&apos;t save that. Please try again.</span>}
    </form>
  );
}

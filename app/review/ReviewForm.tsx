"use client";

import { useState } from "react";
import Link from "next/link";
import s from "./review.module.css";

const LABELS = ["", "Poor", "Not great", "OK", "Good", "Great"];

export default function ReviewForm() {
  const [stars, setStars] = useState(0);
  const [f, setF] = useState({ name: "", place: "", body: "", email: "", website: "" });
  const [used, setUsed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((o) => ({ ...o, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stars) { setStatus("error"); setMsg("Pick your stars, one to five."); return; }
    setStatus("saving"); setMsg("");
    const res = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, stars, used, consent }) }).catch(() => null);
    const b = await res?.json().catch(() => null);
    if (b?.ok) { setStatus("done"); return; }
    setStatus("error"); setMsg(b?.message ?? "That didn't send. Please try again.");
  }

  if (status === "done") {
    return (
      <div className={s.card}>
        <div className={s.thanks}>
          <span aria-hidden="true">★★★★★</span>
          <b>Thank you{f.name ? `, ${f.name.split(" ")[0]}` : ""}.</b>
          <p>We read every review. Yours will show on the site once we&apos;ve checked it&apos;s from a real Utilo user.</p>
          <Link href="/">Back to Utilo</Link>
        </div>
      </div>
    );
  }

  return (
    <form className={s.card} onSubmit={submit}>
      <fieldset className={s.stars}>
        <legend>Your stars</legend>
        <div role="radiogroup" aria-label="Stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} className={n <= stars ? s.on : undefined} onClick={() => setStars(n)}>★</button>
          ))}
        </div>
        <span className={s.starLabel}>{LABELS[stars] || "Tap to rate"}</span>
      </fieldset>

      <label className={s.field}>
        <span>Your review</span>
        <textarea rows={4} maxLength={600} value={f.body} onChange={set("body")} placeholder="What did Utilo do for you? What could be better?" required />
      </label>
      <div className={s.row}>
        <label className={s.field}>
          <span>First name</span>
          <input value={f.name} onChange={set("name")} maxLength={40} placeholder="e.g. Sarah M." autoComplete="given-name" required />
        </label>
        <label className={s.field}>
          <span>Suburb <small>(optional)</small></span>
          <input value={f.place} onChange={set("place")} maxLength={40} placeholder="e.g. Geelong" />
        </label>
      </div>
      <label className={s.field}>
        <span>Email <small>(optional, never shown)</small></span>
        <input type="email" value={f.email} onChange={set("email")} maxLength={200} placeholder="The one you used with Utilo" autoComplete="email" />
        <small className={s.hint}>Lets us mark your review as from a member or a free check.</small>
      </label>
      {/* Hidden from people; bots fill it in. */}
      <input className={s.trap} tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set("website")} name="website" />

      <label className={s.check}>
        <input type="checkbox" checked={used} onChange={(e) => setUsed(e.target.checked)} />
        <span>I&apos;ve used Utilo (a free check or Utilo Plus).</span>
      </label>
      <label className={s.check}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Utilo can show my review, first name and suburb on its website.</span>
      </label>

      {status === "error" && <p className={s.err} role="alert">{msg}</p>}
      <button type="submit" className={s.submit} disabled={status === "saving"}>{status === "saving" ? "Sending…" : "Send my review"}</button>
      <p className={s.fine}>We show every genuine review, good or bad, and never pay or reward anyone for one. <Link href="/privacy">Privacy</Link></p>
    </form>
  );
}

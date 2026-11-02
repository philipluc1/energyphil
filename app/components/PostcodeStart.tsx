"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import s from "./postcodestart.module.css";

/** No bill to hand? Start with a postcode (2 Nov 2026): straight into the questions, the network already known. */
export default function PostcodeStart() {
  const router = useRouter();
  const [pc, setPc] = useState("");
  const [err, setErr] = useState("");
  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pc)) return setErr("Enter your 4-digit postcode.");
    if (!/^[38]/.test(pc)) return setErr("Utilo checks Victorian homes for now (postcodes starting with 3).");
    router.push(`/check?start=questions&postcode=${pc}`);
  }
  return (
    <form className={s.form} onSubmit={go} noValidate>
      <label htmlFor="home-postcode" className={s.label}>No bill to hand? Start with your postcode</label>
      <div className={s.row}>
        <input
          id="home-postcode"
          className={s.input}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={4}
          placeholder="e.g. 3121"
          value={pc}
          onChange={(e) => { setPc(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(""); }}
          aria-describedby={err ? "home-postcode-err" : undefined}
        />
        <button type="submit" className={s.go}>Get started →</button>
      </div>
      {err && <p id="home-postcode-err" className={s.err} role="alert">{err}</p>}
    </form>
  );
}

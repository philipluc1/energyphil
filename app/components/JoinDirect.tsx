"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import PlanCards from "./PlanCards";
import { findPlan, fmtPrice, type PlanId } from "@/lib/pricingPlans";
import s from "./joindirect.module.css";

// The pricing page's plan cards, wired to pay first: pick a plan, give an
// email (for the sign-in link and the one-membership-per-email check), go to
// Stripe. Straight after paying, the welcome page asks for the bill and the
// dashboard sets itself up from it.

export default function JoinDirect({ cancelPath = "/pricing" }: { cancelPath?: "/pricing" | "/" | "/account" } = {}) {
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [alreadyMember, setAlreadyMember] = useState(false);
  const chosen = plan ? findPlan(plan) : null;

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!plan) return;
    setBusy(true);
    setError("");
    setAlreadyMember(false);
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId: plan, email, profile: {}, cancelPath }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!body?.ok || !body.url) {
      setAlreadyMember(body?.alreadyMember === true);
      setError(body?.message ?? "Couldn't start checkout. Please try again.");
      setBusy(false);
      return;
    }
    window.location.assign(body.url);
  }

  return (
    <div className={s.wrap}>
      <PlanCards onChoose={(id) => { setPlan(id); setError(""); setAlreadyMember(false); }} loadingPlan={busy ? plan : null} cta="Choose" dark />
      {chosen && (
        <form className={s.panel} onSubmit={pay} aria-live="polite">
          <div className={s.panelHead}>
            <b>{chosen.name}: {fmtPrice(chosen.priceCents)} {chosen.cadenceLabel}</b>
            <span>Pay, then snap your bill. Your dashboard sets itself up from it.</span>
          </div>
          <div className={s.row}>
            <label htmlFor="join-email" className={s.srOnly}>Your email</label>
            <input id="join-email" type="email" required autoFocus placeholder="you@example.com" value={email} onChange={(ev) => setEmail(ev.target.value)} />
            <button type="submit" className={s.go} disabled={busy}>{busy ? "Opening payment…" : "Go to payment →"}</button>
          </div>
          <p className={s.fine}>Your sign-in link and alerts go here. Card details go to Stripe; we never see them.</p>
          {error && (
            <p className={s.err}>
              {error}{alreadyMember ? <> <Link href="/account">Log in</Link>.</> : null}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

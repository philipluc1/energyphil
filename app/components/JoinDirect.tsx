"use client";

import { useState } from "react";
import Link from "next/link";
import PlanCards from "./PlanCards";
import { type PlanId } from "@/lib/pricingPlans";
import s from "./joindirect.module.css";

// The pricing page's plan cards, wired to pay first: pick a plan and go
// straight to Stripe, whose page asks for the email (used for the sign-in
// link). Straight after paying, the welcome page asks for the bill and the
// dashboard sets itself up from it.

export default function JoinDirect({ cancelPath = "/pricing" }: { cancelPath?: "/pricing" | "/" | "/account" } = {}) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const [alreadyMember, setAlreadyMember] = useState(false);

  // Straight to Stripe (1 Nov 2026): its page asks for the email.
  async function pay(plan: PlanId) {
    setBusy(plan);
    setError("");
    setAlreadyMember(false);
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId: plan, profile: {}, cancelPath }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!body?.ok || !body.url) {
      setAlreadyMember(body?.alreadyMember === true);
      setError(body?.message ?? "Couldn't start checkout. Please try again.");
      setBusy(null);
      return;
    }
    window.location.assign(body.url);
  }

  return (
    <div className={s.wrap}>
      <PlanCards onChoose={(id) => void pay(id)} loadingPlan={busy} cta="Choose" dark />
      <p className={s.fine}>Pay securely with Stripe; we never see your card. Then snap your bill and your dashboard sets itself up.</p>
      {error && (
        <p className={s.err}>
          {error}{alreadyMember ? <> <Link href="/account">Log in</Link>.</> : null}
        </p>
      )}
    </div>
  );
}

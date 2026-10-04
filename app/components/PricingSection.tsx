"use client";

import { useState } from "react";
import { PRICING_PLANS, fmtPrice, type PlanId } from "@/lib/pricingPlans";
import styles from "./Comparator.module.css";

export interface SubscribeProfile {
  distributor: string;
  billingDays: number;
  usageMode: string;
  peak: number;
  shoulder: number;
  offpeak: number;
  anytime: number;
  cl: number;
  baselineTotal: number | null;
  baselineRetailer: string | null;
  baselinePlanName: string | null;
  // What the customer is actually paying now (their entered bill, or the
  // VDO benchmark if they left it blank) — the real starting point for
  // "how much have you saved", as opposed to baselineTotal above, which is
  // just the price of the plan being recommended.
  referenceTotal: number | null;
}

export default function PricingSection({
  email,
  onEmailChange,
  profile,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  profile: SubscribeProfile;
}) {
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");

  async function handleChoose(planId: PlanId) {
    setError("");
    if (!email || !email.includes("@")) {
      setError("Enter your email above first so we know where to send your alerts.");
      return;
    }
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, email, profile }),
      });
      const body = await res.json().catch(() => ({ ok: false, message: "Something went wrong." }));
      if (!body.ok) {
        setError(body.message || "Couldn't start checkout.");
        setLoadingPlan(null);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Something went wrong — please try again.");
      setLoadingPlan(null);
    }
  }

  return (
    <section id="pricing" className={styles.pricingSection}>
      <div className={styles.resultsHead}>
        <h2>Stay on the cheapest plan — automatically</h2>
      </div>
      <p className={styles.pricingIntro}>
        The comparison above is free, no sign-up, every time. If you&apos;d rather not keep checking yourself,
        subscribe and we&apos;ll keep watching the market for you and email you the moment something cheaper shows
        up. Pick how you&apos;d like to pay.
      </p>

      <div className={styles.field + " " + styles.pricingEmailField}>
        <label htmlFor="subEmail">Your email</label>
        <input
          id="subEmail"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </div>

      <div className={styles.pricingGrid}>
        {PRICING_PLANS.map((plan) => (
          <div key={plan.id} className={styles.pricingCard}>
            <div className={styles.pricingName}>{plan.name}</div>
            <div className={styles.pricingPrice}>
              {fmtPrice(plan.priceCents)}
              <span className={styles.pricingCadence}>{plan.cadenceLabel}</span>
            </div>
            <div className={styles.pricingBlurb}>{plan.blurb}</div>
            <button
              type="button"
              className={styles.pricingBtn}
              onClick={() => handleChoose(plan.id)}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === plan.id ? "Redirecting…" : "Get started"}
            </button>
          </div>
        ))}
      </div>
      <p className={styles.pricingReassure}>
        Independent of any government energy-comparison service — this is our own calculation, kept private to
        you and never sold or shared. Cancel monthly/quarterly/half-yearly plans anytime.
      </p>
      {error && <p className={styles.leadErr}>{error}</p>}
    </section>
  );
}

"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/pricingPlans";
import PlanCards from "./PlanCards";
import PlanBand from "./PlanBand";
import styles from "./Comparator.module.css";

// Small consistent-stroke icons, matching the set on the homepage — kept
// local here rather than shared so this component stays self-contained.

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
  // Optional identity/property details — from the sign-up form or read off
  // a photographed bill. Entirely optional; a blank subscribe flow still works.
  customerName: string;
  address: string;
  suburb: string;
  postcode: string;
  hasSolar: boolean;
  solarExportKwh: number;
  homeProfile?: Record<string, unknown> | null;
  currentRetailer?: string;
}

export default function PricingSection({
  email,
  onEmailChange,
  profile,
  yearlySaving = 0,
  bestRetailer = "",
}: {
  email: string;
  onEmailChange: (v: string) => void;
  profile: SubscribeProfile;
  /** The yearly saving just shown, so the pitch can refer to it. */
  yearlySaving?: number;
  bestRetailer?: string;
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
    <PlanBand
      title={yearlySaving >= 20 ? `Keep that $${Math.round(yearlySaving).toLocaleString("en-AU")} a year? We'll keep checking it for $7 a month.` : "We keep comparing, so you don't have to"}
      intro={
        yearlySaving >= 20 ? (
          <>
            Retailers change prices all year, so a cheap plan doesn&apos;t stay cheap on its own. <strong>Join and we re-price{" "}
            {bestRetailer ? `${bestRetailer} and every other plan on your network` : "every plan on your network"} every morning</strong>, and email you only
            when switching is worth it.
          </>
        ) : (
          <>The check above is free, every time. <strong>Join and we do the checking for you</strong>, with a bill read and a saved result each month.</>
        )
      }
      cards={<PlanCards onChoose={handleChoose} loadingPlan={loadingPlan} dark />}
    >
      <div className={styles.field + " " + styles.pricingEmailField}>
        <label htmlFor="subEmail">Step 1: your email, then pick a plan</label>
        <input id="subEmail" type="email" placeholder="you@example.com" value={email} onChange={(e) => onEmailChange(e.target.value)} />
      </div>
      {error && <p className={styles.leadErr}>{error}</p>}
    </PlanBand>
  );
}

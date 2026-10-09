"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/pricingPlans";
import PlanCards from "./PlanCards";
import styles from "./Comparator.module.css";

// Small consistent-stroke icons, matching the set on the homepage — kept
// local here rather than shared so this component stays self-contained.
function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6M4 13a8 8 0 0 0 13.7 4.7L20 15.4" />
      <path d="M4 4v4.6h4.6M20 20v-4.6h-4.6" />
    </svg>
  );
}
function IconPortal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 20v-11" />
      <path d="M12 16v-4M16 16v-6" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

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
    <section id="pricing" className={styles.pricingSection}>
      <div className={styles.resultsHead}>
        <h2>
          {yearlySaving >= 20
            ? `Keep that $${Math.round(yearlySaving).toLocaleString("en-AU")} a year? We'll check it every month for $7.`
            : "We keep comparing, so you don't have to"}
        </h2>
      </div>
      <p className={styles.pricingIntro}>
        {yearlySaving >= 20 ? (
          <>
            Retailers change prices all year, so a cheap plan doesn&apos;t stay cheap on its own. <strong>Join and we recheck{" "}
            {bestRetailer ? `${bestRetailer} and every other plan on your network` : "every plan on your network"} each month</strong>, and email you
            only when switching is worth it.
          </>
        ) : (
          <>
            The comparison above is free, no sign-up, every time. <strong>Join and we do the monthly checks for you</strong>. Upload a bill any time
            to sharpen the result.
          </>
        )}
      </p>

      <div className={styles.pricingBenefits}>
        <div className={styles.pricingBenefit}>
          <div className={styles.pricingBenefitIcon}>
            <IconRefresh />
          </div>
          <div>
            <strong>We keep comparing</strong>
            <p>Every morning we price every plan on your network against yours. No need to come back or re-check anything yourself.</p>
          </div>
        </div>
        <div className={styles.pricingBenefit}>
          <div className={`${styles.pricingBenefitIcon} ${styles.pricingBenefitIconTeal}`}>
            <IconMail />
          </div>
          <div>
            <strong>We tell you the moment it&apos;s worth switching</strong>
            <p>One email, only when something genuinely cheaper turns up for your area — no noise in between.</p>
          </div>
        </div>
        <div className={styles.pricingBenefit}>
          <div className={`${styles.pricingBenefitIcon} ${styles.pricingBenefitIconAmber}`}>
            <IconPortal />
          </div>
          <div>
            <strong>Your own savings portal</strong>
            <p>A private page just for you, showing your plan and exactly how much you&apos;ve saved so far.</p>
          </div>
        </div>
      </div>

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

      <PlanCards onChoose={handleChoose} loadingPlan={loadingPlan} />
      <p className={styles.pricingReassure}>
        Independent of any government energy-comparison service — this is our own calculation, kept private to
        you and never sold or shared. Cancel monthly/quarterly/half-yearly plans anytime.
      </p>
      {error && <p className={styles.leadErr}>{error}</p>}
    </section>
  );
}

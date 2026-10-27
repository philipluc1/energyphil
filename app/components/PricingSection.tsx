"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { parseSource, readSourceCookie } from "@/lib/attribution";
import { REFERRAL_FRIEND_CENTS, referralDollars } from "@/lib/referralOffer";
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
  /** Max demand in kW for a home on a demand tariff; null otherwise. */
  demandKw?: number | null;
  homeProfile?: Record<string, unknown> | null;
  currentRetailer?: string;
  /** Their current plan's pricing, if typed or read from a bill. */
  currentRates?: unknown;
  billCheck?: unknown;
  priceType?: "fixed" | "variable" | null;
  priceFixedUntil?: string | null;
  discountEndsAt?: string | null;
  currentPlanName?: string | null;
  /** The meter number (NMI), when read off the bill or typed. */
  nmi?: string | null;
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
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [referred, setReferred] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReferred(parseSource(readSourceCookie())?.kind === "referral"), 0);
    return () => clearTimeout(t);
  }, []);

  async function handleChoose(planId: PlanId) {
    setError("");
    setAlreadyMember(false);
    if (!email || !email.includes("@")) {
      setError("Enter your email above first so we know where to send your alerts.");
      // The box is above the plan cards, often off screen: take them to it.
      const box = document.getElementById("subEmail");
      box?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => box?.focus({ preventScroll: true }), 350);
      return;
    }
    setLoadingPlan(planId);
    track("checkout_started", { distributor: profile.distributor });
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, email, profile }),
      });
      const body = await res.json().catch(() => ({ ok: false, message: "Something went wrong." }));
      if (!body.ok) {
        setError(body.message || "Couldn't start checkout.");
        setAlreadyMember(body.alreadyMember === true);
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
      title={yearlySaving >= 20 && profile.referenceTotal !== null ? `Keep that $${Math.round(yearlySaving).toLocaleString("en-AU")} a year? Offers change every week. We'll keep checking for $7 a month.` : "Offers change every week. We keep checking, so you don't have to."}
      intro={
        yearlySaving >= 20 ? (
          <>
            Retailers launch new plans and change prices all year, so a cheap plan doesn&apos;t stay cheap on its own. <strong>Join and we re-price{" "}
            {bestRetailer ? `${bestRetailer} and every other plan we track on your network` : "every plan we track on your network"} every morning</strong>, and email you only
            when switching is worth it. No fine print to follow, no comparing to do.
          </>
        ) : (
          <>The check above is free, every time. <strong>Join and we do the checking for you</strong>, with a saved result each month and a bill read whenever a new bill arrives.</>
        )
      }
      cards={<PlanCards onChoose={handleChoose} loadingPlan={loadingPlan} dark />}
    >
      <div className={styles.field + " " + styles.pricingEmailField}>
        <label htmlFor="subEmail">Step 1: your email, then pick a plan</label>
        <input id="subEmail" type="email" placeholder="you@example.com" value={email} onChange={(e) => onEmailChange(e.target.value)} />
      </div>
      {referred && <p className={styles.referralNote}>A friend sent you: {referralDollars(REFERRAL_FRIEND_CENTS)} comes off your first payment at checkout.</p>}
      <details className={styles.whyKeep}>
        <summary>Why a membership, not a one-off fee?</summary>
        <p>
          Because today&apos;s cheapest plan rarely stays the cheapest. Retailers change prices and launch new plans every week, introductory discounts
          end, and every 1 July prices reset. A one-off check is right for a day; your membership pays for the checking that catches the changes after
          it: every plan re-priced against your home each morning, an email only when a move is worth it, and a heads-up before your discount or fixed
          price ends.
        </p>
        <p>
          You can cancel any time from your dashboard, in a couple of clicks. Staying a while? Yearly works out at $3.25 a month. The free check stays
          free, every time.
        </p>
      </details>
      {error && (
        <p className={styles.leadErr}>
          {error}
          {alreadyMember && (
            <>
              {" "}
              <a href="/account" className={styles.leadErrLink}>Log in to my dashboard →</a>
            </>
          )}
        </p>
      )}
    </PlanBand>
  );
}

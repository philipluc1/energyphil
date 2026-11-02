"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { parseSource, readSourceCookie } from "@/lib/attribution";
import { REFERRAL_FRIEND_CENTS, referralDollars } from "@/lib/referralOffer";
import { type PlanId, timesPrice, perWeekWords } from "@/lib/pricingPlans";
import { marketActivity } from "@/lib/marketActivity";
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
  /** Last day of the bill read in the check (YYYY-MM-DD): the joining bill goes into the bill tracker. */
  periodEnd?: string | null;
}

export default function PricingSection({
  email,
  profile,
  yearlySaving = 0,
}: {
  email: string;
  /** Kept for callers; the email box is gone (Stripe asks for it). */
  onEmailChange?: (v: string) => void;
  profile: SubscribeProfile;
  /** The yearly saving just shown, so the pitch can refer to it. */
  yearlySaving?: number;
  /** Kept for callers. */
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
    setLoadingPlan(planId);
    track("checkout_started", { distributor: profile.distributor });
    try {
      // No email box: Stripe's page asks for it. If they already gave us one
      // (e.g. "Email me this result"), it's passed on so they don't type it twice.
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, email: email.includes("@") ? email : "", profile }),
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

  const market = marketActivity({ days: 30 });
  const changes = market.newOffers + market.priceChanges;

  return (
    <PlanBand
      title="Stop paying the loyalty tax."
      intro={
        <>
          <span className={styles.liveLine}>
            <span className={styles.liveDot} aria-hidden="true" /> Live{market.ready && changes > 0 ? ` · ${changes} offer changes in the last 30 days` : " · every plan re-checked each morning"}
          </span>
          {yearlySaving >= 20 && profile.referenceTotal !== null
            ? <>The market can save you <b>${Math.round(yearlySaving).toLocaleString("en-AU")} a year</b> today{timesPrice(yearlySaving) ? <>: <b>{timesPrice(yearlySaving)} times</b> the yearly price</> : null}. We watch it for you as it moves.</>
            : <>We watch the market for you as it moves, for {perWeekWords()}.</>}
        </>
      }
      cards={<PlanCards onChoose={handleChoose} loadingPlan={loadingPlan} dark />}
    >
      {referred && <p className={styles.referralNote}>A friend sent you: {referralDollars(REFERRAL_FRIEND_CENTS)} comes off your first payment at checkout.</p>}
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

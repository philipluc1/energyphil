"use client";

import { useState } from "react";
import { PRICING_PLANS, fmtPrice, isFoundingAmount, plusValue, priceFor, regularPrice, type PlanId } from "@/lib/pricingPlans";
import { supabase } from "@/lib/supabaseClient";
import styles from "./upgradeplans.module.css";

/** Switch between the recurring plans from the dashboard. */
export default function UpgradePlans({ currentPlan, currentAmount = null, onChanged }: { currentPlan: string; /** What they pay now, in cents: founders see founding prices. */ currentAmount?: number | null; onChanged: (planId: PlanId, amountCents: number) => void }) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [msg, setMsg] = useState("");
  // Plans on sale, plus whatever they are on now (older plans keep working).
  // Same order and framing as the home and pricing pages (1 Nov 2026): Monthly, then Yearly
  // ("Best value · save $45"), then any older plan they're still on, marked as no longer offered.
  const rank = (p: (typeof PRICING_PLANS)[number]) => (p.id === "monthly" ? 0 : p.id === "annual" ? 1 : 2);
  // 2 Nov 2026 (Phil): only the plans on sale get a card. Someone still on a
  // retired plan (quarterly, from early testing) gets one line saying so.
  const recurring = PRICING_PLANS.filter((p) => p.mode === "subscription" && p.onSale).sort((a, b) => rank(a) - rank(b));
  const retired = PRICING_PLANS.find((p) => p.id === currentPlan && p.mode === "subscription" && !p.onSale);
  const v = plusValue();
  const founding = isFoundingAmount(currentPlan, currentAmount);
  const isOnceOff = currentPlan === "once_off";

  // 12 Nov 2026: yearly is the only plan on sale, so a yearly member has nothing to switch to.
  if (!retired && !isOnceOff && recurring.every((p) => p.id === currentPlan)) return null;

  async function change(planId: PlanId) {
    if (!supabase) return;
    setBusy(planId); setMsg("");
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/change-plan", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ planId }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(null);
    setMsg(body?.message ?? "Something went wrong.");
    if (body?.ok) onChanged(planId, typeof body.amountCents === "number" ? body.amountCents : priceFor(planId, founding));
  }

  return (
    <div className={styles.box}>
      <div className={styles.title}>Change your plan</div>
      <p className={styles.sub}>
        {isOnceOff
          ? "You're on the once-off plan, which never renews. To move to the yearly plan, email us and we'll sort it."
          : currentPlan === "monthly"
            ? `Same checking either way. ${plusValue().line} Changes are prorated on your next invoice.`
            : "You're on the yearly plan, our only plan for new members. Same checking all year."}
      </p>
      {retired && (
        <p className={styles.retired}>
          You&apos;re on an older {retired.name.toLowerCase()} plan ({fmtPrice(currentAmount ?? retired.priceCents)} {retired.cadenceLabel}) we no longer offer. It keeps working; switch to yearly any time.
        </p>
      )}
      <div className={styles.grid}>
        {recurring.map((p) => {
          const current = p.id === currentPlan;
          const yearly = p.id === "annual";
          return (
            <div key={p.id} className={`${styles.plan} ${yearly ? styles.best : ""} ${current ? styles.current : ""}`}>
              {yearly && !current && currentPlan === "monthly" ? <span className={styles.ribbon}>Save {v.save} a year</span> : null}
              <b>{p.name}</b>
              <span className={styles.price}>
                {!current && regularPrice(p.id) ? <s className={styles.anchor}>{fmtPrice(regularPrice(p.id)!)}</s> : null} {fmtPrice(current && currentAmount ? currentAmount : priceFor(p.id, founding))} <small>{p.cadenceLabel}</small>
              </span>
              <span className={styles.per}>
                {p.id === "monthly" ? <>That&apos;s {v.monthlyYear} a year</> : yearly ? <>You save {v.save} a year ({v.savePct}% off monthly)</> : <>No longer offered to new members. You can stay on it.</>}
              </span>
              {current ? (
                <span className={styles.badge}>Your plan</span>
              ) : (
                <button type="button" className={styles.btn} disabled={busy !== null || isOnceOff} onClick={() => change(p.id)}>
                  {busy === p.id ? "Switching…" : `Switch to ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {msg && <p className={styles.msg}>{msg}</p>}
    </div>
  );
}

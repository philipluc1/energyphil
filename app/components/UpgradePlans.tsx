"use client";

import { useState } from "react";
import { PRICING_PLANS, PLAN_DISPLAY, fmtPrice, type PlanId } from "@/lib/pricingPlans";
import { supabase } from "@/lib/supabaseClient";
import styles from "./upgradeplans.module.css";

/** Switch between the recurring plans from the dashboard. */
export default function UpgradePlans({ currentPlan, onChanged }: { currentPlan: string; onChanged: (planId: PlanId, amountCents: number) => void }) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [msg, setMsg] = useState("");
  // Plans on sale, plus whatever they are on now (older plans keep working).
  const recurring = PRICING_PLANS.filter((p) => p.mode === "subscription" && (p.onSale || p.id === currentPlan));
  const isOnceOff = currentPlan === "once_off";

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
    if (body?.ok) {
      const plan = PRICING_PLANS.find((p) => p.id === planId);
      if (plan) onChanged(planId, plan.priceCents);
    }
  }

  return (
    <div className={styles.box}>
      <div className={styles.title}>Change your plan</div>
      <p className={styles.sub}>
        {isOnceOff
          ? "You're on the once-off plan, which never renews. To move to a yearly or monthly plan, email us and we'll sort it."
          : "Same checking on every plan; yearly costs much less per month. Changes are prorated on your next invoice."}
      </p>
      <div className={styles.grid}>
        {recurring.map((p) => {
          const d = PLAN_DISPLAY[p.id];
          const current = p.id === currentPlan;
          return (
            <div key={p.id} className={`${styles.plan} ${current ? styles.current : ""}`}>
              <b>{p.name}</b>
              <span className={styles.price}>{fmtPrice(p.priceCents)} <small>{p.cadenceLabel}</small></span>
              {d.perMonthCents && p.id !== "monthly" && <span className={styles.per}>{fmtPrice(d.perMonthCents)} a month</span>}
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

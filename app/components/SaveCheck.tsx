"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { SubscribeProfile } from "./PricingSection";
import styles from "./Comparator.module.css";

interface Props {
  billingDays: number;
  referenceTotal: number;
  bestTotal: number;
  bestRetailer: string | null;
  bestPlanName: string | null;
  source: "manual" | "bill";
  /** Everything behind the check (retailer, plan, rates, usage, solar), for the member's record. */
  profile?: SubscribeProfile;
  /** "top": a bar above the results, for members only. */
  variant?: "top" | "inline";
}

type State = "checking" | "guest" | "member" | "saving" | "saved" | "error";

// Members can pin this result to My Dashboard as this month's check. Others
// get a plain pointer to log in. Membership is re-checked on the server.
export default function SaveCheck(p: Props) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) return !cancelled && setState("guest");
      const { data } = await supabase.auth.getSession();
      if (!data.session) return !cancelled && setState("guest");
      const res = await fetch("/api/member-status", { headers: { authorization: `Bearer ${data.session.access_token}` } }).catch(() => null);
      const body = res ? await res.json().catch(() => null) : null;
      if (!cancelled) setState(body?.member ? "member" : "guest");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!supabase) return;
    setState("saving");
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/save-check", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ billingDays: p.billingDays, referenceTotal: p.referenceTotal, bestTotal: p.bestTotal, bestRetailer: p.bestRetailer, bestPlanName: p.bestPlanName, source: p.source, profile: p.profile }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    setState(body?.ok ? "saved" : "error");
  }

  if (state === "checking") return null;
  if (p.variant === "top") {
    if (state === "guest") return null;
    return (
      <div className={`${styles.saveTop} ${state === "saved" ? styles.saveTopDone : ""}`} role="status">
        {state === "saved" ? (
          <span>
            <b>Saved.</b> Your dashboard now uses these details: your retailer, plan, rates and usage. <Link href="/account">Open my dashboard →</Link>
          </span>
        ) : (
          <>
            <span>
              <b>You&apos;re a member.</b> Save this check to your dashboard so it uses these details (retailer, plan, rates and usage) from now on.
            </span>
            <button type="button" className={styles.saveTopBtn} onClick={save} disabled={state === "saving"}>
              {state === "saving" ? "Saving…" : "Update my dashboard"}
            </button>
          </>
        )}
        {state === "error" && <span className={styles.leadErr}>Couldn&apos;t save. Try again.</span>}
      </div>
    );
  }
  if (state === "guest") {
    return (
      <p className={styles.helper}>
        Plus members can save each month&apos;s check to <Link href="/account">My Dashboard</Link>.
      </p>
    );
  }
  return (
    <div className={styles.saveCheck}>
      {state === "saved" ? (
        <span>Saved to My Dashboard. <Link href="/account">View</Link></span>
      ) : (
        <button type="button" className={styles.photoBtn} onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save this month's check"}
        </button>
      )}
      {state === "error" && <span className={styles.leadErr}>Couldn&apos;t save. Try again.</span>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./Comparator.module.css";

interface Props {
  billingDays: number;
  referenceTotal: number;
  bestTotal: number;
  bestRetailer: string | null;
  bestPlanName: string | null;
  source: "manual" | "bill";
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
      body: JSON.stringify(p),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    setState(body?.ok ? "saved" : "error");
  }

  if (state === "checking") return null;
  if (state === "guest") {
    return (
      <p className={styles.helper}>
        Members can save each month&apos;s check to <Link href="/account">My Dashboard</Link>.
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

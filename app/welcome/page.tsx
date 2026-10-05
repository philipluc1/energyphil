"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ExtractedBill } from "@/lib/billExtraction";
import BillPhotoUpload from "../components/BillPhotoUpload";
import SiteHeader from "../components/SiteHeader";
import Tag from "../components/Tag";
import styles from "./welcome.module.css";

type Stage = "setting-up" | "upload" | "applying" | "done" | "no-session" | "error";
interface Result {
  retailer: string;
  plan: string;
  saving: number;
  usedCurrentBill: boolean;
}

const money = (n: number) => "$" + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Where new members land right after paying: read their bill now (if they
// haven't already), then go to My Dashboard.
export default function WelcomePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("setting-up");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!supabase) return !cancelled && setStage("no-session");
      // The sign-in link puts tokens in the URL; the client picks them up asynchronously.
      let session = (await supabase.auth.getSession()).data.session;
      for (let i = 0; i < 6 && !session; i++) {
        await new Promise((r) => setTimeout(r, 500));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (cancelled) return;
      if (!session) return setStage("no-session");

      // The payment webhook can land a moment after the redirect: wait for the membership row.
      let member = false;
      for (let i = 0; i < 12 && !member && !cancelled; i++) {
        const res = await fetch("/api/member-status", { headers: { authorization: `Bearer ${session.access_token}` } }).catch(() => null);
        member = Boolean((await res?.json().catch(() => null))?.member);
        if (!member) await new Promise((r) => setTimeout(r, 1000));
      }
      if (cancelled) return;
      if (!member) {
        setMessage("Your payment went through, but your membership is still being set up.");
        return setStage("error");
      }

      // Already read a bill? Straight to the dashboard.
      const { data: existing } = await supabase.from("bill_checks").select("id").eq("source", "bill").limit(1);
      if (cancelled) return;
      if (existing && existing.length > 0) return router.replace("/account");
      setStage("upload");
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleBill(bill: ExtractedBill) {
    setStage("applying");
    const { data } = await supabase!.auth.getSession();
    const res = await fetch("/api/apply-bill", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify(bill),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.ok) {
      setResult(body as Result);
      setStage("done");
    } else {
      setMessage(body?.message || "We couldn't use that bill.");
      setStage("upload");
    }
  }

  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <div className={styles.card}>
          <Tag tone="green">Payment received</Tag>
          <h1>Welcome. You&apos;re in.</h1>

          {stage === "setting-up" && <p className={styles.lede}>Setting up your membership…</p>}

          {(stage === "upload" || stage === "applying") && (
            <>
              <p className={styles.lede}>One last step: read your latest bill so your monthly checks use your real numbers. It takes about a minute.</p>
              {message && <p className={styles.warn}>{message}</p>}
              {stage === "applying" ? <p className={styles.lede}>Working out your best plan…</p> : <BillPhotoUpload onApply={handleBill} />}
              <Link href="/account" className={styles.skip}>Skip for now, go to My Dashboard</Link>
            </>
          )}

          {stage === "done" && result && (
            <>
              <p className={styles.lede}>
                Best match for your bill: <strong>{result.retailer} — {result.plan}</strong>.
                {result.saving > 0
                  ? ` About ${money(result.saving)} cheaper than ${result.usedCurrentBill ? "what you pay now" : "the default offer"} for the same period.`
                  : " Your current plan is already as cheap as anything we found. We'll keep watching."}
              </p>
              <Link href="/account" className={styles.cta}>Go to My Dashboard</Link>
            </>
          )}

          {stage === "no-session" && (
            <>
              <p className={styles.lede}>You&apos;re subscribed. Log in to My Dashboard with your email to carry on.</p>
              <Link href="/account" className={styles.cta}>Log in</Link>
            </>
          )}

          {stage === "error" && (
            <>
              <p className={styles.lede}>{message} Give it a minute, then open My Dashboard.</p>
              <Link href="/account" className={styles.cta}>Go to My Dashboard</Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}

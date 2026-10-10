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

type Stage = "setting-up" | "check-email" | "upload" | "applying" | "done" | "no-session" | "error";
interface Result {
  retailer: string;
  plan: string;
  saving: number;
  savingPerYear?: number;
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
  // Which setup step we're on, for the animated "please wait" list.
  const [setupStep, setSetupStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!supabase) return !cancelled && setStage("no-session");
      // The sign-in link puts tokens in the URL; the client picks them up asynchronously.
      setSetupStep(1);
      let session = (await supabase.auth.getSession()).data.session;
      for (let i = 0; i < 6 && !session; i++) {
        await new Promise((r) => setTimeout(r, 500));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (cancelled) return;
      if (!session) {
        // Just paid: we've emailed them a sign-in link (see /api/welcome-link).
        const justPaid = new URLSearchParams(window.location.search).get("check_email") === "1";
        return setStage(justPaid ? "check-email" : "no-session");
      }

      setSetupStep(2);
      // The payment webhook can land a moment after the redirect: wait for the membership row.
      let member = false;
      for (let i = 0; i < 12 && !member && !cancelled; i++) {
        const res = await fetch("/api/member-status", { headers: { authorization: `Bearer ${session.access_token}` } }).catch(() => null);
        member = Boolean((await res?.json().catch(() => null))?.member);
        if (!member) await new Promise((r) => setTimeout(r, 1000));
      }
      // Webhook still not landed? Ask the server to find the payment in Stripe directly.
      if (!member && !cancelled) {
        const res = await fetch("/api/sync-membership", { method: "POST", headers: { authorization: `Bearer ${session.access_token}` } }).catch(() => null);
        const body = await res?.json().catch(() => null);
        member = Boolean(body?.member || body?.created);
        if (!member && body?.reason) setMessage(body.reason);
      }
      if (cancelled) return;
      if (!member) {
        setMessage((m) => m || "Your payment went through, but your membership is still being set up.");
        return setStage("error");
      }

      setSetupStep(3);
      await new Promise((r) => setTimeout(r, 700));
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
          {stage !== "no-session" && <Tag tone="green">Payment received</Tag>}
          <h1>Let&apos;s start saving.</h1>

          {stage === "check-email" && (
            <>
              <p className={styles.lede}>
                Thanks for joining. We&apos;ve emailed you a one-click sign-in link at the address you paid with. Open it on this device and your
                membership will finish setting up.
              </p>
              <div className={styles.row}>
                <a className={styles.cta} href="https://mail.google.com" target="_blank" rel="noopener noreferrer">Open Gmail</a>
                <a className={styles.ctaGhost} href="https://outlook.live.com/mail" target="_blank" rel="noopener noreferrer">Open Outlook</a>
              </div>
              <p className={styles.skip}>Nothing there after a minute? Check spam, or <Link href="/account">request a new link</Link>.</p>
            </>
          )}

          {stage === "setting-up" && (
            <div className={styles.setup} aria-live="polite">
              <div className={styles.spinner} aria-hidden="true"><span /></div>
              <p className={styles.lede}>Starting your membership. This takes a few seconds, please don&apos;t close the page.</p>
              <ol className={styles.setupList}>
                {["Payment received", "Signing you in", "Creating your membership", "Opening your dashboard"].map((label, i) => {
                  const n = i;
                  const state = n < setupStep ? "done" : n === setupStep ? "now" : "todo";
                  return (
                    <li key={label} className={styles[state]}>
                      <span className={styles.dot}>{state === "done" ? "✓" : ""}</span>
                      {label}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {(stage === "upload" || stage === "applying") && (
            <>
              <div className={styles.steps}>
                <div className={`${styles.step} ${styles.stepNow}`}>
                  <span className={styles.stepNum}>1</span>
                  <div>
                    <b>Upload your latest bill</b>
                    <p>A photo or PDF. We read the numbers so your checks use what you really pay. About a minute.</p>
                  </div>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNum}>2</span>
                  <div>
                    <b>See your savings dashboard</b>
                    <p>Your best plan, what you&apos;re saving, and a check every month from now on.</p>
                  </div>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNum}>3</span>
                  <div>
                    <b>Switch, then tell us the date</b>
                    <p>Savings count from the day you switch. We&apos;ll email only when another move is worth it.</p>
                  </div>
                </div>
              </div>
              {message && <p className={styles.warn}>{message}</p>}
              {stage === "applying" ? <p className={styles.lede}>Working out your best plan…</p> : <BillPhotoUpload onApply={handleBill} />}
              <div className={styles.row}>
                <Link href="/account" className={styles.ctaGhost}>Open my savings dashboard →</Link>
                <span className={styles.skip}>You can upload a bill there any time.</span>
              </div>
            </>
          )}

          {stage === "done" && result && (
            <>
              <p className={styles.lede}>
                Best match for your bill: <strong>{result.retailer} — {result.plan}</strong>.
                {(result.savingPerYear ?? 0) >= 50
                  ? ` About ${money(result.savingPerYear ?? 0)} a year cheaper than ${result.usedCurrentBill ? "what you pay now" : "the default offer"}.`
                  : " Your current plan is already about as cheap as anything we found. We'll keep watching."}
              </p>
              <Link href="/account" className={styles.cta}>Open my savings dashboard →</Link>
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

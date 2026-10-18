"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ALERT_MIN_CHOICES } from "@/lib/alertChoices";
import { REFERRAL_CREDIT_CENTS, REFERRAL_FRIEND_CENTS, referralDollars } from "@/lib/referralOffer";
import Icon from "./Icon";
import a from "../account/account.module.css";
import s from "./membersettings.module.css";

// The member's own settings on the Membership tab: a referral link to share,
// how big a saving is worth an email, and deleting their data.

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}`, "content-type": "application/json" } : null;
}

interface Settings {
  referral: { code: string; joined: number; credited: number } | null;
  alertMin: number;
}

export function MemberSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/member-settings", { headers }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (!live) return;
      if (body?.ok) setSettings({ referral: body.referral ?? null, alertMin: body.alertMin });
      else setFailed(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <ReferralCard referral={settings?.referral ?? null} loading={!settings && !failed} />
      <AlertCard value={settings?.alertMin ?? null} onSaved={(v) => setSettings((p) => (p ? { ...p, alertMin: v } : p))} />
    </>
  );
}

function ReferralCard({ referral, loading }: { referral: Settings["referral"]; loading: boolean }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setOrigin(window.location.origin), 0);
    return () => clearTimeout(t);
  }, []);
  const link = referral && origin ? `${origin}/r/${referral.code}` : "";
  const give = referralDollars(REFERRAL_FRIEND_CENTS);
  const get = referralDollars(REFERRAL_CREDIT_CENTS);
  const share = `I use Utilo to keep an eye on my power bill. Here's ${give} off if you join: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={`${a.panelCard} ${s.refer}`} aria-labelledby="refer-title">
      <div className={s.referHead}>
        <span className={s.referIcon} aria-hidden="true"><Icon name="gift" size={22} /></span>
        <div>
          <div id="refer-title" className={a.panelTitle}>Give {give}, get {get}</div>
          <p className={a.panelText}>
            Share your link. A friend who joins gets {give} off their first payment, and you get {get} off your next one once they&apos;ve paid.
          </p>
        </div>
      </div>
      {loading ? (
        <p className={s.muted}>Getting your link…</p>
      ) : !referral ? (
        <p className={s.muted}>Your link isn&apos;t ready yet. Try again in a minute.</p>
      ) : (
        <>
          <div className={s.linkRow}>
            <input className={s.linkBox} value={link} readOnly aria-label="Your referral link" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className={a.btnPrimary} onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
          </div>
          <div className={s.shareRow}>
            <a className={s.share} href={`sms:?&body=${encodeURIComponent(share)}`}>Text it</a>
            <a className={s.share} href={`mailto:?subject=${encodeURIComponent("Something for your power bill")}&body=${encodeURIComponent(share)}`}>Email it</a>
            <a className={s.share} href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
          <p className={s.muted}>
            {referral.joined === 0
              ? "No one has joined with your link yet."
              : `${referral.joined} ${referral.joined === 1 ? "friend has" : "friends have"} joined. ${referral.credited > 0 ? `${referralDollars(REFERRAL_CREDIT_CENTS * referral.credited)} credited to your account.` : ""}`}{" "}
            <a href="/terms#referrals">Referral terms</a>
          </p>
        </>
      )}
    </section>
  );
}

function AlertCard({ value, onSaved }: { value: number | null; onSaved: (v: number) => void }) {
  const [saving, setSaving] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  async function choose(v: number) {
    if (v === value) return;
    setSaving(v);
    setMsg("");
    const headers = await authHeaders();
    const res = headers ? await fetch("/api/member-settings", { method: "POST", headers, body: JSON.stringify({ alertMin: v }) }).catch(() => null) : null;
    const body = await res?.json().catch(() => null);
    setSaving(null);
    if (body?.ok) {
      onSaved(v);
      setMsg("Saved.");
    } else setMsg(body?.message || "Couldn't save that. Please try again.");
  }
  return (
    <section className={a.panelCard} aria-labelledby="alert-title">
      <div id="alert-title" className={a.panelTitle}>When should we email you?</div>
      <p className={a.panelText}>Only when a plan would save you at least this much a year. Smaller savings still show on your dashboard.</p>
      <div className={s.choices} role="radiogroup" aria-labelledby="alert-title">
        {ALERT_MIN_CHOICES.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={`${s.choice} ${value === v ? s.choiceOn : ""}`}
            disabled={value === null || saving !== null}
            onClick={() => choose(v)}
          >
            {saving === v ? "Saving…" : `$${v}+`}
          </button>
        ))}
      </div>
      {msg && <p className={s.muted} role="status">{msg}</p>}
    </section>
  );
}

/** Delete everything we hold. Shown to anyone signed in. */
export function DeleteDataCard({ isMember }: { isMember: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "working" | "done">("idle");
  const [msg, setMsg] = useState("");
  async function go() {
    setStep("working");
    setMsg("");
    const headers = await authHeaders();
    const res = headers ? await fetch("/api/delete-my-data", { method: "POST", headers, body: JSON.stringify({ confirm: "DELETE" }) }).catch(() => null) : null;
    const body = await res?.json().catch(() => null);
    if (body?.ok) {
      setStep("done");
      try {
        window.localStorage.removeItem("utilo.check.v1");
      } catch {
        /* storage unavailable */
      }
      await supabase?.auth.signOut().catch(() => {});
      setTimeout(() => router.push("/"), 2500);
    } else {
      setStep("idle");
      setMsg(body?.message || "Couldn't delete your data just now. Please try again.");
    }
  }
  return (
    <section className={`${a.panelCard} ${s.danger}`} aria-labelledby="delete-title">
      <div id="delete-title" className={a.panelTitle}>Delete my data</div>
      {step === "done" ? (
        <p className={a.panelText} role="status">Done. Everything we held about you has been deleted, and you&apos;ve been signed out.</p>
      ) : (
        <>
          <p className={a.panelText}>
            Deletes your saved checks, savings history, bills we&apos;ve read and your sign-in. It can&apos;t be undone.
            {isMember ? " Cancel your membership first." : ""} Payment records stay with Stripe, which must keep them by law.
          </p>
          {step === "idle" && (
            <button type="button" className={a.btnGhost} onClick={() => setStep("confirm")}>Delete my data…</button>
          )}
          {(step === "confirm" || step === "working") && (
            <div className={s.confirmRow}>
              <span>Delete everything for good?</span>
              <button type="button" className={s.dangerBtn} onClick={go} disabled={step === "working"}>{step === "working" ? "Deleting…" : "Yes, delete it"}</button>
              <button type="button" className={a.btnGhost} onClick={() => setStep("idle")} disabled={step === "working"}>Keep it</button>
            </div>
          )}
          {msg && <p className={a.error}>{msg}</p>}
        </>
      )}
    </section>
  );
}

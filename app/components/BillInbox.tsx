"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ExtractedBill } from "@/lib/billExtraction";
import BillReview from "./BillReview";
import Icon from "./Icon";
import a from "../account/account.module.css";
import s from "./billinbox.module.css";

// 5 Nov 2026: "Forward your bills". The member's private address, how to set up
// Gmail or Outlook to send bills there, and what last arrived. A forwarded bill
// that needs a check is shown here with the same review as an upload.

type Status = {
  ok: boolean; ready: boolean; address: string | null; lastAt?: string | null; lastStatus?: string | null;
  gmailCode?: string | null; gmailLink?: string | null; pending?: ExtractedBill | null; message?: string;
};

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" }) : "");

const LINE: Record<string, (d: string) => string> = {
  saved: (d) => `Last bill in ${d}: read, saved and every plan re-checked.`,
  check: (d) => `A bill arrived ${d} and needs a quick look below.`,
  "no-bill": (d) => `An email arrived ${d} with no bill attached. Turn on PDF bills by email in your retailer's account.`,
  unreadable: (d) => `A bill arrived ${d} but didn't read clearly. Upload a clearer copy above.`,
  "retry-later": (d) => `A bill arrived ${d} but our reader had a problem. Upload it above, or forward it again later.`,
  "not-a-bill": (d) => `An email arrived ${d} that wasn't a bill, so we ignored it.`,
  limit: (d) => `Lots of emails arrived ${d}: we paused for the day. Check your forwarding filter only sends bills.`,
};

export default function BillInbox({ onSave, onReread, saving }: {
  onSave: (b: ExtractedBill) => void;
  onReread: (b: ExtractedBill, pages: Blob[]) => void;
  saving: boolean;
}) {
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [askRotate, setAskRotate] = useState(false);
  const [err, setErr] = useState("");

  const call = useCallback(async (method: "GET" | "POST", action?: string) => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/bill-inbox", {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: method === "POST" ? JSON.stringify({ action }) : undefined,
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as Status | null;
    if (body?.ok) { setSt(body); setErr(""); } else if (method === "POST") setErr(body?.message || "That didn't work. Try again.");
  }, []);

  useEffect(() => { const t = setTimeout(() => void call("GET"), 0); return () => clearTimeout(t); }, [call]);

  if (!st || !st.ready) return null;

  async function act(action: string) {
    setBusy(true);
    await call("POST", action);
    setBusy(false);
    setAskRotate(false);
  }
  async function copy() {
    if (!st?.address) return;
    try { await navigator.clipboard.writeText(st.address); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { const el = document.getElementById("bill-inbox-address"); if (el) { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); } }
  }

  return (
    <section className={a.panelCard} id="bill-inbox" aria-labelledby="bill-inbox-h">
      <div className={s.head}>
        <span className={s.icon} aria-hidden="true"><Icon name="mail" size={20} /></span>
        <div>
          <h2 className={a.panelTitle} id="bill-inbox-h">Forward your bills, never upload again</h2>
          <p className={a.panelText}>Set up your email once. Every bill your retailer sends comes straight to us: we read it, update your numbers and re-check every plan.</p>
        </div>
      </div>

      {!st.address ? (
        <button type="button" className={a.btnPrimary} disabled={busy} onClick={() => void act("create")}>{busy ? "Making your address…" : "Get my bill address"}</button>
      ) : (
        <>
          <div className={s.addrRow}>
            <code className={s.addr} id="bill-inbox-address">{st.address}</code>
            <button type="button" className={a.btnPrimary} onClick={() => void copy()}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>

          {st.lastStatus === "gmail" ? (
            <div className={s.gmail} role="status">
              <b>Gmail wants to confirm forwarding.</b>
              {st.gmailCode && <span>Your code: <code className={s.code}>{st.gmailCode}</code> (enter it in Gmail: Settings → Forwarding and POP/IMAP).</span>}
              {st.gmailLink && <a href={st.gmailLink} target="_blank" rel="noopener noreferrer" className={a.btnGhost}>Confirm in Gmail ↗</a>}
            </div>
          ) : (
            <p className={s.status}>{st.lastStatus && LINE[st.lastStatus] ? LINE[st.lastStatus](day(st.lastAt)) : "Waiting for your first forwarded bill."}</p>
          )}

          {st.pending && (
            <div className={s.pending}>
              <b>Check the bill you forwarded</b>
              <BillReview bill={st.pending} pages={[]} onReread={onReread} onSave={onSave} onCancel={() => void act("dismiss")} saving={saving} />
            </div>
          )}

          <div className={s.steps}>
            <details>
              <summary>Set it up in Gmail</summary>
              <ol>
                <li>On a computer, open Gmail → <b>Settings</b> (the gear) → <b>See all settings</b> → <b>Forwarding and POP/IMAP</b> → <b>Add a forwarding address</b>, and paste your address above.</li>
                <li>Gmail sends a confirmation code. We pass it straight back to you here and by email. Enter it in Gmail.</li>
                <li>Don&apos;t forward everything. In Gmail&apos;s search bar, open the search options, put the address your last bill came from in <b>From</b>, tick <b>Has attachment</b>, then <b>Create filter</b> → <b>Forward it to</b> your Utilo address.</li>
              </ol>
            </details>
            <details>
              <summary>Set it up in Outlook</summary>
              <ol>
                <li>Outlook.com: <b>Settings</b> → <b>Mail</b> → <b>Rules</b> → <b>Add new rule</b>.</li>
                <li>Condition: <b>From</b> the address your last bill came from. Action: <b>Forward to</b> your Utilo address.</li>
                <li>Some work accounts block forwarding outside the company. A personal address works best.</li>
              </ol>
            </details>
            <details>
              <summary>Any other email</summary>
              <p>Forward your next bill email to your Utilo address, PDF attached. If your app can make a rule (&ldquo;from your retailer, forward to…&rdquo;), set one so it happens every time.</p>
            </details>
          </div>

          <p className={s.fine}>We keep only the numbers from each bill, the same as an upload. The email and the PDF aren&apos;t stored. Only bills from this address count, so keep it private.</p>
          {askRotate ? (
            <p className={s.rotate}>
              Your current address will stop working.{" "}
              <button type="button" className={a.linkBtn} disabled={busy} onClick={() => void act("rotate")}>Make a new address</button>{" "}
              <button type="button" className={a.linkBtn} onClick={() => setAskRotate(false)}>Keep this one</button>
            </p>
          ) : (
            <button type="button" className={`${a.linkBtn} ${s.rotateBtn}`} onClick={() => setAskRotate(true)}>Change my address</button>
          )}
        </>
      )}
      {err && <p className={s.err} role="alert">{err}</p>}
    </section>
  );
}

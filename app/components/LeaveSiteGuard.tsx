"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import { independenceLabel, independenceLine } from "@/lib/disclosures";
import Icon from "./Icon";
import s from "./leavesite.module.css";

// Before a customer goes to a retailer's website from any "Go to …" link on
// the site, show what they should check and confirm they're happy to leave.
// Mounted once in the root layout; it watches clicks on links to the
// retailers' sites, so new links are covered automatically. A link can carry
// data-plan="Plan name" so the pop-up can say what to look for, and
// data-same="1" when the customer is already with that retailer. The offer's
// own terms stay with the retailer (5 Nov 2026): we point to them, we don't restate them.

const SKIP_KEY = "utilo.leaveOk";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const HOSTS = Object.entries(RETAILER_LINKS).map(([name, url]) => [name, new URL(url).hostname.replace(/^www\./, "")] as const);

function retailerFor(href: string): string | null {
  let host = "";
  try { host = new URL(href, window.location.href).hostname.replace(/^www\./, ""); } catch { return null; }
  const hit = HOSTS.find(([, h]) => host === h || host.endsWith(`.${h}`));
  return hit ? hit[0] : null;
}

type Target = { href: string; retailer: string; plan: string | null; network: string | null; fuel: "E" | "G"; same: boolean };

export default function LeaveSiteGuard() {
  const [target, setTarget] = useState<Target | null>(null);
  const [skipToday, setSkipToday] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const retailer = retailerFor(a.href);
      if (!retailer) return;
      try { if (window.localStorage.getItem(SKIP_KEY) === today()) return; } catch { /* storage off: always ask */ }
      e.preventDefault();
      setSkipToday(false);
      setTarget({ href: a.href, retailer, plan: a.dataset.plan ?? null, network: a.dataset.network ?? null, fuel: a.dataset.fuel === "G" ? "G" : "E", same: a.dataset.same === "1" });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const close = useCallback(() => setTarget(null), []);
  useEffect(() => {
    if (!target) return;
    // 5 Nov 2026: open at the top. Focusing the button at the bottom used to scroll the box to its end.
    const d = dialogRef.current;
    if (d) { d.scrollTop = 0; d.focus({ preventScroll: true }); }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [target, close]);

  if (!target) return null;
  const { retailer, plan, href, same } = target;

  function go() {
    if (skipToday) { try { window.localStorage.setItem(SKIP_KEY, today()); } catch { /* ignore */ } }
    window.open(href, "_blank", "noopener,noreferrer");
    setTarget(null);
  }

  return (
    <div className={s.backdrop} onClick={close}>
      <div className={s.dialog} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="leave-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={s.x} onClick={close} aria-label="Close">×</button>
        <span className={s.kicker}><Icon name="search" size={14} /> {same ? `You're already with ${retailer}` : "You're leaving Utilo"}</span>
        <h2 id="leave-title" className={s.title}>{same ? `Changing plan with ${retailer}` : `Going to ${retailer}`}</h2>
        {/* 5 Nov 2026: what to actually do, first and loud. */}
        <div className={s.todo}>
          <b className={s.todoHead}>What to do</b>
          {same ? (
            <ol>
              <li>{plan ? <>Ask {retailer} to move you to <b>&ldquo;{plan}&rdquo;</b>.</> : <>Ask {retailer} for their cheapest plan for your home.</>} You stay with them: no switching retailer, no new connection.</li>
              <li>Do it in your {retailer} account or app, or contact them using the details on your bill. Have your account number ready.</li>
              <li>Read {retailer}&apos;s terms and the plan&apos;s Energy Fact Sheet before you agree.</li>
            </ol>
          ) : (
            <ol>
              <li>{plan ? <>Find <b>&ldquo;{plan}&rdquo;</b> on {retailer}&apos;s website and sign up there, or contact them and ask for it by name.</> : <>Find the plan on {retailer}&apos;s website and sign up there.</>}</li>
              <li>Read {retailer}&apos;s terms and the plan&apos;s Energy Fact Sheet before you agree.</li>
            </ol>
          )}
        </div>
        {/* 5 Nov 2026: folded away, so the pop-up is the steps and the buttons. */}
        {!same && <details className={s.ready}>
          <summary>What you&apos;ll need to switch</summary>
          <ul>
            <li>Your latest bill: it shows your meter number (NMI) and account details</li>
            <li>ID such as a driver licence, Medicare card or passport: some retailers check it</li>
            <li>Your concession card, if you have one</li>
            <li>Bank or card details, if the plan needs direct debit</li>
          </ul>
          <span>No need to call your current retailer: {retailer} arranges the move, and your power stays on.</span>
        </details>}
        {/* 5 Nov 2026: brief on purpose. The offer, its terms, fees and conditions are the retailer's, not ours. */}
        <ul className={s.list}>
          <li><Icon name="scale" size={18} /><span><b>{independenceLabel()}</b> {independenceLine(retailer)}</span></li>
          <li><Icon name="file" size={18} /><span><b>The offer is {retailer}&apos;s.</b> Their terms, fees and eligibility apply and can change. Our figures are estimates, not a quote.</span></li>
          <li><Icon name="calendar" size={18} /><span><b>10 business days to change your mind</b> on a new energy contract in Victoria. General information, not financial advice.</span></li>
        </ul>
        <label className={s.skip}>
          <input type="checkbox" checked={skipToday} onChange={(e) => setSkipToday(e.target.checked)} /> Don&apos;t show this again today
        </label>
        <div className={s.actions}>
          <button type="button" className={s.stay} onClick={close}>Stay on Utilo</button>
          <button type="button" className={s.go} onClick={go}>
            Go to {retailer}&apos;s website <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import { RETAILER_DIRECTORY } from "@/lib/retailerDirectory";
import { independenceLabel, independenceLine } from "@/lib/disclosures";
import type { OfferSummary } from "@/lib/planExtras";
import Icon from "./Icon";
import OfferTerms from "./OfferTerms";
import s from "./leavesite.module.css";

// Before a customer goes to a retailer's website from any "Go to …" link on
// the site, show what they should check and confirm they're happy to leave.
// Mounted once in the root layout; it watches clicks on links to the
// retailers' sites, so new links are covered automatically. A link can carry
// data-plan="Plan name" so the pop-up can say what to look for, plus
// data-network (and data-fuel="G" for gas) so it can list that offer's
// discounts and sign-up conditions. The offer data loads only when needed.

const SKIP_KEY = "utilo.leaveOk";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const HOSTS = Object.entries(RETAILER_LINKS).map(([name, url]) => [name, new URL(url).hostname.replace(/^www\./, "")] as const);

function retailerFor(href: string): string | null {
  let host = "";
  try { host = new URL(href, window.location.href).hostname.replace(/^www\./, ""); } catch { return null; }
  const hit = HOSTS.find(([, h]) => host === h || host.endsWith(`.${h}`));
  return hit ? hit[0] : null;
}

/** Solar at home, from the last check in this browser (for solar-only offers). */
function hasSolarHere(): boolean {
  try {
    const d = JSON.parse(window.localStorage.getItem("utilo.check.v1") ?? "null");
    return d?.hasSolar === true || d?.profile?.hasSolar === true;
  } catch {
    return false;
  }
}

type Target = { href: string; retailer: string; plan: string | null; network: string | null; fuel: "E" | "G"; same: boolean };

export default function LeaveSiteGuard() {
  const [target, setTarget] = useState<Target | null>(null);
  const [offer, setOffer] = useState<OfferSummary | null>(null);
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
      setOffer(null);
      setTarget({ href: a.href, retailer, plan: a.dataset.plan ?? null, network: a.dataset.network ?? null, fuel: a.dataset.fuel === "G" ? "G" : "E", same: a.dataset.same === "1" });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const close = useCallback(() => setTarget(null), []);
  // This offer's discounts and conditions, loaded on demand.
  useEffect(() => {
    if (!target?.plan) return;
    let live = true;
    import("@/lib/planExtras")
      .then((m) => { if (live) setOffer(m.describeOffer(target.fuel, target.retailer, target.plan as string, target.network, { hasSolar: hasSolarHere() })); })
      .catch(() => { /* the general points still show */ });
    return () => { live = false; };
  }, [target]);
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
  const phone = RETAILER_DIRECTORY[retailer]?.phone ?? null;
  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;

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
              <li>Do it in your {retailer} account or app, or {phone ? <>call them on <a href={tel ?? undefined} className={s.tel}>{phone}</a></> : "call them"}. Have your account number from your bill.</li>
              <li>Check the plan&apos;s rates and conditions before you agree.</li>
            </ol>
          ) : (
            <ol>
              <li>{plan ? <>Find <b>&ldquo;{plan}&rdquo;</b> on {retailer}&apos;s website</> : <>Find the plan on {retailer}&apos;s website</>}, or {phone ? <>call them on <a href={tel ?? undefined} className={s.tel}>{phone}</a></> : "call them"} and ask for it by name.</li>
              <li>Check the plan&apos;s rates and conditions before you agree.</li>
            </ol>
          )}
        </div>
        {offer && plan && <OfferTerms o={offer} retailer={retailer} compact title="This offer: discounts and what you need" />}
        {!same && <div className={s.ready}>
          <b>Have these ready (about 10 minutes)</b>
          <ul>
            <li>Your latest bill: it shows your meter number (NMI) and account details</li>
            <li>ID such as a driver licence, Medicare card or passport: some retailers check it</li>
            <li>Your concession card, if you have one</li>
            <li>Bank or card details, if the plan needs direct debit</li>
          </ul>
          <span>No need to call your current retailer: {retailer} arranges the move, and your power stays on.</span>
        </div>}
        <ul className={s.list}>
          <li><Icon name="scale" size={18} /><span><b>{independenceLabel()}</b> {independenceLine(retailer)}</span></li>
          <li><Icon name="refresh" size={18} /><span><b>Check it&apos;s still available.</b> Offers and prices change, sometimes daily. What {retailer} offers you may differ from our estimate.</span></li>
          <li><Icon name="receipt" size={18} /><span><b>Read the conditions.</b> Some prices depend on paying on time, direct debit, e-billing or a membership, and you need to be eligible. Our figures include each plan&apos;s discounts, assuming you pay on time, and leave out sign-up credits, fees and concessions.</span></li>
          {!same && <li><Icon name="landmark" size={18} /><span><b>Concessions and payment plans don&apos;t move with you.</b> Give {retailer} your concession card details when you sign up. Behind on a bill or on a payment plan? Talk to your current retailer first.</span></li>}
          <li><Icon name="file" size={18} /><span><b>Read the Energy Fact Sheet.</b> It&apos;s the official summary of the plan&apos;s rates and terms. {retailer} must give you one.</span></li>
          <li><Icon name="calendar" size={18} /><span><b>You can change your mind.</b> In Victoria you have 10 business days to cancel a new energy contract without penalty.</span></li>
          <li><Icon name="check" size={18} /><span><b>Your decision.</b> This is general information, not financial advice. Think about what suits you before you switch.</span></li>
        </ul>
        <label className={s.skip}>
          <input type="checkbox" checked={skipToday} onChange={(e) => setSkipToday(e.target.checked)} /> Don&apos;t show this again today
        </label>
        <div className={s.actions}>
          <button type="button" className={s.stay} onClick={close}>Stay on Utilo</button>
          {tel && <a href={tel} className={s.call}><Icon name="phone" size={16} /> Call {phone}</a>}
          <button type="button" className={s.go} onClick={go}>
            Go to {retailer}&apos;s website <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </div>
  );
}

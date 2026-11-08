"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { BillCheck } from "@/lib/billCheck";
import { billIssues, issueSummary, type BillIssue, type BillMoney } from "@/lib/billIssues";
import { PLANS } from "@/lib/plans";
import { EWOV_URL, findMoney, type Finding } from "@/lib/moneyFinder";
import s from "./billcheck.module.css";

/** 5 Nov 2026: what's needed to turn the check into money and messages. */
export interface BillFixContext {
  member: boolean;
  /** Where "Join Utilo Plus" goes for a free check. */
  joinHref?: string;
  name?: string | null;
  address?: string | null;
  nmi?: string | null;
  billTotal?: number | null;
  days?: number | null;
  /** A member's answer is saved with their account too. */
  onCard?: (hasCard: boolean) => void;
  /** What this bill turned up, for the member's running total (called when it changes). */
  onFound?: (f: { perYear: number; oneOff: number; ids: string[] }) => void;
}

const CARD_KEY = "utilo.concessionCard";

/** The Victorian Government's own page on help paying energy bills. */
const HELP_URL = "https://energy.vic.gov.au/households/help-paying-your-bills";
const whole = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

export interface BillCheckFacts {
  /** The plan name printed on the bill. */
  billPlanName: string;
  /** Today's version of the same-name plan, and how much less it costs than the bill, when it's at least $20 a year. */
  olderVersion: { planName: string; perMonth: number; perYear: number } | null;
  /** The bill's plan matches one on sale today at about the same price. */
  planIsCurrent: boolean;
  /** The retailer's cheapest plan for this usage, the yearly saving against the bill, and its tariff type. */
  retailerBest: { planName: string; savingPerYear: number; tariff?: "flat" | "tou" | null } | null;
  retailerCount: number;
  /** Below this a saving isn't worth acting on ($ a year). */
  worthPerYear: number;
  /** The bill's usage and rates, for "charges that look off" and "dearer than anything on sale". */
  money?: Omit<BillMoney, "total"> | null;
}

/**
 * "We checked your bill" (reworked 2 Nov 2026): one card, ranked. Things to
 * act on and things worth a look stay open; everything that checked out
 * folds into one line, so a clean bill takes almost no room.
 */
export default function BillCheckCard({ check, retailer, facts, title = "We checked your bill", explain, fix }: {
  check: BillCheck;
  retailer: string;
  facts: BillCheckFacts;
  title?: string;
  /** The plain-English explainer, folded at the foot of the card (the dashboard). */
  explain?: ReactNode;
  /** Money and ready-to-send messages (5 Nov 2026). Without it the card is as before. */
  fix?: BillFixContext;
}) {
  // Concession card: asked once, remembered on this device (and on a member's account).
  const [hasCard, setHasCard] = useState<boolean | null>(null);
  useEffect(() => {
    let v: string | null = null;
    try { v = window.localStorage.getItem(CARD_KEY); } catch { /* storage off */ }
    const t = setTimeout(() => setHasCard(v === "yes" ? true : v === "no" ? false : null), 0);
    return () => clearTimeout(t);
  }, []);
  const answerCard = (v: boolean) => {
    setHasCard(v);
    try { window.localStorage.setItem(CARD_KEY, v ? "yes" : "no"); } catch { /* storage off */ }
    fix?.onCard?.(v);
  };
  // Only a payment plan or a real amount overdue (a small one is usually a payment that crossed with the bill).
  const behind = check.paymentPlan || (check.overdue ?? 0) >= 100;
  const list = billIssues({
    retailer,
    readingType: check.readingType,
    concession: check.concession,
    behind,
    paymentPlan: check.paymentPlan,
    bestOffer: check.bestOffer,
    fees: check.fees ?? [],
    discountLost: check.discountLost === true,
    billPlanName: facts.billPlanName,
    olderVersion: facts.olderVersion,
    planIsCurrent: facts.planIsCurrent,
    retailerBest: facts.retailerBest,
    retailerCount: facts.retailerCount,
    worthPerYear: facts.worthPerYear,
    money: facts.money ? { ...facts.money, total: check.newCharges ?? null } : null,
    plans: PLANS,
  });
  const found = fix
    ? findMoney({
        retailer,
        billPlanName: facts.billPlanName,
        olderVersion: facts.olderVersion ? { planName: facts.olderVersion.planName, perYear: facts.olderVersion.perYear } : null,
        retailerBest: facts.retailerBest,
        worthPerYear: facts.worthPerYear,
        flagged: new Set(list.filter((i) => i.level === "act" || i.level === "look").map((i) => i.id)),
        readingType: check.readingType,
        concessionApplied: check.concession,
        hasCard,
        fees: check.fees ?? [],
        billTotal: fix.billTotal ?? check.newCharges ?? null,
        days: fix.days ?? null,
        unexplained: list.find((i) => i.id === "unexplained")?.amount ?? null,
        name: fix.name, address: fix.address, nmi: fix.nmi,
      })
    : null;
  const findingFor = (id: string): Finding | undefined => found?.findings.find((f) => f.id === id);
  const foundSig = found ? JSON.stringify([Math.round(found.perYear), found.oneOff, found.findings.map((f) => f.id)]) : "";
  const onFound = fix?.onFound;
  useEffect(() => {
    if (!foundSig || !onFound) return;
    const [perYear, oneOff, ids] = JSON.parse(foundSig) as [number, number, string[]];
    const t = setTimeout(() => onFound({ perYear, oneOff, ids }), 800); // wait for the card question to settle
    return () => clearTimeout(t);
  }, [foundSig, onFound]);
  // No card: the concession line isn't relevant to them.
  const shown = fix && hasCard === false ? list.filter((i) => !(i.id === "concession" && !check.concession)) : list;
  const open = shown.filter((i) => i.level !== "ok");
  const ok = shown.filter((i) => i.level === "ok");
  const base = issueSummary(shown);
  // A concession found after the card question counts as a thing worth a look too.
  const flagged = open.filter((i) => i.level === "act" || i.level === "look" || !!findingFor(i.id)).length;
  const sum = fix ? { flagged, text: flagged === 0 ? "Nothing looks off" : `${flagged} thing${flagged === 1 ? "" : "s"} worth a look` } : base;
  const checkedOn = check.checkedAt ? new Date(check.checkedAt + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : null;

  const item = (i: BillIssue) => {
    const f = findingFor(i.id);
    const askCard = fix && i.id === "concession" && !check.concession && hasCard === null;
    const level = f && i.level === "info" ? "act" : i.level;
    return (
    <li key={i.id} className={level === "ok" ? s.ok : level === "info" ? s.info : level === "act" ? `${s.warn} ${s.act}` : s.warn}>
      <b>{f && i.id === "concession" ? "You could get a 17.5% concession." : i.title}</b>
      {f?.perYear ? <span className={s.worth}>about {whole(f.perYear)} a year</span> : f?.oneOff ? <span className={s.worth}>{whole(f.oneOff)} back</span> : i.perYear && i.perYear >= 1 && i.level === "act" ? <span className={s.worth}>about {whole(i.perYear)} a year</span> : null} {f ? f.ask : i.body}
      {i.link && <> <a href={i.link.href} className={s.issueLink}>{i.link.label} →</a></>}
      {askCard && (
        <span className={s.askCard}>
          Do you have a Pensioner Concession, Health Care or DVA Gold card?
          <span className={s.askBtns}>
            <button type="button" onClick={() => answerCard(true)}>Yes, I have one</button>
            <button type="button" onClick={() => answerCard(false)}>No</button>
          </span>
        </span>
      )}
      {f && fix && <FixIt f={f} retailer={retailer} member={fix.member} joinHref={fix.joinHref ?? "/pricing"} />}
      {i.id === "behind" && (
        <>
          {" "}
          <a href={HELP_URL} target="_blank" rel="noopener noreferrer">Where to get help ↗</a>
        </>
      )}
    </li>
    );
  };

  return (
    <section className={s.card} aria-labelledby="bill-check-title">
      <div className={s.head}>
        <h3 id="bill-check-title" className={s.title}>
          {title}
          {checkedOn && <small> · bill read {checkedOn}</small>}
        </h3>
        <span className={sum.flagged ? s.chipWarn : s.chipOk}>{sum.flagged ? sum.text : `✓ ${sum.text}`}</span>
      </div>
      {found && (found.perYear > 0 || found.oneOff > 0) && (
        <p className={s.found}>
          Money we found on this bill: <b>{found.perYear > 0 ? `about ${whole(found.perYear)} a year` : ""}{found.perYear > 0 && found.oneOff > 0 ? " and " : ""}{found.oneOff > 0 ? `${whole(found.oneOff)} back` : ""}</b>. {fix?.member ? "Each one below has what to say to your retailer." : "Each one below says what to ask for. Utilo Plus gives you the words."}
        </p>
      )}
      {open.length > 0 && <ul className={s.list}>{open.map(item)}</ul>}
      {ok.length > 0 && (
        <details className={s.fold} open={open.length === 0}>
          <summary>✓ {ok.length} thing{ok.length === 1 ? "" : "s"} checked out</summary>
          <ul className={s.list}>{ok.map(item)}</ul>
        </details>
      )}
      {explain && (
        <details className={s.fold}>
          <summary className={s.explainSum}>Explain my bill ▾</summary>
          {explain}
        </details>
      )}
    </section>
  );
}

/**
 * "How to fix it" (5 Nov 2026): what to say to the retailer, first; the written message for their app,
 * chat or contact form; then the ombudsman. No phone numbers: the customer uses the contact details on their bill.
 */
function FixIt({ f, retailer, member, joinHref }: { f: Finding; retailer: string; member: boolean; joinHref: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"" | "msg" | "ewov">("");
  const who = retailer || "your retailer";
  const text = `${f.message.subject}\n\n${f.message.body}`;
  async function copy(what: "msg" | "ewov", value: string, id: string) {
    try { await navigator.clipboard.writeText(value); setCopied(what); setTimeout(() => setCopied(""), 2000); }
    catch { const el = document.getElementById(id) as HTMLTextAreaElement | null; el?.select(); }
  }
  if (!member) {
    return (
      <span className={s.fixTeaser}>
        Utilo Plus tells you exactly what to say to {who}. <a href={joinHref}>See Utilo Plus →</a>
      </span>
    );
  }
  const msgId = `fix-${f.id}`, ewovId = `ewov-${f.id}`;
  return (
    <span className={s.fix}>
      <button type="button" className={s.fixBtn} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide ▴" : "How to fix it ▾"}
      </button>
      {open && (
        <span className={s.fixPanel}>
          <span className={s.fixHow}>
            <b>Contact {who}</b> in their app, on their website or with the contact details on your bill. Have your account number ready{f.id === "concession" ? ", and your concession card" : ""}.
          </span>
          <span className={s.sayBox}>
            <span className={s.sayLabel}>What to say</span>
            &ldquo;{f.say}&rdquo;
          </span>
          <details className={s.ewov}>
            <summary>Prefer to write? A message for their app or online chat</summary>
            <span className={s.fixHow}>Copy it into {who}&apos;s app, online chat or contact form. Fill in the bits in [brackets] first.</span>
            <textarea id={msgId} className={s.fixText} readOnly value={text} rows={Math.min(14, text.split("\n").length + 1)} />
            <button type="button" className={s.copyBtn} onClick={() => void copy("msg", text, msgId)}>{copied === "msg" ? "Copied ✓" : "Copy message"}</button>
          </details>
          <details className={s.ewov}>
            <summary>Not fixed within two weeks? Ask the ombudsman</summary>
            <span className={s.fixHow}>
              The Energy and Water Ombudsman Victoria (EWOV) is free and independent. Lodge a complaint online at{" "}
              <a href={EWOV_URL} target="_blank" rel="noopener noreferrer">ewov.com.au ↗</a>, and tell them:
            </span>
            <textarea id={ewovId} className={s.fixText} readOnly value={f.ewov} rows={5} />
            <button type="button" className={s.copyBtn} onClick={() => void copy("ewov", f.ewov, ewovId)}>{copied === "ewov" ? "Copied ✓" : "Copy for EWOV"}</button>
          </details>
        </span>
      )}
    </span>
  );
}

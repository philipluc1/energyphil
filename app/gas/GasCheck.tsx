"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GAS_PLANS, GAS_PLAN_DATA_DATE, GAS_ZONES, TYPICAL_MJ_PER_DAY, gasBenchmark, gasDataReady, rankGasPlans, type GasZone } from "@/lib/gasPlans";
import { PRICE_CHANGE_CLAUSE } from "@/lib/dataPolicy";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import BillPhotoUpload from "../components/BillPhotoUpload";
import FunEquivalents from "../components/FunEquivalents";
import type { ExtractedBill } from "@/lib/billExtraction";
import styles from "../components/Comparator.module.css";
import ev from "../ev/ev.module.css";

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const KEY = "utilo.gas.v1";

export default function GasCheck() {
  const [zone, setZone] = useState<GasZone>("Australian Gas Networks");
  const [days, setDays] = useState(91);
  const [mj, setMj] = useState(TYPICAL_MJ_PER_DAY * 91);
  const [billRaw, setBillRaw] = useState("");
  const [planName, setPlanName] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const d = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
        if (!d) return;
        if (GAS_ZONES.includes(d.zone)) setZone(d.zone);
        if (typeof d.days === "number") setDays(d.days);
        if (typeof d.mj === "number") setMj(d.mj);
        if (typeof d.billRaw === "string") setBillRaw(d.billRaw);
        if (typeof d.planName === "string") setPlanName(d.planName);
      } catch { /* nothing saved */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(KEY, JSON.stringify({ zone, days, mj, billRaw, planName })); } catch { /* ignore */ }
  }, [zone, days, mj, billRaw, planName]);

  function fromBill(b: ExtractedBill) {
    if (b.gasDistributor && GAS_ZONES.includes(b.gasDistributor as GasZone)) setZone(b.gasDistributor as GasZone);
    if (b.gasBillingDays) setDays(b.gasBillingDays);
    if (b.gasMj) setMj(Math.round(b.gasMj));
    if (b.gasBillTotal) setBillRaw(String(b.gasBillTotal));
    if (b.gasPlanName) setPlanName(b.gasPlanName);
    if (!b.gasMj && b.fuel === "electricity") setPlanName("");
    setShow(Boolean(b.gasMj));
  }

  const bill = billRaw === "" ? null : parseFloat(billRaw);
  const usage = useMemo(() => ({ days, mj }), [days, mj]);
  const ranked = useMemo(() => rankGasPlans(zone, usage), [zone, usage]);
  const bench = useMemo(() => gasBenchmark(zone, usage, bill !== null && !Number.isNaN(bill) ? bill : null), [zone, usage, bill]);
  const top = ranked[0];
  const saving = top && bench ? bench.value - top.total : 0;
  const yearly = (saving / Math.max(1, days)) * 365;

  return (
    <>
      <BillPhotoUpload onApply={fromBill} />
      <div className={styles.card}>
        <div className={styles.stepLabel}>Your gas network</div>
        <div className={styles.choiceRow}>
          {GAS_ZONES.map((z) => (
            <button key={z} type="button" className={`${styles.choiceBtn} ${z === zone ? styles.choiceBtnActive : ""}`} onClick={() => setZone(z)}>{z}</button>
          ))}
        </div>
        <p className={styles.helper}>It&apos;s on your bill as &ldquo;Distributor&rdquo;. Multinet covers much of Melbourne&apos;s east and south-east; AGN most of the rest of Melbourne and regional areas; AusNet the west and north.</p>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="gdays">Billing period (days)</label>
            <input id="gdays" type="number" min={1} max={366} value={days} onChange={(e) => setDays(Number(e.target.value) || 0)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="gmj">Gas used (MJ)</label>
            <input id="gmj" type="number" min={0} value={mj} onChange={(e) => setMj(Number(e.target.value) || 0)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="gbill">Gas charges on the bill ($) <span className={styles.unitNote}>(optional)</span></label>
            <input id="gbill" type="number" min={0} step="0.01" placeholder="e.g. 245.60" value={billRaw} onChange={(e) => setBillRaw(e.target.value)} />
          </div>
        </div>
        <p className={styles.helper}>A typical home uses about {TYPICAL_MJ_PER_DAY} MJ a day, more in winter with gas heating.</p>
        <button type="button" className={styles.heroCta} onClick={() => setShow(true)}>See my cheapest gas plan →</button>
      </div>

      {show && !gasDataReady && (
        <div className={`${styles.card} ${ev.promo}`}>
          <b>Gas prices are loading.</b> We&apos;ve saved your details here, and the comparison switches on with our next daily price pull. In the meantime the <Link href="/check">electricity check</Link> works as normal.
        </div>
      )}

      {show && gasDataReady && top && bench && (
        <>
          <div className={styles.resultHero}>
            <span className={styles.resultHeroKicker}>{bench.label === "your bill" ? "Based on your gas bill" : "Compared with a typical plan"}</span>
            <div className={styles.resultHeroLabel}>{saving > 0 ? "You could save about" : "You're already close to the cheapest"}</div>
            <div className={styles.resultHeroNum}>${Math.max(0, Math.round(yearly)).toLocaleString("en-AU")}</div>
            <div className={styles.resultHeroSub}>a year on gas with {top.plan[0]}, vs {bench.label}</div>
            {saving > 0 && <FunEquivalents dollars={yearly} />}
            <span className={styles.resultHeroFine}>Excludes conditional discounts and fees. {PRICE_CHANGE_CLAUSE}</span>
          </div>
          <div className={styles.bestCard}>
            <span className={styles.bestTag}>Cheapest gas match</span>
            <div className={styles.retailer}>{top.plan[0]}</div>
            <div className={styles.plan}>{top.plan[2]}</div>
            <div className={styles.nums}>
              <div className={styles.numBlock}><div className={`${styles.v} mono`}>{money(top.total)}</div><div className={styles.l}>this period</div></div>
              <div className={`${styles.numBlock} ${styles.save}`}><div className={`${styles.v} mono`}>{money(Math.abs(saving))}</div><div className={styles.l}>{saving >= 0 ? "you'd save" : "extra"} vs {bench.label}</div></div>
            </div>
            {RETAILER_LINKS[top.plan[0]] && (
              <div className={styles.getPlan}>
                <div className={styles.getPlanLogo} aria-hidden="true">{top.plan[0].split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
                <div className={styles.getPlanText}><b>Get this plan from {top.plan[0]}</b><span>Look for &ldquo;{top.plan[2]}&rdquo;. If you also take electricity from them, ask about a dual-fuel discount.</span></div>
                <a href={RETAILER_LINKS[top.plan[0]]} target="_blank" rel="noopener noreferrer" className={styles.switchBtn}>Go to {top.plan[0]} →</a>
              </div>
            )}
          </div>
          <div className={styles.planList}>
            {ranked.slice(1, 8).map((m, i) => (
              <div key={m.plan[0] + m.plan[2]} className={styles.planRowWrap}>
                <div className={styles.planRow}>
                  <div className={styles.left}><span className={styles.rk}>#{i + 2}</span><span className={styles.rname}>{m.plan[0]}</span><div className={styles.pname}><span className={styles.pnameText}>{m.plan[2]}</span></div></div>
                  <div className={styles.right}><div className={styles.tot}>{money(m.total)}</div></div>
                </div>
              </div>
            ))}
          </div>
          <p className={styles.helper}>
            {GAS_PLANS.filter((p) => p[1] === zone).length} gas plans priced for {zone}, data from {GAS_PLAN_DATA_DATE}. Victoria has no default offer for gas, so without your bill we compare against a typical plan.
          </p>
        </>
      )}
    </>
  );
}

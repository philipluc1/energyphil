"use client";

import { useMemo, useState } from "react";
import {
  DISTRIBUTORS,
  Distributor,
  PLAN_DATA_DATE,
  PLANS,
  benchmarkBill,
  rankPlans,
} from "@/lib/plans";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import styles from "./Comparator.module.css";

const PLAN_COUNT = PLANS.length;

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n: number): string {
  return (n * 100).toLocaleString("en-AU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}
function fmtUpdated(): string {
  return new Date(PLAN_DATA_DATE + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Mode = "simple" | "detailed";
type LeadStatus = "idle" | "saving" | "saved" | "error";

export default function Comparator() {
  const [distributor, setDistributor] = useState<Distributor>("Citipower");
  const [days, setDays] = useState(91);
  const [mode, setMode] = useState<Mode>("simple");
  const [anytime, setAnytime] = useState(1150);
  const [peak, setPeak] = useState(0);
  const [shoulder, setShoulder] = useState(0);
  const [offpeak, setOffpeak] = useState(0);
  const [showCl, setShowCl] = useState(false);
  const [cl, setCl] = useState(0);
  const [currentBillRaw, setCurrentBillRaw] = useState("");
  const [email, setEmail] = useState("");
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("idle");

  const currentBill = currentBillRaw === "" ? null : parseFloat(currentBillRaw);
  const usagePeak = mode === "detailed" ? peak : 0;
  const usageShoulder = mode === "detailed" ? shoulder : 0;
  const usageOffpeak = mode === "detailed" ? offpeak : 0;
  const usageAnytime = mode === "simple" ? anytime : 0;
  const usage = {
    days,
    peak: usagePeak,
    shoulder: usageShoulder,
    offpeak: usageOffpeak,
    anytime: usageAnytime,
    cl,
  };

  const matches = useMemo(
    () =>
      rankPlans(distributor, {
        days,
        peak: usagePeak,
        shoulder: usageShoulder,
        offpeak: usageOffpeak,
        anytime: usageAnytime,
        cl,
      }),
    [distributor, days, usagePeak, usageShoulder, usageOffpeak, usageAnytime, cl],
  );
  const totalInDist = useMemo(() => PLANS.filter((p) => p[1] === distributor).length, [distributor]);
  const bench = benchmarkBill(distributor, days, currentBill !== null && !Number.isNaN(currentBill) ? currentBill : null);

  const potentialWithTou = useMemo(
    () => PLANS.filter((p) => p[1] === distributor && p[6] !== null).length,
    [distributor],
  );
  const showUnlock = mode === "simple" && potentialWithTou > 0;

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      // Not wired up yet (Supabase env vars not set in Vercel) — still confirm locally so the
      // flow feels complete for whoever's testing it.
      setLeadStatus("saved");
      return;
    }
    setLeadStatus("saving");
    const top = matches[0];
    const save = top ? bench - top.total : null;
    const { error } = await supabase.from("leads").insert({
      email,
      distributor,
      billing_days: days,
      usage_mode: mode,
      peak_kwh: usage.peak,
      shoulder_kwh: usage.shoulder,
      offpeak_kwh: usage.offpeak,
      anytime_kwh: usage.anytime,
      controlled_load_kwh: usage.cl,
      current_bill: currentBill,
      best_retailer: top?.plan[0] ?? null,
      best_plan_name: top?.plan[2] ?? null,
      best_total: top?.total ?? null,
      estimated_saving: save,
      estimated_saving_pct: save !== null && bench > 0 ? save / bench : null,
    });
    setLeadStatus(error ? "error" : "saved");
  }

  const top = matches[0];
  const rest = matches.slice(1, 9);

  return (
    <>
      <header className={styles.top}>
        <div className={styles.bar}>
          <div className={styles.brand}>
            <span className={styles.mark}>
              VIC Energy<span className={styles.accent}>Check</span>
            </span>
          </div>
          <span className={styles.badge}>{PLAN_COUNT} live plans · 15 retailers</span>
        </div>
      </header>

      <div className={styles.wrap}>
        <section className={styles.hero}>
          <h1>See if you&apos;re overpaying for electricity — checked live against the Victorian market.</h1>
          <p className={styles.lede}>
            Tell us your network and usage, and we&apos;ll check it against every current residential plan
            we can see live from Victorian retailers. No sign-up needed to see your result.
          </p>
          <div className={styles.trustRow}>
            <div className={styles.trustChip}>
              <span className={styles.num}>{PLAN_COUNT}</span>
              <span className={styles.lbl}>live plans</span>
            </div>
            <div className={styles.trustChip}>
              <span className={styles.num}>15</span>
              <span className={styles.lbl}>retailers</span>
            </div>
            <div className={styles.trustChip}>
              <span className={styles.num}>5</span>
              <span className={styles.lbl}>VIC networks</span>
            </div>
            <div className={styles.trustChip}>
              <span className={styles.num}>{fmtUpdated()}</span>
              <span className={styles.lbl}>data pulled</span>
            </div>
          </div>
        </section>

        <div className={styles.card}>
          <div className={styles.stepLabel}>
            <span className={styles.stepNum}>1</span> Your electricity network
          </div>
          <div className={styles.distGrid}>
            {DISTRIBUTORS.map((d) => (
              <button
                key={d}
                type="button"
                className={`${styles.distBtn} ${d === distributor ? styles.distBtnActive : ""}`}
                onClick={() => setDistributor(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <p className={styles.helper}>
            This is on your bill as &ldquo;Distributor&rdquo; or &ldquo;Network&rdquo; — not your retailer.
            Unsure? It&apos;s usually named after your suburb&apos;s poles-and-wires operator.
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.stepLabel}>
            <span className={styles.stepNum}>2</span> Your billing period
          </div>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="days">Billing period length</label>
              <input
                id="days"
                type="number"
                min={1}
                max={366}
                value={days}
                onChange={(e) => setDays(Math.max(1, parseFloat(e.target.value) || 91))}
              />
              <span className={styles.unitNote}>days on your bill (usually ~90 for quarterly)</span>
            </div>
            <div className={styles.field}>
              <label htmlFor="currentBill">
                What you&apos;re paying now <span className={styles.unitNote}>(optional)</span>
              </label>
              <input
                id="currentBill"
                type="number"
                min={0}
                step={0.01}
                placeholder="e.g. 425.31"
                value={currentBillRaw}
                onChange={(e) => setCurrentBillRaw(e.target.value)}
              />
              <span className={styles.unitNote}>$ inc. GST for that period — leave blank to compare vs the VDO benchmark</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.stepLabel}>
            <span className={styles.stepNum}>3</span> Your usage this period
          </div>
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={mode === "simple" ? styles.modeToggleActive : ""}
              onClick={() => setMode("simple")}
            >
              I know my total usage
            </button>
            <button
              type="button"
              className={mode === "detailed" ? styles.modeToggleActive : ""}
              onClick={() => setMode("detailed")}
            >
              I have peak / off-peak on my bill
            </button>
          </div>

          {mode === "simple" ? (
            <div className={styles.sectionGap}>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="anytime">Total usage (kWh)</label>
                  <input
                    id="anytime"
                    type="number"
                    min={0}
                    value={anytime}
                    onChange={(e) => setAnytime(parseFloat(e.target.value) || 0)}
                  />
                  <span className={styles.unitNote}>the one big number on a basic bill</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.sectionGap}>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="peak">Peak usage (kWh)</label>
                  <input id="peak" type="number" min={0} value={peak} onChange={(e) => setPeak(parseFloat(e.target.value) || 0)} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="shoulder">Shoulder usage (kWh)</label>
                  <input
                    id="shoulder"
                    type="number"
                    min={0}
                    value={shoulder}
                    onChange={(e) => setShoulder(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="offpeak">Off-peak usage (kWh)</label>
                  <input
                    id="offpeak"
                    type="number"
                    min={0}
                    value={offpeak}
                    onChange={(e) => setOffpeak(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <p className={styles.helper}>
                Found on a smart-meter bill or in your retailer&apos;s app under &ldquo;usage breakdown&rdquo;. Leave a band
                at 0 if your bill doesn&apos;t show it.
              </p>
            </div>
          )}

          <button type="button" className={styles.clToggle} onClick={() => setShowCl((v) => !v)}>
            {showCl ? "- Hide controlled load" : "+ Add controlled load / off-peak hot water (if separately metered)"}
          </button>
          {showCl && (
            <div className={`${styles.fieldGrid} ${styles.sectionGap}`}>
              <div className={styles.field}>
                <label htmlFor="cl">Controlled load usage (kWh)</label>
                <input id="cl" type="number" min={0} value={cl} onChange={(e) => setCl(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          )}

          <div className={styles.counterStrip}>
            <span className={styles.count}>{matches.length}</span>
            <span className={styles.txt}>
              of {totalInDist} plans on this network can be priced from what you&apos;ve told us
            </span>
          </div>
          {showUnlock && (
            <div className={styles.unlockHint}>
              Know your peak / off-peak split? Switching to detailed entry could unlock up to{" "}
              {matches.length + potentialWithTou} comparable plans instead of {matches.length}.
            </div>
          )}
        </div>

        <section className={styles.sectionGap}>
          <div className={styles.resultsHead}>
            <h2>Your ranked results</h2>
            {matches.length > 0 && (
              <span className={styles.resultsSub}>
                {matches.length} comparable plan{matches.length === 1 ? "" : "s"} for {distributor} · {days}-day period
              </span>
            )}
          </div>

          {!top ? (
            <div className={styles.emptyState}>
              No comparable plans yet — enter your usage above (or switch to detailed peak/off-peak entry) to see
              ranked results.
            </div>
          ) : (
            <>
              <div className={styles.bestCard}>
                <span className={styles.bestTag}>Cheapest match</span>
                <div className={styles.retailer}>
                  {top.plan[0]}
                  <span className={`${styles.offerTag} ${top.plan[3] === "MARKET" ? styles.offerMarket : styles.offerStanding}`}>
                    {top.plan[3] === "MARKET" ? "Market offer" : "Standing offer"}
                  </span>
                </div>
                <div className={styles.plan}>{top.plan[2]}</div>
                <div className={styles.nums}>
                  <div className={styles.numBlock}>
                    <div className={`${styles.v} mono`}>{fmtCurrency(top.total)}</div>
                    <div className={styles.l}>this period</div>
                  </div>
                  <div className={`${styles.numBlock} ${styles.save}`}>
                    <div className={`${styles.v} mono`}>
                      {bench - top.total >= 0 ? "-" : "+"}
                      {fmtCurrency(Math.abs(bench - top.total))}
                    </div>
                    <div className={styles.l}>vs {currentBill ? "your bill" : "VDO benchmark"}</div>
                  </div>
                  <div className={`${styles.numBlock} ${styles.save}`}>
                    <div className={`${styles.v} mono`}>{fmtPct(Math.abs(bench > 0 ? (bench - top.total) / bench : 0))}</div>
                    <div className={styles.l}>{bench - top.total >= 0 ? "lower" : "higher"}</div>
                  </div>
                </div>
              </div>

              <div className={styles.planList}>
                {rest.map((m, i) => {
                  const mSave = bench - m.total;
                  return (
                    <div className={styles.planRow} key={m.plan[9] + m.plan[2] + i}>
                      <div className={styles.left}>
                        <span className={styles.rk}>#{i + 2}</span>
                        <span className={styles.rname}>{m.plan[0]}</span>
                        <span className={`${styles.offerTag} ${m.plan[3] === "MARKET" ? styles.offerMarket : styles.offerStanding}`}>
                          {m.plan[3] === "MARKET" ? "Market" : "Standing"}
                        </span>
                        <div className={styles.pname}>{m.plan[2]}</div>
                      </div>
                      <div className={styles.right}>
                        <div className={styles.tot}>{fmtCurrency(m.total)}</div>
                        <div className={`${styles.sav} ${mSave < 0 ? styles.savNeg : ""}`}>
                          {mSave >= 0 ? "-" : "+"}
                          {fmtCurrency(Math.abs(mSave))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <div className={styles.leadCard}>
          <h3>Want us to text or email you when it&apos;s time to switch?</h3>
          <p>
            Leave your email and we&apos;ll let you know if a cheaper plan shows up, or when your current deal is
            about to expire. No spam, no obligation.
          </p>
          <form className={styles.leadForm} onSubmit={handleLeadSubmit}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className={styles.btnPrimary} disabled={leadStatus === "saving" || leadStatus === "saved"}>
              {leadStatus === "saving" ? "Saving…" : leadStatus === "saved" ? "Saved" : "Notify me"}
            </button>
          </form>
          {leadStatus === "saved" && (
            <p className={styles.leadOk}>Thanks — we&apos;ve noted your email. We&apos;ll be in touch if a better deal turns up.</p>
          )}
          {leadStatus === "error" && (
            <p className={styles.leadErr}>Something went wrong saving that — please try again in a moment.</p>
          )}
          {!supabaseConfigured && (
            <p className={styles.leadNote}>
              This preview build isn&apos;t connected to live storage yet — signups above are confirmed on-screen only.
            </p>
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.fbrand}>VIC Energy Check</div>
          <p>
            An independent comparison tool for Victorian residential electricity customers. Plan data is pulled from
            each retailer&apos;s own Consumer Data Right (CDR) product reference feed and reflects each retailer&apos;s
            most recently published rates; always confirm final pricing with the retailer before switching. This tool
            does not sell or transfer energy and is not an authorised retailer. Benchmark figures reference the
            Essential Services Commission&apos;s Victorian Default Offer. Figures shown are indicative estimates for
            the billing period you enter and exclude one-off fees, concessions, and solar feed-in credits.
          </p>
        </footer>
      </div>
    </>
  );
}

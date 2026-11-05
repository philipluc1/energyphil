import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { loyaltyTax, AVERAGE_KWH, GAS_GJ } from "@/lib/loyaltyTax";
import { PLUS_NAME } from "@/lib/pricingPlans";
import { RECEIVES_RETAILER_FEES } from "@/lib/disclosures";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";
import s from "./loyaltytax.module.css";

// 5 Nov 2026: the monthly loyalty tax report. Built from the daily plan data, so it updates itself.
export const revalidate = 21600;

const r = loyaltyTax();
const whole = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

export const metadata = pageMeta({
  title: `The loyalty tax in Victoria${r.monthLabel ? `: ${r.monthLabel}` : ""}`,
  description: `An average Victorian home on the default offer pays about ${whole(r.avgVdoGap)} a year more for electricity than the cheapest plan it can get. Worked out from every retailer's published plans, updated daily.`,
  path: "/loyalty-tax",
});

export default function LoyaltyTaxPage() {
  const d = loyaltyTax();
  const changes = d.month.newOffers + d.month.priceChanges;
  return (
    <>
      <SiteHeader active="other" />
      <main className={styles.wrap}>
        <section className={home.pageHead}>
          <p className={s.kicker}>The loyalty tax{d.monthLabel ? ` · ${d.monthLabel}` : ""}</p>
          <h1>What staying put costs a Victorian home</h1>
          <p className={styles.lede}>From every retailer&apos;s own published plans, re-checked every morning. For an average home using {AVERAGE_KWH.toLocaleString("en-AU")} kWh of electricity a year, no solar. No retailer is named: this is about the gap, not who&apos;s cheapest.</p>
        </section>

        <section className={s.hero} aria-label="The headline">
          <div className={s.big}>{whole(d.avgVdoGap)}<span> a year</span></div>
          <p>is about how much more an average home pays on the <b>Victorian Default Offer</b> than on the cheapest plan it can get, across Victoria&apos;s five electricity networks.</p>
          <div className={s.pills}>
            <span><b>{whole(d.avgTypicalGap)}</b> a year between a typical plan and the cheapest</span>
            {d.biggest && <span><b>{whole(d.biggest.vdoGap)}</b> on {d.biggest.network}, the biggest gap</span>}
            {d.month.ready && changes > 0 && <span><b>{changes}</b> offers changed in the last 30 days</span>}
          </div>
        </section>

        <section className={s.block} aria-labelledby="by-network">
          <h2 id="by-network">By electricity network</h2>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>Network</th><th className={s.num}>Default offer</th><th className={`${s.num} ${s.hideSm}`}>Typical plan</th><th className={s.num}>Cheapest plan</th><th className={s.num}>Loyalty tax</th></tr></thead>
              <tbody>
                {d.networks.map((n) => (
                  <tr key={n.network}><td>{n.network}</td><td className={s.num}>{whole(n.vdo)}</td><td className={`${s.num} ${s.hideSm}`}>{whole(n.typical)}</td><td className={s.num}>{whole(n.cheapest)}</td><td className={`${s.num} ${s.gap}`}>{whole(n.vdoGap)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.note}>A year, including GST. Loyalty tax: default offer minus the cheapest plan an average home can get (members-only and other restricted offers left out). Typical plan: the middle of the market offers on that network.</p>
        </section>

        {d.gas.length > 0 && (
          <section className={s.block} aria-labelledby="gas">
            <h2 id="gas">Gas</h2>
            <p className={s.note}>Victoria has no default offer for gas, so here it&apos;s a typical plan against the cheapest, for a gas-heated home using {GAS_GJ} GJ a year.</p>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>Gas network</th><th className={s.num}>Typical plan</th><th className={s.num}>Cheapest plan</th><th className={s.num}>Gap</th></tr></thead>
                <tbody>
                  {d.gas.map((g) => (<tr key={g.zone}><td>{g.zone}</td><td className={s.num}>{whole(g.typical)}</td><td className={s.num}>{whole(g.cheapest)}</td><td className={`${s.num} ${s.gap}`}>{whole(g.gap)}</td></tr>))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {d.month.ready && changes > 0 && (
          <section className={s.block} aria-labelledby="month">
            <h2 id="month">This month in the market</h2>
            <p>In the last 30 days, {d.month.retailers} retailers published <b>{d.month.newOffers} new offers</b> and changed the prices of <b>{d.month.priceChanges}</b> more. A plan that was the best deal when you signed up often isn&apos;t a year later. <Link href="/market">See every change →</Link></p>
          </section>
        )}

        <section className={s.cta} aria-label="Your own number">
          <h2>Your own number is on your bill</h2>
          <p>An average home is a starting point. Snap your bill and see what you could save, free. {PLUS_NAME} then re-checks it every morning and tells you when to move.</p>
          <div className={s.ctaBtns}>
            <Link href="/check" className={s.primary}>Check my bill, free</Link>
            <Link href="/pricing" className={s.ghost}>About {PLUS_NAME}</Link>
          </div>
        </section>

        <section className={s.block} aria-labelledby="method">
          <h2 id="method">How we work it out</h2>
          <ul className={s.method}>
            <li>Plans: every residential electricity and gas offer the retailers publish through the Consumer Data Right (the same source as Energy Made Easy), pulled daily{d.asOf ? `; these figures use plans as at ${new Date(`${d.asOf}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}` : ""}.</li>
            <li>Default offer: the Essential Services Commission&apos;s Victorian Default Offer for the same usage. <Link href="/default-offer">More on the default offer</Link></li>
            <li>Average home: {AVERAGE_KWH.toLocaleString("en-AU")} kWh a year, the figure the ESC uses for the default offer. Real homes vary, which is why a bill gives a better answer.</li>
            <li>We compare {d.plansCompared.toLocaleString("en-AU")} plan prices across the five networks.{RECEIVES_RETAILER_FEES ? "" : " Utilo is independent and takes no money from retailers."}</li>
          </ul>
          <p className={s.note}>Media: you&apos;re welcome to use these figures with a link to utilo.com.au/loyalty-tax. They update every morning.</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

import Link from "next/link";
import { DISTRIBUTORS, PLAN_DATA_DATE, VDO } from "@/lib/plans";
import SiteHeader from "../components/SiteHeader";
import comparatorStyles from "../components/Comparator.module.css";
import styles from "../components/StaticPage.module.css";

function fmtUpdated(): string {
  return new Date(PLAN_DATA_DATE + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtDollars(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtCents(n: number): string {
  return (n * 100).toLocaleString("en-AU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "c";
}

export default function DefaultOfferPage() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Understanding your bill</span>
          <h1>The Victorian Default Offer, and why &ldquo;the best plan&rdquo; keeps changing</h1>
          <div className={styles.updated}>Rates below as published in retailers&apos; data, pulled {fmtUpdated()}.</div>
          <p className={styles.lede}>
            If you&apos;ve seen the term &ldquo;Victorian Default Offer&rdquo; (VDO) on your bill or a comparison
            site and weren&apos;t sure what it meant, here&apos;s the short version — plus why we built this as a
            live checker instead of a one-off number.
          </p>
        </section>

        <section className={styles.section}>
          <h2>What the VDO actually is</h2>
          <p>
            The Victorian Default Offer is a maximum electricity price set and reviewed every year by the{" "}
            <strong>Essential Services Commission (ESC)</strong>, Victoria&apos;s independent energy regulator —
            not by us, and not by any retailer. New VDO prices take effect on <strong>1 July</strong> each year
            after a public review process.
          </p>
          <p>
            It applies automatically to residential and small-business customers who are on a retailer&apos;s{" "}
            <strong>standing offer</strong> — in practice, anyone who hasn&apos;t actively chosen one of a
            retailer&apos;s own &ldquo;market&rdquo; plans. It exists as a safety net for people who haven&apos;t
            engaged with the market, and as a public benchmark every retailer has to disclose their market offers
            against.
          </p>
          <p>
            In other words: the VDO is a reasonable, regulated price — but it is almost never the{" "}
            <strong>cheapest</strong> price available on your network. Retailers&apos; competing market offers
            are where the real savings usually are, which is exactly what this tool compares.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Why new offers are &ldquo;always showing&rdquo;</h2>
          <p>
            Unlike the VDO, market offers aren&apos;t reviewed once a year — retailers can add, withdraw, discount,
            or reprice them at any time, often several times a quarter. A plan that was cheapest last month might
            not be today, and a brand-new offer can appear next week that beats everything currently on the market.
          </p>
          <p>
            That&apos;s the reason a static &ldquo;here&apos;s the cheapest plan&rdquo; page — including this one,
            if we never updated it — goes stale fast. We re-pull live plan data directly from each retailer&apos;s
            own published feed, so the comparison you run today reflects what&apos;s actually on offer today, not
            a snapshot from whenever an article was written.
          </p>
          <p>
            It&apos;s also why we built the subscription tier: instead of you having to remember to re-check every
            few months, we keep watching the market for your usage pattern and tell you the moment something
            cheaper turns up.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Current VDO reference rates by network</h2>
          <p>
            These are the current VDO benchmark figures we use as the &ldquo;what you&apos;d pay with no market
            plan at all&rdquo; comparison point when you don&apos;t enter your own current bill on the{" "}
            <Link href="/check">check page</Link>. Your network (distributor) is shown on your bill — it&apos;s not
            the same as your retailer.
          </p>
          <div className={styles.card}>
            <table className={styles.rateTable}>
              <thead>
                <tr>
                  <th>Network</th>
                  <th className={styles.num}>Supply charge</th>
                  <th className={styles.num}>Usage rate</th>
                  <th className={styles.num}>Controlled load</th>
                  <th className={styles.num}>Indicative annual</th>
                </tr>
              </thead>
              <tbody>
                {DISTRIBUTORS.map((d) => {
                  const v = VDO[d];
                  return (
                    <tr key={d}>
                      <td>{d}</td>
                      <td className={styles.num}>{fmtDollars(v.supply)}/day</td>
                      <td className={styles.num}>{fmtCents(v.usage)}/kWh</td>
                      <td className={styles.num}>{fmtCents(v.cl)}/kWh</td>
                      <td className={styles.num}>{fmtDollars(v.annual)}/yr</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className={styles.tableNote}>
              &ldquo;Indicative annual&rdquo; is the ESC&apos;s reference amount for a typical single-rate
              residential customer on that network — not a quote for your household. Your own usage, tariff type,
              and any concessions change what you&apos;d actually pay, which is why{" "}
              <Link href="/check">checking your real bill</Link> gives a far more accurate number than this table
              alone.
            </p>
          </div>
        </section>

        <div className={styles.calloutGood}>
          <strong>The short version:</strong> the VDO is a safe baseline, not a bargain. Market offers change
          constantly and are usually cheaper — so the only way to know you&apos;re on a good one is to check
          against what&apos;s live right now, which is exactly what this tool does, for free.
        </div>

        <div className={styles.ctaRow}>
          <Link href="/check" className={comparatorStyles.heroCta}>
            Check my bill against today&apos;s offers →
          </Link>
        </div>

        <div className={styles.policyNav}>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/cancellation-policy">Cancellation Policy</Link>
          <Link href="/">Home</Link>
        </div>
      </div>
    </>
  );
}

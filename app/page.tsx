import Image from "next/image";
import Link from "next/link";
import { PLANS, PLAN_DATA_DATE } from "@/lib/plans";
import { THREE_HOMES_NETWORK, threeHomesExample } from "@/lib/savings";
import { ABOUT, hasFounderStory } from "@/lib/about";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import SiteHeader from "./components/SiteHeader";
import StateWaitlist from "./components/StateWaitlist";
import Icon from "./components/Icon";
import SourceBanner from "./components/SourceBanner";
import styles from "./components/Comparator.module.css";
import h from "./home2.module.css";

const RETAILER_COUNT = new Set(PLANS.map((p) => p[0])).size;
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

function fmtDate(): string {
  return new Date(PLAN_DATA_DATE + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function Home() {
  const homes = threeHomesExample();
  const typical = homes.find((x) => x.key === "typical");
  const savings = homes.map((x) => x.saving);
  const lowSave = Math.min(...savings);
  const highSave = Math.max(...savings);

  return (
    <>
      <SiteHeader active="home" />

      <main className={h.page}>
        <SourceBanner />

        {/* 1. The hook: built for your home, not a typical one */}
        <section className={h.hero}>
          <div className={h.heroText}>
            <p className={h.eyebrow}>Built from your bill, not a typical household</p>
            <h1 className={h.title}>Small, medium or large? Your home is none of them.</h1>
            <p className={h.lede}>
              A &ldquo;typical household&rdquo; estimate can be hundreds of dollars out. Utilo reads your bill instead: how much power you use and when,
              the rates you pay now, and the plan you&apos;re on. Then it prices the {PLANS.length} plans we track from {RETAILER_COUNT} retailers for{" "}
              <em>your</em> home, and tells you plainly whether switching is worth it.
            </p>
            <div className={h.actions}>
              <Link href="/check" className={h.primary}>
                <Icon name="camera" size={20} /> Price my bill
              </Link>
              <Link href="/check?start=questions" className={h.textLink}>No bill? We&apos;ll estimate from a few questions</Link>
            </div>
            <p className={h.fine}>Free, no sign-up, about a minute. Gas too: <Link href="/gas">check a gas bill</Link>.</p>
          </div>
          <div className={h.heroShot}>
            <div className={h.phone}>
              <Image src="/images/product/3-result.png" alt="A Utilo result on a phone: you could save about $293 a year on the cheapest plan" width={390} height={780} priority />
            </div>
            <p className={h.caption}>A result from the check, using an example bill.</p>
          </div>
        </section>

        {/* 2. What only a bill can tell us */}
        <section className={h.section}>
          <h2 className={h.h2}>Three things only your bill knows</h2>
          <p className={h.sub}>
            A typical-household comparison has to guess all three. They&apos;re what decide your cheapest plan and what it really saves you.
          </p>
          <ul className={h.knows}>
            <li>
              <span className={h.knowIcon}><Icon name="chart" size={22} /></span>
              <h3>How you use power</h3>
              <p>Your usage at peak, off-peak and shoulder times, any controlled load and your solar exports, for the days on your bill.</p>
            </li>
            <li>
              <span className={h.knowIcon}><Icon name="receipt" size={22} /></span>
              <h3>What you pay now</h3>
              <p>Your own rates and your bill total, so the saving we show is against what you actually pay, not against a headline price.</p>
            </li>
            <li>
              <span className={h.knowIcon}><Icon name="tag" size={22} /></span>
              <h3>Which plan you&apos;re on</h3>
              <p>
                Retailers reuse plan names. Around 360,000 Victorians are on an older, dearer version of a plan with a cheaper twin of the same name. Your
                bill shows which one you have, and we&apos;ll tell you.
              </p>
            </li>
          </ul>
        </section>

        {/* 3. Proof: same prices, three homes, three answers */}
        {homes.length === 3 && typical && (
          <section className={h.section}>
            <h2 className={h.h2}>Same prices, three homes, three different answers</h2>
            <p className={h.sub}>
              We priced every plan we track for three homes on the {THREE_HOMES_NETWORK} network, against the default offer, using the latest prices we have. A
              typical-household figure would tell all three they save {money(typical.saving)} a year.
            </p>
            <ol className={h.homes}>
              {homes.map((x) => (
                <li key={x.key} className={x.key === "typical" ? h.homeTypical : undefined}>
                  {x.key === "typical" && <span className={h.homeTag}>What a typical estimate assumes</span>}
                  <h3>{x.title}</h3>
                  <p className={h.homeDetail}>{x.detail}</p>
                  <dl>
                    <div><dt>Uses</dt><dd>{x.annualKwh.toLocaleString("en-AU")} kWh a year</dd></div>
                    <div><dt>Cheapest plan</dt><dd>{money(x.best)} a year</dd></div>
                    <div className={h.homeSave}><dt>Saving vs the default offer</dt><dd>{money(x.saving)}<small> a year</small></dd></div>
                  </dl>
                  {x.key !== "typical" && (
                    <p className={h.homeNote}>
                      {x.differentPlan && x.typicalPickCostsMore === null
                        ? "A different cheapest plan: the typical home's pick doesn't even price its controlled load."
                        : x.differentPlan && (x.typicalPickCostsMore ?? 0) >= 1
                          ? `A different cheapest plan: the typical home's pick would cost it ${money(x.typicalPickCostsMore ?? 0)} a year more.`
                          : `Same cheapest plan as the typical home, but it saves ${money(Math.abs(x.saving - typical.saving))} a year ${x.saving < typical.saving ? "less" : "more"}.`}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            <p className={h.note}>
              The saving runs from {money(lowSave)} to {money(highSave)} a year. Estimates from our household model, prices checked {fmtDate()}, discounts for paying on time
              included. Your bill will be different again, which is why we read it. <Link href="/learn">How we price plans</Link>
            </p>
          </section>
        )}

        {/* 4. How it works */}
        <section className={h.section}>
          <h2 className={h.h2}>How it works</h2>
          <ol className={h.steps}>
            <li className={h.step}>
              <div className={h.shot}><Image src="/images/product/1-photo.png" alt="The check opens on a button to take a photo of your bill" width={390} height={780} /></div>
              <span className={h.num}>1</span>
              <h3>Take a photo of your bill</h3>
              <p>Paper, PDF or a screenshot from your retailer&apos;s app. No bill to hand? Answer a few questions about your home instead.</p>
            </li>
            <li className={h.step}>
              <div className={h.shot}><Image src="/images/product/2-read.png" alt="What we read from the bill: network, days, usage, total and rates" width={390} height={780} /></div>
              <span className={h.num}>2</span>
              <h3>Check what we read</h3>
              <p>Your network, usage, bill total and the rates you pay. Change anything that looks wrong before we work it out.</p>
            </li>
            <li className={h.step}>
              <div className={h.shot}><Image src="/images/product/3-result.png" alt="The result: the cheapest plan and the yearly saving" width={390} height={780} /></div>
              <span className={h.num}>3</span>
              <h3>See whether to switch</h3>
              <p>The cheapest plan for how you use power, what it saves in a year, and a link to the retailer. Switching is done with them, usually in about ten minutes.</p>
            </li>
          </ol>
        </section>

        {/* 5. Why keep watching */}
        <section className={h.section}>
          <h2 className={h.h2}>Prices don&apos;t stay put</h2>
          <p className={h.sub}>
            Many discounts only last the first year, retailers change prices around 1 July, and new plans appear all the time. A plan that&apos;s cheapest
            today often isn&apos;t a year later. Members are re-checked every morning and hear from us only when it matters:
          </p>
          <ul className={h.watch}>
            <li><Icon name="bell" size={20} /><span><b>A month before</b> your discount or fixed price ends</span></li>
            <li><Icon name="calendar" size={20} /><span><b>After 1 July</b>, when retailers reprice</span></li>
            <li><Icon name="refresh" size={20} /><span><b>Whenever a plan</b> beats yours by {money(WORTH_SWITCHING_PER_YEAR)} a year or more (or the amount you choose)</span></li>
          </ul>
          <p className={h.note}>
            Used Victorian Energy Compare? Good: it&apos;s the Government&apos;s site and well worth a look. It finds the best deal on the day; we
            start from your bill and keep checking. <Link href="/learn#compare">How the two fit together</Link>.
          </p>
        </section>

        {/* 6. Price */}
        <section className={h.section}>
          <div className={h.price}>
            <div>
              <h2 className={h.h2}>$39 a year to keep it watched</h2>
              <p className={h.sub}>
                The check is free. Membership covers electricity and gas: re-checked every morning, an email only when switching is worth it, and a short
                summary each month. Or $7 a month. Cancel any time.
              </p>
            </div>
            <div className={h.priceActions}>
              <Link href="/check" className={h.primary}><Icon name="camera" size={20} /> Start with the free check</Link>
              <Link href="/pricing" className={h.textLink}>What&apos;s included</Link>
            </div>
          </div>
        </section>

        {hasFounderStory && (
          <section className={h.section}>
            <div className={h.founder}>
              {ABOUT.photo && (
                <div className={h.founderPhoto}><Image src={ABOUT.photo} alt={ABOUT.founderName} width={160} height={160} /></div>
              )}
              <div>
                <h2 className={h.h2}>Why I built this</h2>
                {ABOUT.story.map((para, i) => <p key={i} className={h.story}>{para}</p>)}
                <p className={h.sign}>{ABOUT.founderName}, {ABOUT.founderRole}</p>
              </div>
            </div>
          </section>
        )}

        <section className={h.section} id="waitlist">
          <StateWaitlist />
        </section>

        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            {ABOUT.businessName || ABOUT.abn || ABOUT.location ? (
              <>
                {[ABOUT.businessName, ABOUT.abn ? `ABN ${ABOUT.abn}` : "", ABOUT.location].filter(Boolean).join(" · ")}.{" "}
              </>
            ) : null}
            Independent: not affiliated with the Victorian Government or any retailer, and we take no money from retailers. Prices come from retailers&apos;
            published data; confirm with the retailer before switching.
          </p>
          <p>
            <Link href="/pricing">Pricing</Link> · <Link href="/learn">Learn</Link> · <Link href="/gas">Gas check</Link> · <Link href="/ev">EV calculator</Link> ·{" "}
            <Link href="/faq">FAQ</Link> · <Link href="/default-offer">About the default offer</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/cancellation-policy">Cancellation</Link> · <Link href="/terms">Terms</Link>
            {ABOUT.contactEmail ? <> · <a href={`mailto:${ABOUT.contactEmail}`}>{ABOUT.contactEmail}</a></> : null}
          </p>
        </footer>
      </main>
    </>
  );
}

// Types only: the pop-up loads the offer data itself, on demand.
import type { OfferLine, OfferSummary } from "@/lib/planExtras";
import Icon from "./Icon";
import s from "./offerterms.module.css";

// An offer's discounts, sign-up requirements, credits, fees and contract
// terms, from the retailer's own price feed (lib/planExtras.ts).
//   <OfferChips>  up to three short labels for a list row
//   <OfferTerms>  the full list, for the best plan, an opened row or the pop-up

/** Nothing to report: no discounts, sign-up needs (beyond how you can pay), credits or fees. */
function offerIsPlain(o: OfferSummary): boolean {
  return o.found && !o.discounts.length && !o.needs.some((n) => n.tone === "warn" || !/^Pay by /.test(n.text)) && !o.credits.length && !o.fees.length;
}

const toneClass = (t: OfferLine["tone"]) => (t === "good" ? s.good : t === "warn" ? s.warn : s.info);

export function OfferChips({ o }: { o: OfferSummary }) {
  if (!o.chips.length) return null;
  return (
    <>
      {o.chips.map((c) => (
        <span key={c.text} className={`${s.chip} ${toneClass(c.tone)}`} title={c.tone === "good" ? "Already taken off the price shown" : c.tone === "info" ? "Not in the price shown" : undefined}>
          {c.tone === "good" ? "✓ " : c.tone === "warn" ? "! " : ""}
          {c.text}
        </span>
      ))}
      {o.moreChips > 0 && <span className={`${s.chip} ${s.more}`}>+{o.moreChips} more</span>}
    </>
  );
}

function Lines({ icon, title, note, lines }: { icon: string; title: string; note?: string; lines: OfferLine[] }) {
  if (!lines.length) return null;
  return (
    <div className={s.group}>
      <span className={s.groupTitle}>
        <Icon name={icon} size={15} /> {title}
        {note && <small>{note}</small>}
      </span>
      <ul className={s.lines}>
        {lines.map((l, i) => (
          <li key={l.text + i} className={toneClass(l.tone)}>
            <span className={s.mark} aria-hidden="true">{l.tone === "good" ? "✓" : l.tone === "warn" ? "!" : "•"}</span>
            <span>
              {l.text}
              {l.detail && <small>{l.detail}</small>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OfferTerms({
  o, retailer, payLateCost, dark, compact, title = "Discounts and what you need to sign up",
}: {
  o: OfferSummary;
  retailer: string;
  /** e.g. "$4.10 a month": the pay-on-time / direct-debit discount that's in
   *  our price, i.e. what paying late would add back. */
  payLateCost?: string | null;
  dark?: boolean;
  compact?: boolean;
  title?: string | null;
}) {
  const cls = `${s.wrap} ${dark ? s.dark : ""} ${compact ? s.compact : ""}`;
  return (
    <section className={cls} aria-label={title ?? "Offer conditions"}>
      {title && <span className={s.title}>{title}</span>}

      {o.restricted && (
        <p className={s.restricted}>
          <Icon name="id" size={16} /> <span><b>Not everyone can get this offer: {o.restricted}.</b> We still list it, but we don&apos;t pick it as your best plan.</span>
        </p>
      )}

      {!o.found ? (
        <p className={s.empty}>
          {o.loaded
            ? `${retailer}'s price feed doesn't list any discounts or sign-up conditions for this offer. Check its Energy Fact Sheet before you sign up.`
            : `Discounts and sign-up conditions arrive with our next daily price update. Until then, check the offer and its Energy Fact Sheet on ${retailer}'s site.`}
        </p>
      ) : offerIsPlain(o) ? (
        <p className={s.empty}>
          <Icon name="check" size={15} /> No discounts, sign-up credits or special conditions in {retailer}&apos;s feed for this offer. The price is the plan&apos;s standard rates.
        </p>
      ) : null}

      <Lines icon="tag" title="Discounts" lines={o.discounts} />
      {payLateCost && <p className={s.condSave}>Our price assumes you pay on time. Miss the discount and it&apos;s about <b>{payLateCost} more</b>.</p>}
      <Lines icon="id" title="To sign up you need" lines={o.needs} />
      <Lines icon="gift" title="Credits and gifts" note="not in our price" lines={o.credits} />
      {o.fees.length + o.contract.length > 0 && (
        <details className={s.fold}>
          <summary>
            {o.fees.length > 0 ? `Fees (${o.fees.length})` : "Contract"}
            {o.fees.length > 0 && o.contract.length > 0 ? " and contract terms" : ""}
            {o.fees.some((f) => f.tone === "warn") || o.contract.some((c) => c.tone === "warn") ? <span className={s.foldWarn}> · worth a look</span> : null}
          </summary>
          <Lines icon="receipt" title="Fees" note="not in our price" lines={o.fees} />
          <Lines icon="file" title="Contract" lines={o.contract} />
        </details>
      )}

      <p className={s.foot}>
        Concessions aren&apos;t counted: they depend on you, not the offer. If you hold a concession card, give it to {retailer} when you sign up.
        {o.found && " Fees are as the retailer publishes them."}
        {o.termsUrl && (
          <>
            {" "}
            <a href={o.termsUrl} target="_blank" rel="noopener noreferrer">Read {retailer}&apos;s terms ↗</a>
          </>
        )}
      </p>
    </section>
  );
}

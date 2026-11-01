import Icon from "./Icon";
import { PLUS_NAME } from "@/lib/pricingPlans";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import s from "./membergets.module.css";

/** "As a Utilo Plus member, you get…" (1 Nov 2026): three benefits, each with a little more on tap. */
export default function MemberGets() {
  const items = [
    {
      key: "instant",
      icon: "bolt" as const,
      title: "Instant answers",
      line: "Snap your bill, see your saving.",
      more: "We read your usage and the rates you actually pay from a photo, then price every plan on your network in about a minute. No forms, no account to set up first.",
    },
    {
      key: "savings",
      icon: "dollar" as const,
      title: "Savings, in dollars",
      line: "What switching saves, every morning.",
      more: `Every plan is re-priced against your own bill each day. When one would save you $${WORTH_SWITCHING_PER_YEAR}+ a year, you get one email with the plan and the saving.`,
    },
    {
      key: "control",
      icon: "check" as const,
      title: "You stay in control",
      line: "We prompt. You decide.",
      more: "A month's warning before a discount ends or a fixed price runs out. We never switch you or talk to your retailer for you, and you can cancel any time.",
    },
  ];
  return (
    <section className={s.wrap} data-motion="" data-stagger="li">
      <h2 className={s.h2}>As a {PLUS_NAME} member, you get…</h2>
      <ul className={s.list}>
        {items.map((it) => (
          <li key={it.key} className={s[it.key]}>
            <span className={s.art} aria-hidden="true"><Icon name={it.icon} size={30} /></span>
            <div className={s.text}>
              <b>{it.title}</b>
              <span>{it.line}</span>
              <details>
                <summary>Read more</summary>
                <p>{it.more}</p>
              </details>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

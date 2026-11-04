import Icon from "./Icon";
import { RECEIVES_RETAILER_FEES } from "@/lib/disclosures";
import s from "./nocalls.module.css";

/** 4 Nov 2026: "We never call · No brokers · No commissions", a small row of ticks. */
export default function NoCalls({ dark = false, center = false }: { dark?: boolean; center?: boolean }) {
  return (
    <ul className={`${s.row} ${dark ? s.dark : ""} ${center ? s.center : ""}`} aria-label="Our promise">
      <li title="No sales calls, ever. Just email, and only when it's worth it."><Icon name="check" size={15} /> <span className={s.long}>We never call</span><span className={s.short}>No calls</span></li>
      <li title="We're not a broker and never pass your details to one."><Icon name="check" size={15} /> No brokers</li>
      {!RECEIVES_RETAILER_FEES && <li title="Retailers don't pay us, so every plan is ranked by price only."><Icon name="check" size={15} /> No commissions</li>}
    </ul>
  );
}

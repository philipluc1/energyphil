"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { FoundTotals } from "@/lib/moneyFound";
import a from "../account/account.module.css";
import s from "./moneyfound.module.css";

// 5 Nov 2026: "Money we found for you". The running total that shows Utilo Plus paying for itself.
const whole = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

export default function MoneyFoundCard({ priceYear }: { priceYear?: number | null }) {
  const [t, setT] = useState<FoundTotals | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/member-settings", { headers: { authorization: `Bearer ${data.session?.access_token ?? ""}` } }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (live && body?.moneyFound) setT(body.moneyFound as FoundTotals);
    })();
    return () => { live = false; };
  }, []);
  if (!t || t.caught === 0) return null;
  const covers = priceYear && t.onOfferYear + t.back >= priceYear ? Math.floor((t.onOfferYear + t.back) / priceYear) : 0;
  return (
    <section className={a.panelCard} aria-labelledby="money-found-h">
      <h2 className={a.panelTitle} id="money-found-h">Money we found for you</h2>
      <div className={s.row}>
        <div className={s.stat}><b>{t.caught}</b><span>{t.caught === 1 ? "thing caught" : "things caught"} on your bills</span></div>
        {t.back > 0 && <div className={s.stat}><b>{whole(t.back)}</b><span>in fees and charges to ask back</span></div>}
        {t.onOfferYear > 0 && <div className={s.stat}><b>{whole(t.onOfferYear)}</b><span>a year on offer on your latest bill</span></div>}
      </div>
      <p className={a.panelText}>
        {covers >= 2 ? <>That&apos;s about <b>{covers} times</b> what Utilo Plus costs you. </> : null}
        Each one is on your Home tab with exactly what to ask for. Bills you forward are checked the same way.
      </p>
    </section>
  );
}

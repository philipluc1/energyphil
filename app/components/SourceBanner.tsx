"use client";

import { useEffect, useState } from "react";
import { parseSource, readSourceCookie, sourceFromUtm, writeSourceCookie, type Source } from "@/lib/attribution";
import { findPartner } from "@/lib/partners";
import { REFERRAL_FRIEND_CENTS, referralDollars } from "@/lib/referralOffer";
import Icon from "./Icon";
import s from "./sourcebanner.module.css";

/** Remembers an ad or campaign link (?utm_source=…) unless a partner's or a
 *  friend's link already brought this visitor. Renders nothing. */
export function SourceCapture() {
  useEffect(() => {
    try {
      const utm = sourceFromUtm(new URLSearchParams(window.location.search));
      if (!utm) return;
      const have = parseSource(readSourceCookie());
      if (have && have.kind !== "ad") return;
      writeSourceCookie(utm);
    } catch {
      /* never break the page */
    }
  }, []);
  return null;
}

/** A welcome line for visitors who came through a partner's or a friend's link. */
export default function SourceBanner() {
  const [src, setSrc] = useState<Source | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSrc(parseSource(readSourceCookie())), 0);
    return () => clearTimeout(t);
  }, []);
  if (!src) return null;

  if (src.kind === "partner") {
    const p = findPartner(src.code);
    if (!p) return null;
    return (
      <div className={s.banner} role="status">
        <span className={s.icon} aria-hidden="true"><Icon name="home" size={18} /></span>
        <span>
          <b>Welcome, {p.name} members.</b> {p.welcome ?? "The free check takes about a minute."}
        </span>
      </div>
    );
  }
  if (src.kind === "referral") {
    return (
      <div className={`${s.banner} ${s.gift}`} role="status">
        <span className={s.icon} aria-hidden="true"><Icon name="gift" size={18} /></span>
        <span>
          <b>A friend sent you.</b> The check is free, and if you join you get {referralDollars(REFERRAL_FRIEND_CENTS)} off your first payment.
        </span>
      </div>
    );
  }
  return null;
}

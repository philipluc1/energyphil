"use client";

import { useState } from "react";
import { COMPLAINTS_SOURCE, complaintBand, reviewsUrl } from "@/lib/retailerComplaints";
import s from "./complaintbadge.module.css";

const LABEL = { low: "Few complaints", average: "Average complaints", high: "More complaints" } as const;

/** "Few / Average / More complaints" from official EWOV figures, with the source behind a tap. */
export default function ComplaintBadge({ retailer }: { retailer: string }) {
  const [open, setOpen] = useState(false);
  const info = complaintBand(retailer);
  if (!info) return null;
  const per = (x: number) => x.toLocaleString("en-AU", { maximumFractionDigits: 1 });
  return (
    <span className={s.wrap}>
      <button type="button" className={`${s.badge} ${s[info.band]}`} aria-expanded={open} onClick={() => setOpen((x) => !x)}>
        <i aria-hidden="true" />{LABEL[info.band]}<span className={s.info} aria-hidden="true">i</span>
      </button>
      {open && (
        <span className={s.pop} role="note">
          {retailer}: <b>{per(info.rate)}</b> complaints to the ombudsman per 10,000 customers{COMPLAINTS_SOURCE.period ? ` in ${COMPLAINTS_SOURCE.period}` : ""}; the middle retailer had {per(info.median)}. Lower is better.{" "}
          Source: <a href={COMPLAINTS_SOURCE.url} target="_blank" rel="noopener noreferrer">{COMPLAINTS_SOURCE.short} ↗</a> ·{" "}
          <a href={reviewsUrl(retailer)} target="_blank" rel="noopener noreferrer">Read reviews ↗</a>
        </span>
      )}
    </span>
  );
}

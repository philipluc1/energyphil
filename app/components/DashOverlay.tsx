"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import s from "./insights.module.css";

/** A full page that opens over the dashboard, so members never leave it.
 *  Esc or the back button closes it; the page behind doesn't scroll. */
export default function DashOverlay({ title, lede, bar, onClose, children }: {
  title: string;
  lede?: ReactNode;
  bar?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);
  // Rendered on <body>: a parent with a transform (the phone tabs) would
  // otherwise trap a fixed overlay inside it.
  return createPortal(
    <div className={s.ovl} role="dialog" aria-modal="true" aria-label={title}>
      <div className={s.ovlBar}>
        <button type="button" className={s.ovlBack} onClick={onClose}>← Back to my dashboard</button>
        {bar && <span className={s.ovlNote}>{bar}</span>}
      </div>
      <div className={s.ovlBody}>
        <h2 className={s.ovlTitle}>{title}</h2>
        {lede && <p className={s.ovlLede}>{lede}</p>}
        {children}
        <button type="button" className={`${s.ovlBack} ${s.ovlBackBottom}`} onClick={onClose}>← Back to my dashboard</button>
      </div>
    </div>,
    document.body,
  );
}

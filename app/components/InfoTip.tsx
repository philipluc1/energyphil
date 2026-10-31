"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import s from "./infotip.module.css";

/**
 * A small "i" button that opens a short pop-up next to it. For the detail
 * that used to sit on the page as a paragraph: the page stays short, and the
 * answer is one tap away. Closes on a second tap, a tap outside, or Escape.
 *
 * `label` is what a screen reader hears ("About this saving"). Pass `text`
 * to show a word instead of the "i" (e.g. "How we worked it out").
 */
export default function InfoTip({
  label = "More information",
  text,
  children,
  tone = "light",
}: {
  label?: string;
  text?: ReactNode;
  children: ReactNode;
  /** "dark" for use on a navy or coloured card. */
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const wrap = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Keep the pop-up on screen: nudge it sideways if it would run off an edge.
  useLayoutEffect(() => {
    if (!open || !pop.current) return;
    const r = pop.current.getBoundingClientRect();
    const pad = 12;
    let dx = 0;
    if (r.left < pad) dx = pad - r.left;
    else if (r.right > window.innerWidth - pad) dx = window.innerWidth - pad - r.right;
    if (dx !== 0) setShift((x) => x + dx);
  }, [open]);

  return (
    <span ref={wrap} className={`${s.wrap} ${tone === "dark" ? s.dark : ""}`}>
      <button
        type="button"
        className={text ? s.textBtn : s.btn}
        aria-label={text ? undefined : label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => { setShift(0); setOpen((o) => !o); }}
      >
        {text ?? <span aria-hidden="true">i</span>}
      </button>
      {open && (
        <span id={id} ref={pop} role="note" className={s.pop} style={{ marginLeft: shift }}>
          {children}
        </span>
      )}
    </span>
  );
}

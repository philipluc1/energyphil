"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { PLUS_NAME } from "@/lib/pricingPlans";
import s from "./dashheader.module.css";
import Wordmark from "./Wordmark";

/**
 * The dashboard's own header (29 Oct 2026). No site nav, so members stay in
 * their dashboard; the logo goes to the home page (1 Nov 2026). Log out, billing,
 * policies and the public site sit in a small account menu, out of the way.
 */
export default function DashHeader({
  email,
  name,
  isMember,
  onPlan,
  onLogout,
  onHome,
}: {
  email: string;
  name: string;
  isMember: boolean;
  /** Open the plan-and-billing tab. */
  onPlan: () => void;
  /** Opens the Home tab: the bills in plain English (8 Nov 2026). */
  onHome?: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <header className={s.top}>
      <div className={s.bar}>
        <Link href="/" className={s.brand} aria-label="Utilo home page">
          <span className={s.logo}><Wordmark /></span>
        </Link>
        <div className={s.right}>
          {isMember ? (
            <span className={s.plus}><Icon name="bolt" size={13} /> {PLUS_NAME}</span>
          ) : (
            <button type="button" className={s.upgrade} onClick={onPlan}>Get {PLUS_NAME}</button>
          )}
          <div className={s.menuWrap} ref={box}>
            <button type="button" className={s.avatar} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
              {initial}
            </button>
            {open && (
              <div className={s.menu} role="menu">
                <div className={s.who}>
                  <b>{name || "Your account"}</b>
                  <span>{email}</span>
                </div>
                {onHome && <button type="button" role="menuitem" onClick={() => { setOpen(false); onHome(); }}><Icon name="home" size={16} /> My home</button>}
                <button type="button" role="menuitem" onClick={() => { setOpen(false); onPlan(); }}><Icon name="receipt" size={16} /> My plan</button>
                <Link role="menuitem" href="/market" target="_blank"><Icon name="chart" size={16} /> Market live</Link>
                <Link role="menuitem" href="/learn" target="_blank"><Icon name="bulb" size={16} /> Learn</Link>
                <Link role="menuitem" href="/faq" target="_blank"><Icon name="search" size={16} /> Help and FAQ</Link>
                <div className={s.small}>
                  <Link href="/privacy" target="_blank">Privacy</Link> · <Link href="/terms" target="_blank">Terms</Link> · <Link href="/" target="_blank">utilo.com.au</Link>
                </div>
                <button type="button" role="menuitem" className={s.logout} onClick={() => { setOpen(false); onLogout(); }}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

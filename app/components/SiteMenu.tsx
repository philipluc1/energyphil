"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AccountNavLink from "./AccountNavLink";
import s from "./sitemenu.module.css";

// The three-line menu on phones and small tablets (4 Nov 2026, Phil: "too cluttered").
// The header keeps the logo and Free check; everything else lives in here.
const LINKS: { href: string; label: string; key: string; note?: string }[] = [
  { href: "/check", label: "Check my power bill", key: "check" },
  { href: "/gas", label: "Check my gas bill", key: "gas" },
  { href: "/pricing", label: "Utilo Plus", key: "pricing", note: "Plus" },
  { href: "/learn", label: "How it works", key: "learn" },
  { href: "/faq", label: "Questions", key: "faq" },
  { href: "/market", label: "Market changes", key: "market" },
  { href: "/business", label: "Business", key: "business", note: "Soon" },
];

export default function SiteMenu({ active }: { active: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const [lastPath, setLastPath] = useState(path);
  // Close when the page changes (a link in the menu was followed).
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  return (
    <div className={s.wrap} ref={wrap}>
      <button type="button" className={s.burger} aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((x) => !x)}>
        <span className={open ? s.barsOpen : s.bars} aria-hidden="true"><i /><i /><i /></span>
      </button>
      {open && (
        <nav id="site-menu" className={s.panel} aria-label="Menu">
          <ul className={s.list}>
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={active === l.key ? s.itemOn : s.item} onClick={() => setOpen(false)}>
                  <span>{l.label}</span>
                  {l.note === "Plus" ? <span className={s.plusTag}>Plus</span> : l.note ? <span className={s.soon}>{l.note}</span> : <span className={s.chev} aria-hidden="true">›</span>}
                </Link>
              </li>
            ))}
          </ul>
          <div className={s.foot}>
            <AccountNavLink className={s.login} />
            <Link href="/check" className={s.cta} onClick={() => setOpen(false)}>Free check <span aria-hidden="true">→</span></Link>
          </div>
        </nav>
      )}
    </div>
  );
}

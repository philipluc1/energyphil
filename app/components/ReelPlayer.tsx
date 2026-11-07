"use client";

import { useEffect, useRef, useState } from "react";
import type { Reel } from "@/lib/reels";
import { LOGO_CLIP } from "@/lib/reels";
import styles from "./reelplayer.module.css";

/**
 * A vertical (9:16) reel that plays muted while it's on screen and pauses off
 * screen; a tap turns the sound on. If the reel file isn't on the site yet it
 * falls back to the animated logo, or (with fallback "none") reports it so the
 * caller can show "Coming soon".
 */
export default function ReelPlayer({ reel, fallback = "logo", onUnavailable, className }: { reel: Reel; fallback?: "logo" | "none"; onUnavailable?: () => void; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [fellBack, setFellBack] = useState(false);
  const [sound, setSound] = useState(false);
  const [dead, setDead] = useState(false);
  const cur: Reel = fellBack ? LOGO_CLIP : reel;

  useEffect(() => {
    const v = ref.current;
    if (!v || dead) return;
    const fail = () => {
      if (!fellBack && fallback === "logo") setFellBack(true);
      else { setDead(true); onUnavailable?.(); }
    };
    // The file may have failed before React attached its handlers (a 404 can
    // land during hydration), so check the element itself as well.
    if (v.error || v.networkState === 3) { fail(); return; }
    v.addEventListener("error", fail);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !reduce) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.4 });
    io.observe(v);
    return () => { io.disconnect(); v.removeEventListener("error", fail); };
  }, [cur, dead, fellBack, fallback, onUnavailable]);

  if (dead) return null;
  return (
    <button type="button" className={`${styles.wrap} ${className ?? ""}`} onClick={() => { setSound((s) => !s); ref.current?.play().catch(() => {}); }} aria-label={sound ? `Mute: ${cur.title}` : `Play with sound: ${cur.title}`}>
      <video key={cur.src} ref={ref} src={cur.src} poster={cur.poster} muted={!sound} loop playsInline preload="metadata" />
      <span className={styles.sound} aria-hidden="true">{sound ? "🔊" : "🔇"}</span>
      <span className={styles.len} aria-hidden="true">{cur.length}</span>
    </button>
  );
}

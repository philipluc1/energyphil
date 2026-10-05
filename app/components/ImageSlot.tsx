"use client";

import { useState, type ReactNode } from "react";
import styles from "./imageslot.module.css";

/**
 * A reserved place for a photo. Drop a file at `public/images/<name>` and it
 * appears; until then (or if it fails to load) visitors see a tidy gradient
 * panel with an icon, never a broken-image box. See public/images/README.md.
 */
export default function ImageSlot({
  src,
  alt,
  ratio = "4 / 3",
  icon,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  ratio?: string;
  icon?: ReactNode;
  className?: string;
  priority?: boolean;
}) {
  // The fallback panel is always underneath; the photo only fades in once it
  // has genuinely loaded, so a missing file never shows a broken-image icon
  // (even if the error fires before the page hydrates).
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`${styles.slot} ${className}`} style={{ aspectRatio: ratio }}>
      <div className={styles.fallback} role={loaded ? undefined : "img"} aria-label={loaded ? undefined : alt}>
        <span className={styles.icon}>{icon}</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={(el) => {
          if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
        }}
        src={src}
        alt={loaded ? alt : ""}
        loading={priority ? "eager" : "lazy"}
        className={`${styles.img} ${loaded ? styles.imgLoaded : ""}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

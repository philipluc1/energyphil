"use client";

import { useState } from "react";
import type { LearnVideo } from "@/lib/learnContent";
import styles from "./videoslot.module.css";

/** A video card. With a YouTube id it loads the player only after a click
 * (so nothing from YouTube loads until the visitor asks for it). Without an id
 * it shows a "coming soon" tile. */
export default function VideoSlot({ video }: { video: LearnVideo }) {
  const [playing, setPlaying] = useState(false);
  const ready = Boolean(video.youtubeId);
  return (
    <div className={styles.card}>
      <div className={styles.frame}>
        {playing && video.youtubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className={styles.poster}
            onClick={() => ready && setPlaying(true)}
            disabled={!ready}
            aria-label={ready ? `Play: ${video.title}` : `${video.title} (coming soon)`}
          >
            <span className={styles.play} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <span className={styles.len}>{video.length}</span>
            {!ready && <span className={styles.soon}>Coming soon</span>}
          </button>
        )}
      </div>
      <div className={styles.body}>
        <h3>{video.title}</h3>
        <p>{video.blurb}</p>
      </div>
    </div>
  );
}

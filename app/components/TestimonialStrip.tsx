"use client";

import { useRef } from "react";
import type { Testimonial } from "@/lib/testimonials";
import s from "./testimonials.module.css";

const when = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { month: "short", year: "numeric" }) : null);

/** Swipe on a phone; arrows on a computer. */
export default function TestimonialStrip({ list }: { list: Testimonial[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const go = (dir: number) => {
    const el = ref.current; if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.9, 640), behavior: "smooth" });
  };
  return (
    <div className={s.strip}>
      <ul ref={ref} className={s.track}>
        {list.map((t) => (
          <li key={t.id} className={s.card}>
            <span className={s.cardStars} aria-label={`${t.stars} out of 5 stars`}>{"★".repeat(t.stars)}<span className={s.off}>{"★".repeat(5 - t.stars)}</span></span>
            <p className={s.body}>&ldquo;{t.body}&rdquo;</p>
            <span className={s.who}><b>{t.name}</b>{t.place ? `, ${t.place}` : ""}<span className={s.src}> · {t.source}{when(t.review_date) ? ` · ${when(t.review_date)}` : ""}</span></span>
          </li>
        ))}
      </ul>
      {list.length > 2 && (
        <div className={s.arrows}>
          <button type="button" onClick={() => go(-1)} aria-label="Previous reviews">←</button>
          <button type="button" onClick={() => go(1)} aria-label="More reviews">→</button>
        </div>
      )}
    </div>
  );
}

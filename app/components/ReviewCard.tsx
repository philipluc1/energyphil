"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { reviewUrl } from "@/lib/reviews";
import s from "./reviewcard.module.css";

const HIDE_KEY = "utilo.review.hidden";

/** "How did we do?" on the Savings tab once a member has switched (2 Nov 2026). Same for everyone; nothing offered for it. */
export default function ReviewCard({ switched }: { switched: boolean }) {
  const [state, setState] = useState<{ id: string } | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!switched || !supabase || !reviewUrl()) return;
    let stop = false;
    (async () => {
      try { if (window.localStorage.getItem(HIDE_KEY)) return; } catch { /* no storage: show it */ }
      const { data, error } = await supabase!.from("subscribers").select("id, review_clicked_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const row = data as { id: string; review_clicked_at: string | null } | null;
      if (!stop && !error && row && !row.review_clicked_at) setState({ id: row.id });
    })();
    return () => { stop = true; };
  }, [switched]);
  if (!state || hidden) return null;
  const hide = () => {
    setHidden(true);
    try { window.localStorage.setItem(HIDE_KEY, "1"); } catch { /* fine */ }
  };
  return (
    <section className={s.card} aria-labelledby="review-card-title">
      <div className={s.stars} aria-hidden="true">★★★★★</div>
      <div className={s.body}>
        <h3 id="review-card-title">How did we do?</h3>
        <p>You switched with Utilo. A Google review, good or bad, helps other Victorians decide and tells us what to fix. About a minute.</p>
        <div className={s.actions}>
          <a className={s.go} href={`/api/review?src=dashboard&id=${state.id}`} target="_blank" rel="noopener" onClick={() => window.setTimeout(hide, 500)}>Leave a Google review</a>
          <button type="button" className={s.later} onClick={hide}>Not now</button>
        </div>
      </div>
    </section>
  );
}

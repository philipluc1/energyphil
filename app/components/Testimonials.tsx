import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { averageStars, type Testimonial } from "@/lib/testimonials";
import { reviewUrl } from "@/lib/reviews";
import TestimonialStrip from "./TestimonialStrip";
import s from "./testimonials.module.css";

/**
 * Reviews on the home page (12 Nov 2026, Phil): a small carousel of real
 * reviews the owner adds on the dashboard. With none yet, one quiet line
 * instead (never made-up examples).
 */
export default async function Testimonials() {
  let list: Testimonial[] = [];
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from("testimonials").select("id, name, place, stars, body, source, review_date").eq("shown", true).order("created_at", { ascending: false }).limit(24);
    if (!error) list = (data ?? []) as Testimonial[];
  }
  const avg = averageStars(list);
  const canReview = !!reviewUrl();
  return (
    <section className={s.wrap} aria-labelledby="reviews-h" data-motion="">
      <div className={s.head}>
        <h2 id="reviews-h" className={s.h2}>What members say</h2>
        {avg !== null ? (
          <span className={s.summary}>
            <span className={s.stars} aria-hidden="true">{"★".repeat(Math.round(avg))}</span>
            <b>{avg.toFixed(1)}</b> from {list.length} review{list.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {list.length ? (
        <TestimonialStrip list={list} />
      ) : (
        <p className={s.empty}>We&apos;re new, so reviews from our first members will show here. Every one is real, and we never pay or reward anyone for one.</p>
      )}
      {canReview && <p className={s.leave}>A member? <a href="/api/review?src=home" rel="nofollow">Tell us how we did on Google →</a></p>}
    </section>
  );
}

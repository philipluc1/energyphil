import { LOGO, HOUSE_PATH, BOLT_PATH } from "./HouseMark";
import s from "./wordmark.module.css";

// The Utilo logo, Option H2 with the orange o (6 Nov 2026), the same as the animated logo video:
// the house with an amber bolt, a rounded "util", and an amber "o" with a white bolt.
// Navy on light backgrounds, white on navy. `animate`: plays once per visit, in the header only
// (see the script in app/layout.tsx), and never for people who've asked for less motion.
export default function Wordmark({ ink = LOGO.navy, className, animate = false }: { ink?: string; className?: string; animate?: boolean }) {
  return (
    <svg viewBox="130 330 1432 400" className={`${s.logo} ${animate ? s.anim : ""} ${className ?? ""}`} role="img" aria-label="Utilo" focusable="false">
      <g className={s.house}>
        <g transform="translate(284 565) scale(3.67) translate(-50 -50)">
          <path d={HOUSE_PATH} fill={ink} stroke={ink} strokeWidth={9} strokeLinejoin="round" />
          <path d={BOLT_PATH} fill={LOGO.amber} />
        </g>
      </g>
      <g fill="none" stroke={ink} strokeWidth={88} strokeLinecap="round" strokeLinejoin="round">
        <path className={`${s.letter} ${s.l1}`} d="M520 466 L520 574 A90 90 0 0 0 700 574 L700 466" />
        <g className={`${s.letter} ${s.l2}`}>
          <path d="M864 390 L864 610 Q864 664 929 664" />
          <path d="M810 500 L928 500" />
        </g>
        <path className={`${s.letter} ${s.l3}`} d="M1062 520 L1062 664" />
        <path className={`${s.letter} ${s.l4}`} d="M1192 446 L1192 620 Q1192 664 1234 664" />
      </g>
      <circle className={`${s.letter} ${s.l3}`} cx="1062" cy="408" r="48" fill={ink} />
      <g className={s.o}>
        <circle cx="1418" cy="590" r="124" fill={LOGO.amber} />
        <path transform="translate(1418 590) scale(6.4) translate(-50 -63.5)" d={BOLT_PATH} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={0.8} strokeLinejoin="round" />
      </g>
      {animate && (
        <g className={s.rays} stroke={LOGO.amber} strokeWidth={26} strokeLinecap="round">
          <path d="M1418 412 L1418 372" />
          <path d="M1544 464 L1572 436" />
          <path d="M1292 464 L1264 436" />
          <path d="M1544 716 L1572 744" />
          <path d="M1292 716 L1264 744" />
        </g>
      )}
    </svg>
  );
}

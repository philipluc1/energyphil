// The Utilo mark, Option F (4 Nov 2026): a solid house with an amber bolt for a window.
// Navy house on light backgrounds; white house on navy.
export const LOGO = { navy: "#1E2A4A", amber: "#F5A623" };
export const HOUSE_PATH = "M50,15 L18,42 L18,85 L82,85 L82,42 Z";
export const BOLT_PATH = "M51.2,51.5 L43,63.5 L48.3,63.5 L45.9,75.5 L57,60.2 L50.6,60.2 Z";

export default function HouseMark({ house = LOGO.navy, bolt = LOGO.amber, className }: { house?: string; bolt?: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <path d={HOUSE_PATH} fill={house} stroke={house} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
      <path d={BOLT_PATH} fill={bolt} />
    </svg>
  );
}

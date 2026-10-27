import { RETAILER_LOGO_FILES } from "@/lib/retailerLogos.generated";
import s from "./retailerlogo.module.css";

// A retailer's logo where we have the file (public/images/retailers/<slug>.png
// or .svg), otherwise a coloured badge with their initials.

const COLOURS = ["#2d3f9e", "#0d9488", "#e11d48", "#7c3aed", "#0369a1", "#b91c1c", "#15803d", "#0891b2", "#be185d", "#4338ca"];

export function retailerSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function retailerColour(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLOURS[h % COLOURS.length];
}
export function hasRetailerLogo(name: string | null | undefined): boolean {
  return !!name && !!RETAILER_LOGO_FILES[retailerSlug(name)];
}

/**
 * The tile is `size` tall and, unless `square` is asked for (the price-line
 * bubbles), 2.2x as wide: the same pill for every retailer, with the logo
 * centred in it, so wide wordmarks and round marks line up in a list.
 */
export default function RetailerLogo({ name, size = 48, radius, square = false }: { name: string | null; size?: number; radius?: number; square?: boolean }) {
  const logo = name ? RETAILER_LOGO_FILES[retailerSlug(name)] : undefined;
  const style = { width: size, height: size, borderRadius: radius ?? Math.round(size * 0.29), fontSize: Math.round(size * 0.34) };
  if (logo) {
    // Every tile is the same shape (a 2.2:1 pill, or a square in the chart
    // bubbles), with the logo centred inside, so a row of retailers lines up.
    const pad = square ? 2 : Math.max(4, Math.round(size * 0.12));
    const width = square ? size : Math.round(size * 2.2);
    return (
      <span className={s.logo} style={{ ...style, width, padding: pad }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logos, no optimisation needed */}
        <img src={logo.file} alt={`${name} logo`} />
      </span>
    );
  }
  const initials = (name ?? "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  // Same pill as the logo tiles, so a list stays aligned when a few retailers have no logo yet.
  return (
    <span className={s.badge} style={{ ...style, width: square ? size : Math.round(size * 2.2), background: name ? retailerColour(name) : "var(--navy, #22306e)" }} aria-hidden="true">
      {initials}
    </span>
  );
}

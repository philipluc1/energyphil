import { RETAILER_LOGO_FILES } from "@/lib/retailerLogos.generated";
import s from "./retailerlogo.module.css";

// A retailer's logo where we have the file (public/images/retailers/<slug>.png
// or .svg), otherwise a coloured badge with their initials.

const COLOURS = ["#2d3f9e", "#0d9488", "#c2410c", "#7c3aed", "#0369a1", "#b91c1c", "#15803d", "#a16207", "#be185d", "#4338ca"];

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

export default function RetailerLogo({ name, size = 48, radius }: { name: string | null; size?: number; radius?: number }) {
  const file = name ? RETAILER_LOGO_FILES[retailerSlug(name)] : undefined;
  const style = { width: size, height: size, borderRadius: radius ?? Math.round(size * 0.29), fontSize: Math.round(size * 0.34) };
  if (file) {
    return (
      <span className={s.logo} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logos, no optimisation needed */}
        <img src={file} alt={`${name} logo`} />
      </span>
    );
  }
  const initials = (name ?? "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={s.badge} style={{ ...style, background: name ? retailerColour(name) : "var(--navy, #22306e)" }} aria-hidden="true">
      {initials}
    </span>
  );
}

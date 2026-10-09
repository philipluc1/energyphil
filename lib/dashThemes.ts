// Colour themes for the member dashboard. One place to change the look:
// each theme sets CSS variables on the dashboard (light and dark versions)
// plus the chart colours, which Recharts needs as plain values.
//
// Preview any theme with /account?theme=slate (or brand, mint). The live
// default is DEFAULT_DASH_THEME below.

export type DashThemeId = "brand" | "slate" | "mint";
export const DEFAULT_DASH_THEME: DashThemeId = "brand";

export interface ResultsChartPalette { reference: string; referenceGood: string; referenceBad: string; plan: string; cheapest: string; text: string }
export interface SavingsChartPalette { bar: string; partial: string; text: string; axis: string }

interface Mode {
  vars: Record<string, string>;
  pageBg: string;
  chart: ResultsChartPalette;
  savings: SavingsChartPalette;
}
export interface DashTheme { label: string; blurb: string; light: Mode; dark: Mode }

const glow = (rgba: string) => `radial-gradient(600px 300px at 100% 0%, ${rgba}, transparent 60%)`;

/** Verdict colours shared by every theme: green = fine, amber = could pay less, red = clearly overpriced. */
const VERDICT = {
  "--v-good": `${glow("rgba(110,231,183,0.30)")}, linear-gradient(135deg, #0b4f3a, #13795b)`,
  "--v-mild": `${glow("rgba(253,224,140,0.32)")}, linear-gradient(135deg, #8a4b08, #c77d12)`,
  "--v-severe": `${glow("rgba(255,170,150,0.30)")}, linear-gradient(135deg, #7a1616, #c0392b)`,
  "--pill-good-bg": "#c9f2df", "--pill-good-fg": "#064e3b",
  "--pill-mild-bg": "#fde7b0", "--pill-mild-fg": "#6b3a06",
  "--pill-severe-bg": "#fdd5cf", "--pill-severe-fg": "#7a1616",
  "--amount-good": "#bbf7d0",
  "--accent-good": "#15803d", "--accent-mild": "#c77d12", "--accent-severe": "#c0392b",
};

const DARK_BASE = {
  "--bg": "#0f1219", "--surface": "#171b25", "--card": "#171b25", "--border": "#2a3142", "--track": "#232a39",
  "--grey": "#a3acbd", "--grey-soft": "#7d869a", "--good": "#4ade80", "--good-bg": "rgba(74,222,128,0.12)", "--warn": "#f87171",
  "--row-best": "rgba(74,222,128,0.08)", "--row-mine": "rgba(148,163,184,0.08)", "--soft": "rgba(148,163,184,0.10)",
  "--fixed-bg": "rgba(251,191,36,0.15)", "--fixed-fg": "#fbbf24", "--accent-good": "#4ade80", "--accent-mild": "#fbbf24", "--accent-severe": "#f87171",
};

export const DASH_THEMES: Record<DashThemeId, DashTheme> = {
  // Matches the site header: navy and amber on a clean cool white.
  brand: {
    label: "Utilo navy",
    blurb: "Navy and amber like the site header, on clean cool white.",
    light: {
      vars: {
        ...VERDICT,
        "--bg": "#f4f6fb", "--surface": "#ffffff", "--card": "#ffffff", "--border": "#e1e6f0", "--track": "#e8ecf4",
        "--grey": "#5f6b82", "--grey-soft": "#8a93a6", "--navy": "#22306e", "--navy-deep": "#0a0f28", "--navy-accent-text": "#2d3f9e",
        "--good": "#15803d", "--good-bg": "#e7f6ec", "--warn": "#c2410c",
        "--v-est": `${glow("rgba(14,165,160,0.40)")}, linear-gradient(135deg, #1b2a6b, #2c4a9a)`,
        "--amount": "#ffd166", "--go-bg": "#ffc845", "--go-fg": "#1c1403", "--side-best": "#ffd166", "--on-fg": "#22306e",
        "--row-best": "rgba(22,163,74,0.07)", "--row-mine": "rgba(34,48,110,0.06)", "--tag-best": "#16a34a", "--tag-mine": "#22306e",
        "--soft": "rgba(34,48,110,0.06)", "--fixed-bg": "rgba(245,166,35,0.16)", "--fixed-fg": "#9a5b00",
        "--btn-bg": "#f5a623", "--btn-fg": "#1c1403", "--member-bg": "linear-gradient(135deg, #ffd166, #f5a623)", "--member-fg": "#1c1403",
      },
      pageBg: "radial-gradient(1100px 560px at 8% -8%, rgba(34,48,110,0.07), transparent 60%), radial-gradient(900px 520px at 100% 0%, rgba(14,165,160,0.05), transparent 60%), #f4f6fb",
      chart: { reference: "#9aa3b5", referenceGood: "#16a34a", referenceBad: "#dc2626", plan: "#2b3a67", cheapest: "#f5a623", text: "#12141c" },
      savings: { bar: "#f5a623", partial: "#fbd38d", text: "#12141c", axis: "#e1e6f0" },
    },
    dark: {
      vars: {
        ...VERDICT, ...DARK_BASE, "--navy": "#4a62c4", "--navy-deep": "#080c1c", "--navy-accent-text": "#9db2ff",
        "--v-est": `${glow("rgba(14,165,160,0.35)")}, linear-gradient(135deg, #18245c, #2a4590)`,
        "--amount": "#ffd166", "--go-bg": "#ffc845", "--go-fg": "#1c1403", "--side-best": "#ffd166", "--on-fg": "#22306e",
        "--tag-best": "#16a34a", "--tag-mine": "#4a62c4", "--btn-bg": "#f5a623", "--btn-fg": "#1c1403",
        "--member-bg": "linear-gradient(135deg, #ffd166, #f5a623)", "--member-fg": "#1c1403",
      },
      pageBg: "#0f1219",
      chart: { reference: "#7b849c", referenceGood: "#22c55e", referenceBad: "#ef4444", plan: "#3a5384", cheapest: "#f5a623", text: "#eceff7" },
      savings: { bar: "#f5a623", partial: "#8a6a1e", text: "#eceff7", axis: "#2a3142" },
    },
  },

  // Apple-like: near-white, graphite and one blue accent. Colour only where it means something.
  slate: {
    label: "Graphite",
    blurb: "Minimal greys with one blue accent. Colour only for the verdict.",
    light: {
      vars: {
        ...VERDICT,
        "--bg": "#f5f5f7", "--surface": "#ffffff", "--card": "#ffffff", "--border": "#e3e3e8", "--track": "#ececf0",
        "--grey": "#6e6e73", "--grey-soft": "#98989d", "--navy": "#1d1d1f", "--navy-deep": "#000000", "--navy-accent-text": "#0a66c2",
        "--good": "#1f8f4e", "--good-bg": "#e8f5ed", "--warn": "#c4321f",
        "--v-est": `${glow("rgba(10,132,255,0.30)")}, linear-gradient(135deg, #1d1d1f, #3a3a3c)`,
        "--amount": "#64b5ff", "--go-bg": "#0a84ff", "--go-fg": "#ffffff", "--side-best": "#64b5ff", "--on-fg": "#1d1d1f",
        "--row-best": "rgba(31,143,78,0.07)", "--row-mine": "rgba(10,132,255,0.06)", "--tag-best": "#1f8f4e", "--tag-mine": "#0a66c2",
        "--soft": "rgba(0,0,0,0.04)", "--fixed-bg": "rgba(10,132,255,0.12)", "--fixed-fg": "#0a58ad",
        "--btn-bg": "#0a84ff", "--btn-fg": "#ffffff", "--member-bg": "#1d1d1f", "--member-fg": "#ffffff",
      },
      pageBg: "#f5f5f7",
      chart: { reference: "#aeaeb2", referenceGood: "#1f8f4e", referenceBad: "#d93025", plan: "#48484a", cheapest: "#0a84ff", text: "#1d1d1f" },
      savings: { bar: "#0a84ff", partial: "#a8d1ff", text: "#1d1d1f", axis: "#e3e3e8" },
    },
    dark: {
      vars: {
        ...VERDICT, ...DARK_BASE, "--bg": "#000000", "--surface": "#1c1c1e", "--card": "#1c1c1e", "--border": "#2c2c2e",
        "--navy": "#f5f5f7", "--navy-deep": "#000000", "--navy-accent-text": "#64b5ff",
        "--v-est": `${glow("rgba(10,132,255,0.30)")}, linear-gradient(135deg, #2c2c2e, #48484a)`,
        "--amount": "#64b5ff", "--go-bg": "#0a84ff", "--go-fg": "#ffffff", "--side-best": "#64b5ff", "--on-fg": "#1d1d1f",
        "--tag-best": "#1f8f4e", "--tag-mine": "#0a84ff", "--btn-bg": "#0a84ff", "--btn-fg": "#ffffff",
        "--member-bg": "#f5f5f7", "--member-fg": "#1d1d1f", "--tab-fg": "#1d1d1f",
      },
      pageBg: "#000000",
      chart: { reference: "#8e8e93", referenceGood: "#30d158", referenceBad: "#ff453a", plan: "#636366", cheapest: "#0a84ff", text: "#f5f5f7" },
      savings: { bar: "#0a84ff", partial: "#1f4f80", text: "#f5f5f7", axis: "#2c2c2e" },
    },
  },

  // Fresh and friendly: soft mint background, deep teal accent.
  mint: {
    label: "Fresh teal",
    blurb: "Soft mint background, deep teal accent, friendly and light.",
    light: {
      vars: {
        ...VERDICT,
        "--bg": "#f0f7f5", "--surface": "#ffffff", "--card": "#ffffff", "--border": "#d6e9e3", "--track": "#e2f0ec",
        "--grey": "#55706a", "--grey-soft": "#86a19a", "--navy": "#0f5f59", "--navy-deep": "#073b37", "--navy-accent-text": "#0f766e",
        "--good": "#15803d", "--good-bg": "#e3f6ea", "--warn": "#c2410c",
        "--v-est": `${glow("rgba(94,234,212,0.32)")}, linear-gradient(135deg, #0f4c5c, #0f766e)`,
        "--amount": "#fde68a", "--go-bg": "#fbbf24", "--go-fg": "#1c1403", "--side-best": "#fde68a", "--on-fg": "#0f5f59",
        "--row-best": "rgba(16,185,129,0.08)", "--row-mine": "rgba(15,118,110,0.06)", "--tag-best": "#059669", "--tag-mine": "#0f5f59",
        "--soft": "rgba(15,118,110,0.06)", "--fixed-bg": "rgba(251,191,36,0.18)", "--fixed-fg": "#92400e",
        "--btn-bg": "#0f766e", "--btn-fg": "#ffffff", "--member-bg": "linear-gradient(135deg, #5eead4, #14b8a6)", "--member-fg": "#042f2c",
      },
      pageBg: "radial-gradient(1000px 520px at 0% -10%, rgba(94,234,212,0.18), transparent 60%), radial-gradient(800px 500px at 100% 0%, rgba(251,191,36,0.07), transparent 60%), #f0f7f5",
      chart: { reference: "#9db5af", referenceGood: "#10b981", referenceBad: "#dc2626", plan: "#2f6f68", cheapest: "#f59e0b", text: "#10201d" },
      savings: { bar: "#0f766e", partial: "#99d5cd", text: "#10201d", axis: "#d6e9e3" },
    },
    dark: {
      vars: {
        ...VERDICT, ...DARK_BASE, "--bg": "#0b1514", "--surface": "#12201e", "--card": "#12201e", "--border": "#20332f",
        "--navy": "#2dd4bf", "--navy-deep": "#073b37", "--navy-accent-text": "#5eead4",
        "--v-est": `${glow("rgba(94,234,212,0.28)")}, linear-gradient(135deg, #0c3d4a, #0f5f59)`,
        "--amount": "#fde68a", "--go-bg": "#fbbf24", "--go-fg": "#1c1403", "--side-best": "#fde68a", "--on-fg": "#0f5f59",
        "--tag-best": "#059669", "--tag-mine": "#14b8a6", "--btn-bg": "#14b8a6", "--btn-fg": "#042f2c", "--tab-fg": "#042f2c",
        "--member-bg": "linear-gradient(135deg, #5eead4, #14b8a6)", "--member-fg": "#042f2c",
      },
      pageBg: "#0b1514",
      chart: { reference: "#6f8a84", referenceGood: "#34d399", referenceBad: "#f87171", plan: "#2f6f68", cheapest: "#fbbf24", text: "#e6f2ef" },
      savings: { bar: "#2dd4bf", partial: "#1d5f57", text: "#e6f2ef", axis: "#20332f" },
    },
  },
};

export function isDashTheme(v: string | null | undefined): v is DashThemeId {
  return v === "brand" || v === "slate" || v === "mint";
}

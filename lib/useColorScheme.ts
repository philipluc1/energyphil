"use client";

/**
 * The site is light-only (Oct 2026: clean light theme). Kept as a hook so
 * chart components that ask "light or dark?" keep working unchanged, and so
 * a dark theme can come back in one place if it's ever wanted.
 */
export function useColorScheme(): "light" | "dark" {
  return "light";
}

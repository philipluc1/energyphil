"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): "light" | "dark" {
  return window.matchMedia(QUERY).matches ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

/**
 * Tracks the OS/browser light-dark preference reactively. Chart libraries
 * need real color values (not CSS custom properties), so components that
 * color a chart to match the page's dark mode read this instead of relying
 * on globals.css's `prefers-color-scheme` media query.
 */
export function useColorScheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

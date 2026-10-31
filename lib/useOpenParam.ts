"use client";

import { useEffect } from "react";

/**
 * Links from the monthly email (/account?open=year#home and so on) open one of
 * the dashboard's full pages straight away. Each card listens for its own
 * name; the parameter is then removed so a refresh doesn't re-open it.
 */
export function useOpenParam(name: string, open: () => void, ready = true): void {
  useEffect(() => {
    if (!ready) return;
    const wanted = () => {
      try { return new URL(window.location.href).searchParams.get("open") === name; } catch { return false; }
    };
    if (!wanted()) return;
    // Wait until the dashboard has settled (cards can mount twice while it
    // loads), and only clear the link when this card actually opens, so a card
    // that unmounts first doesn't swallow it.
    const t = setTimeout(() => {
      if (!wanted()) return;
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("open");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      } catch {
        /* ignore */
      }
      open();
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ready]);
}

/** The names the email links use. */
export const OPEN_TARGETS = ["year", "midday", "market", "rewards"] as const;

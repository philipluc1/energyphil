"use client";

import { useEffect, useState } from "react";
import { weatherLabel, type TodayWeather } from "./weather";

const MELBOURNE = { lat: -37.81, lon: 144.96, name: "Melbourne" };

/**
 * Today's weather for a Victorian suburb, from Open-Meteo (2 Nov 2026). The
 * browser sends Open-Meteo the suburb name only. Kept for the day in this tab.
 * Null until it arrives, or if it can't be fetched (the chart then shows a
 * typical day).
 */
export function useTodayWeather(suburb: string | null | undefined, enabled = true): TodayWeather | null {
  const [w, setW] = useState<TodayWeather | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
    const key = `utilo.weather.${day}.${(suburb ?? "").toLowerCase()}`;
    let stop = false;
    (async () => {
      try {
        const hit = window.sessionStorage.getItem(key);
        if (hit) { const v = JSON.parse(hit) as TodayWeather; if (!stop) setW(v); return; }
      } catch { /* private window */ }
      let at = MELBOURNE;
      const name = (suburb ?? "").trim();
      if (name) {
        try {
          const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&countryCode=AU&language=en&format=json`).then((r) => r.json());
          const vic = (g?.results ?? []).find((x: { admin1?: string }) => x.admin1 === "Victoria");
          if (vic) at = { lat: vic.latitude, lon: vic.longitude, name: vic.name };
        } catch { /* fall back to Melbourne */ }
      }
      try {
        const f = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${at.lat}&longitude=${at.lon}&current=temperature_2m,weather_code,cloud_cover&hourly=cloud_cover&timezone=Australia%2FMelbourne&forecast_days=1`).then((r) => r.json());
        const cloud: number[] = Array.isArray(f?.hourly?.cloud_cover) ? f.hourly.cloud_cover.slice(0, 24).map((n: unknown) => (typeof n === "number" ? n : 0)) : [];
        if (cloud.length !== 24) return;
        const out: TodayWeather = {
          place: at.name,
          label: weatherLabel(f?.current?.weather_code, f?.current?.cloud_cover),
          tempC: typeof f?.current?.temperature_2m === "number" ? Math.round(f.current.temperature_2m) : null,
          cloud,
        };
        if (stop) return;
        setW(out);
        try { window.sessionStorage.setItem(key, JSON.stringify(out)); } catch { /* private window */ }
      } catch { /* no weather: typical day */ }
    })();
    return () => { stop = true; };
  }, [suburb, enabled]);
  return w;
}

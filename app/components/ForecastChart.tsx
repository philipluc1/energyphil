"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useColorScheme } from "@/lib/useColorScheme";

// Mirrors the palette approach in ResultsChart/DashboardCharts — Recharts
// needs real color values, not CSS custom properties.
const PALETTE = {
  light: { current: "#8a93a6", best: "#f0a202", grid: "#d9dfea", text: "#12141c" },
  dark: { current: "#7b849c", best: "#f0a202", grid: "#262f47", text: "#eceff7" },
};

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export interface ForecastPoint {
  month: string;
  current: number;
  best: number;
}

/**
 * Projects cumulative cost over the next 12 calendar months from two daily
 * rates — the customer's current/benchmark plan and the cheapest match.
 * Same flat "usage stays similar" assumption as periodBreakdown() in
 * lib/savings.ts, just extended into a point per month (using real
 * days-in-month) instead of three checkpoints, so the growing gap between
 * the two lines reads as the forecasted saving.
 */
export function buildForecastSeries(dailyCurrent: number, dailyBest: number, start: Date = new Date()): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  let cumCurrent = 0;
  let cumBest = 0;
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    cumCurrent += dailyCurrent * daysInMonth;
    cumBest += dailyBest * daysInMonth;
    points.push({
      month: d.toLocaleDateString("en-AU", { month: "short" }),
      current: Math.round(cumCurrent),
      best: Math.round(cumBest),
    });
  }
  return points;
}

export default function ForecastChart({ data, currentLabel }: { data: ForecastPoint[]; currentLabel: string }) {
  const scheme = useColorScheme();
  const colors = PALETTE[scheme];

  return (
    <div style={{ width: "100%", height: 230 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: colors.text }}
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: colors.text }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => fmtCurrency(Number(v))}
          />
          <Tooltip
            formatter={(value, name) => [fmtCurrency(Number(value)), name]}
            contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: "Karla, sans-serif" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Karla, sans-serif" }} iconType="plainline" />
          <Line type="monotone" dataKey="current" stroke={colors.current} strokeWidth={2} dot={false} name={currentLabel} />
          <Line type="monotone" dataKey="best" stroke={colors.best} strokeWidth={2.5} dot={false} name="Cheapest match" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

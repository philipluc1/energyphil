"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useColorScheme } from "@/lib/useColorScheme";
import type { MonthlySaving } from "@/lib/savings";

const PALETTE = {
  light: { bar: "#f0a202", partial: "#f7cf7a", text: "#12141c", axis: "#d9dfea" },
  dark: { bar: "#f0a202", partial: "#8a6a1e", text: "#eceff7", axis: "#262f47" },
};

function money(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// One column per month, oldest → newest, with the dollar value labelled on
// top of every column. The current (still-running) month is a lighter shade.
export default function SavingsChart({ months }: { months: MonthlySaving[] }) {
  const colors = PALETTE[useColorScheme()];
  const data = [...months].reverse().map((m) => ({
    label: m.label.replace(/ \d{4}$/, ""),
    amount: Math.round(m.amount * 100) / 100,
    partial: m.partial,
  }));

  return (
    <div style={{ width: "100%", height: 220 }} role="img" aria-label="Savings by month, column chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={{ stroke: colors.axis }} />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            cursor={false}
            formatter={(v) => [money(Number(v)), "Saved"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: "Karla, sans-serif" }}
          />
          <Bar dataKey="amount" radius={[5, 5, 0, 0]} maxBarSize={48}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.partial ? colors.partial : colors.bar} />
            ))}
            <LabelList
              dataKey="amount"
              position="top"
              formatter={(v) => money(Number(v))}
              style={{ fontSize: 11.5, fontWeight: 700, fill: colors.text, fontFamily: "IBM Plex Mono, monospace" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useColorScheme } from "@/lib/useColorScheme";

export interface ChartItem {
  label: string;
  sublabel: string;
  value: number;
  kind: "reference" | "cheapest" | "plan" | "referenceGood" | "referenceBad";
}

// Recharts fills are plain SVG attributes, not CSS, so they can't read the
// page's --navy/--amber custom properties directly — we mirror the two
// palettes from globals.css here and pick one by watching prefers-color-scheme.
const PALETTE = {
  light: { reference: "#9aa3b5", referenceGood: "#16a34a", referenceBad: "#dc2626", plan: "#2b3a67", cheapest: "#f5a623", text: "#12141c" },
  dark: { reference: "#7b849c", referenceGood: "#22c55e", referenceBad: "#ef4444", plan: "#3a5384", cheapest: "#f5a623", text: "#eceff7" },
}

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function ResultsChart({ items, palette }: { items: ChartItem[]; palette?: (typeof PALETTE)["light"] }) {
  const scheme = useColorScheme();
  const colors = palette ?? PALETTE[scheme];

  if (items.length === 0) return null;

  const height = items.length * 46 + 16;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barCategoryGap={10}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={128}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: colors.text, fontFamily: "Karla, sans-serif" }}
          />
          <Tooltip
            cursor={{ fill: "rgba(140,150,170,0.12)" }}
            formatter={(value) => [fmtCurrency(Number(value)), "Total this period"]}
            labelFormatter={(_label, payload) => payload?.[0]?.payload?.sublabel ?? ""}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid rgba(140,150,170,0.3)",
              fontFamily: "Karla, sans-serif",
            }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
            {items.map((item, i) => (
              <Cell key={i} fill={colors[item.kind]} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => fmtCurrency(Number(v))}
              style={{ fontSize: 12, fontWeight: 600, fill: colors.text, fontFamily: "IBM Plex Mono, monospace" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

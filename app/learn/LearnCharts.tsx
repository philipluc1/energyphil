"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useColorScheme } from "@/lib/useColorScheme";
import styles from "./learn.module.css";

const PALETTE = {
  light: { vdo: "#8a93a6", best: "#f0a202", up: "#c2410c", down: "#16a34a", text: "#12141c", grid: "#d9dfea" },
  dark: { vdo: "#7b849c", best: "#f0a202", up: "#fb9366", down: "#34d399", text: "#eceff7", grid: "#262f47" },
};
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

export interface NetworkGap { network: string; vdo: number; best: number }
export interface RetailerRow { retailer: string; total: number; isVdo?: boolean }
export interface VdoPoint { year: string; change: number; note: string }

export function NetworkGapChart({ data }: { data: NetworkGap[] }) {
  const c = PALETTE[useColorScheme()];
  return (
    <div className={styles.chartFrame} role="img" aria-label="Default offer versus cheapest market plan, by network">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="network" tick={{ fontSize: 12, fill: c.text }} tickLine={false} axisLine={{ stroke: c.grid }} />
          <YAxis tick={{ fontSize: 11, fill: c.text }} tickLine={false} axisLine={false} width={52} tickFormatter={money} />
          <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="vdo" name="Default offer" fill={c.vdo} radius={[5, 5, 0, 0]}>
            <LabelList dataKey="vdo" position="top" formatter={(v) => money(Number(v))} style={{ fontSize: 10.5, fill: c.text }} />
          </Bar>
          <Bar dataKey="best" name="Cheapest market plan" fill={c.best} radius={[5, 5, 0, 0]}>
            <LabelList dataKey="best" position="top" formatter={(v) => money(Number(v))} style={{ fontSize: 10.5, fill: c.text, fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RetailerRankChart({ byNetwork }: { byNetwork: Record<string, RetailerRow[]> }) {
  const c = PALETTE[useColorScheme()];
  const networks = Object.keys(byNetwork);
  const [network, setNetwork] = useState(networks[0]);
  const rows = byNetwork[network] ?? [];
  return (
    <div>
      <div className={styles.pillRow} role="group" aria-label="Choose your network">
        {networks.map((n) => (
          <button key={n} type="button" className={`${styles.pill} ${n === network ? styles.pillOn : ""}`} onClick={() => setNetwork(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className={styles.chartFrame} role="img" aria-label={`Cheapest yearly cost by retailer on ${network}`}>
        <ResponsiveContainer width="100%" height={Math.max(260, rows.length * 30 + 30)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} stroke={c.grid} />
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="retailer" width={118} tick={{ fontSize: 12, fill: c.text }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="total" radius={[0, 5, 5, 0]}>
              {rows.map((r) => (
                <Cell key={r.retailer} fill={r.isVdo ? c.vdo : c.best} />
              ))}
              <LabelList dataKey="total" position="right" formatter={(v) => money(Number(v))} style={{ fontSize: 11, fill: c.text, fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function VdoHistoryChart({ data }: { data: VdoPoint[] }) {
  const c = PALETTE[useColorScheme()];
  return (
    <div className={styles.chartFrame} role="img" aria-label="Yearly change in the Victorian Default Offer">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: c.text }} tickLine={false} axisLine={{ stroke: c.grid }} />
          <YAxis tick={{ fontSize: 11, fill: c.text }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v) => `${Number(v) > 0 ? "+" : ""}${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="change" name="Residential change" radius={[5, 5, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.year} fill={d.change > 0 ? c.up : c.down} />
            ))}
            <LabelList dataKey="change" position="top" formatter={(v) => `${Number(v) > 0 ? "+" : ""}${v}%`} style={{ fontSize: 12, fill: c.text, fontWeight: 800 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

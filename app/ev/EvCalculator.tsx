"use client";

import { useState } from "react";
import Link from "next/link";
import { CAR_TYPES, type NetworkRates } from "@/lib/evCalc";
import FunEquivalents from "../components/FunEquivalents";
import s from "./ev.module.css";

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: n < 100 ? 2 : 0, maximumFractionDigits: n < 100 ? 2 : 0 })}`;

export default function EvCalculator({ rates }: { rates: NetworkRates[] }) {
  const [network, setNetwork] = useState(rates[0]?.network ?? "");
  const [carId, setCarId] = useState("sedan");
  const [kmWeek, setKmWeek] = useState(250);
  const [petrol, setPetrol] = useState(2.0);

  const r = rates.find((x) => x.network === network) ?? rates[0];
  const car = CAR_TYPES.find((c) => c.id === carId) ?? CAR_TYPES[1];
  if (!r) return null;

  const fullDefault = car.batteryKwh * r.vdoRate;
  const fullBest = car.batteryKwh * r.bestRate;
  const kmYear = kmWeek * 52;
  const kwhYear = (kmYear / 100) * car.kwhPer100;
  const yearDefault = kwhYear * r.vdoRate;
  const yearBest = kwhYear * r.bestRate;
  const yearPetrol = (kmYear / 100) * car.petrolL100 * petrol;
  const per100Best = car.kwhPer100 * r.bestRate;
  const per100Default = car.kwhPer100 * r.vdoRate;
  const per100Petrol = car.petrolL100 * petrol;
  const saveVsDefault = Math.max(0, yearDefault - yearBest);
  const freeCharge = false;
  const maxBar = Math.max(yearPetrol, yearDefault, yearBest, 1);

  return (
    <div className={s.grid}>
      <div className={s.panel}>
        <div className={s.label}>Your network</div>
        <div className={s.pills}>
          {rates.map((x) => (
            <button key={x.network} type="button" className={x.network === network ? s.pillOn : s.pill} onClick={() => setNetwork(x.network)}>
              {x.network}
            </button>
          ))}
        </div>
        <div className={s.hint}>It&apos;s on your bill. Not sure? <Link href="/check">Use the address check</Link>.</div>

        <div className={s.label}>Your car</div>
        <div className={s.cars}>
          {CAR_TYPES.map((c) => (
            <button key={c.id} type="button" className={c.id === carId ? s.carOn : s.car} onClick={() => setCarId(c.id)}>
              <b>{c.label}</b>
              <span>{c.example}</span>
            </button>
          ))}
        </div>

        <label className={s.label} htmlFor="km">
          Distance each week: <b>{kmWeek} km</b>
        </label>
        <input id="km" type="range" min={50} max={800} step={10} value={kmWeek} onChange={(e) => setKmWeek(Number(e.target.value))} className={s.range} />

        <label className={s.label} htmlFor="petrol">Petrol price for comparison ($/L)</label>
        <input id="petrol" type="number" min={1} max={4} step={0.05} value={petrol} onChange={(e) => setPetrol(Number(e.target.value) || 0)} className={s.num} />
      </div>

      <div className={s.results}>
        <div className={s.hero}>
          <div className={s.heroLabel}>One full charge ({car.batteryKwh} kWh), charged overnight</div>
          <div className={s.heroNum}>{freeCharge ? "about $0" : money(fullBest)}</div>
          <div className={s.heroSub}>
            vs {money(fullDefault)} on the default offer. {r.bestRetailer} &ldquo;{r.bestPlan}&rdquo; has the cheapest everyday overnight rate we found on {r.network}
            {" "}({(r.bestRate * 100).toFixed(1)}c/kWh).
          </div>
          {saveVsDefault > 0 && (
            <>
              <div className={s.heroSave}>Up to {money(Math.round(saveVsDefault))} a year on charging</div>
              <FunEquivalents dollars={saveVsDefault} />
            </>
          )}
        </div>

        {r.promo && (
          <div className={s.promo}>
            <b>Free or near-free windows exist.</b> {r.promo.retailer} &ldquo;{r.promo.plan}&rdquo; charges {(r.promo.rate * 100).toFixed(1)}c/kWh in its
            special hours. If you can charge inside that window it could cost close to nothing, but check the hours and what you pay the rest of the day.
          </div>
        )}

        <div className={s.card}>
          <div className={s.cardTitle}>Cost to drive 100 km</div>
          <div className={s.tiles}>
            <div className={s.tile}><b>{money(per100Best)}</b><span>cheap overnight rate</span></div>
            <div className={s.tile}><b>{money(per100Default)}</b><span>default offer</span></div>
            <div className={s.tile}><b>{money(per100Petrol)}</b><span>petrol car</span></div>
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardTitle}>Fuel cost over a year ({kmYear.toLocaleString("en-AU")} km)</div>
          {[
            { k: "Petrol", v: yearPetrol, c: s.barGrey },
            { k: "EV on default offer", v: yearDefault, c: s.barNavy },
            { k: "EV on cheap overnight rate", v: yearBest, c: s.barGreen },
          ].map((b) => (
            <div key={b.k} className={s.barRow}>
              <span>{b.k}</span>
              <div className={s.track}><div className={`${s.bar} ${b.c}`} style={{ width: `${Math.max(2, (b.v / maxBar) * 100)}%` }} /></div>
              <b>{money(Math.round(b.v))}</b>
            </div>
          ))}
        </div>

        <p className={s.note}>
          Estimates only. Car figures are typical for each size (about {car.kwhPer100} kWh per 100 km) and real cars vary. This looks at the charging rate
          alone: plans with very cheap overnight power can cost more during the day, and some cheap or free rates only apply in set hours. To see what a plan
          does to your <em>whole</em> bill, <Link href="/check">run the free check</Link> and confirm details with the retailer.
        </p>
      </div>
    </div>
  );
}

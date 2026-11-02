"use client";

import Icon from "./Icon";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./reminder.module.css";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function nextSaturday(): string {
  const d = new Date();
  const add = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  return ymd(d);
}
/** 20261012T090000 (local, for Google with ctz) */
const localStamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
/** 20261011T220000Z (UTC, for .ics) */
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

function buildIcs(title: string, details: string, start: Date, end: Date, link?: string): string {
  const now = new Date();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Utilo//Switch reminder//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${now.getTime()}-${Math.random().toString(36).slice(2)}@utilo`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(details)}`,
    ...(link ? [`URL:${link}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");
}

/** iCalendar lines must be at most 75 characters; longer ones continue on the next line after a space. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push(line.slice(i, i + 73));
  return parts.join("\r\n ");
}

/** "Remind me" (2 Nov 2026): either a 15-minute reminder in the person's own
 *  calendar (Google, Outlook, or Apple/anything via an .ics file; nothing stored
 *  by us), or an email from us that morning (one reminder, cleared once sent). */
export default function SwitchReminder({
  retailer,
  plan,
  savingYear,
  link,
  nmi,
  dark = false,
  same = false,
}: {
  retailer: string;
  plan: string;
  savingYear: number;
  link?: string;
  nmi?: string | null;
  dark?: boolean;
  /** The plan is with the retailer they're already with: a plan change, not a switch. */
  same?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => addDays(1));
  const [time, setTime] = useState("09:00");
  const [done, setDone] = useState("");
  const [mail, setMail] = useState<{ state: "idle" | "busy" | "set" | "err"; msg: string; on?: string }>({ state: "idle", msg: "" });

  const start = new Date(`${date}T${time || "09:00"}:00`);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const title = same ? `Ask ${retailer} to move me to ${plan}` : `Switch electricity to ${retailer}`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const details = [
    same
      ? `Utilo found you could save about $${Math.round(savingYear).toLocaleString("en-AU")} a year by moving to ${plan}. It's with ${retailer}, who you're already with: no need to switch, just ask them.`
      : `Utilo found you could save about $${Math.round(savingYear).toLocaleString("en-AU")} a year on ${retailer} (${plan}).`,
    "",
    same ? "Before you call:" : "Before you switch:",
    `1. Check it's still the cheapest (prices change): ${origin}/account#compare`,
    `2. Have your latest bill${nmi ? ` and NMI (${nmi})` : " and NMI"} handy.`,
    same
      ? `3. Call ${retailer} or open their app and ask to move to "${plan}".`
      : link ? `3. Sign up here: ${link}` : `3. Search "${retailer} ${plan}" on the retailer's site.`,
  ].join("\n");

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Melbourne";
  const google =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${localStamp(start)}/${localStamp(end)}` +
    `&ctz=${encodeURIComponent(tz)}` +
    `&details=${encodeURIComponent(details)}`;
  const outlook =
    "https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent" +
    `&subject=${encodeURIComponent(title)}` +
    `&startdt=${encodeURIComponent(start.toISOString())}` +
    `&enddt=${encodeURIComponent(end.toISOString())}` +
    `&body=${encodeURIComponent(details)}`;

  function downloadIcs() {
    const ics = buildIcs(title, details, start, end, link);
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `switch-to-${retailer.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setDone("Calendar file downloaded. Open it to add the reminder.");
  }

  async function emailMe() {
    if (!supabase || mail.state === "busy") return;
    setMail({ state: "busy", msg: "" });
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/switch-reminder", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ date, retailer, plan, savingYear }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    setMail({ state: body?.ok ? "set" : "err", msg: body?.message ?? "Couldn't save that just now. Try again in a minute.", on: date });
  }
  async function cancelEmail() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    await fetch("/api/switch-reminder", { method: "DELETE", headers: { authorization: `Bearer ${data.session?.access_token ?? ""}` } }).catch(() => null);
    setMail({ state: "idle", msg: "" });
    setDone("Email reminder cancelled.");
  }

  const when = start.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  const chips: [string, string][] = [["Tomorrow", addDays(1)], ["Saturday", nextSaturday()], ["In a week", addDays(7)]];

  if (!open) {
    return (
      <button type="button" className={dark ? styles.triggerDark : styles.trigger} onClick={() => setOpen(true)}>
        <Icon name="bell" /> Remind me
      </button>
    );
  }

  return (
    <div className={`${styles.box} ${dark ? styles.boxDark : ""}`} data-noswipe>
      <div className={styles.head}>
        <b>{same ? `Remind me to ask ${retailer} for ${plan}` : `Remind me to switch to ${retailer}`}</b>
        <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close">×</button>
      </div>
      <div className={styles.chips}>
        {chips.map(([label, d]) => (
          <button key={label} type="button" className={date === d ? styles.chipOn : styles.chip} onClick={() => setDate(d)}>{label}</button>
        ))}
        <label className={styles.pick}>
          <span>Date</span>
          <input type="date" value={date} min={addDays(0)} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={styles.pick}>
          <span>Time</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <p className={styles.sum}>{when}, with the plan, your NMI, the retailer&apos;s link and a reminder to recheck prices.</p>
      <div className={styles.ways}>
        <div className={styles.way}>
          <span className={styles.wayLabel}><Icon name="calendar" size={14} /> Add to my calendar <small>at {start.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}</small></span>
          <div className={styles.cals}>
            <a href={google} target="_blank" rel="noopener noreferrer" className={styles.cal} onClick={() => setDone("Opened Google Calendar. Hit Save there.")}>Google</a>
            <a href={outlook} target="_blank" rel="noopener noreferrer" className={styles.cal} onClick={() => setDone("Opened Outlook. Hit Save there.")}>Outlook</a>
            <button type="button" className={styles.cal} onClick={downloadIcs}>Apple / other</button>
          </div>
        </div>
        <div className={styles.way}>
          <span className={styles.wayLabel}><Icon name="mail" size={14} /> Or email me <small>that morning</small></span>
          <div className={styles.cals}>
            <button type="button" className={styles.mailBtn} onClick={emailMe} disabled={mail.state === "busy"}>
              {mail.state === "busy" ? "Saving…" : mail.state === "set" ? (mail.on === date ? `✓ Set for ${when}` : `Change to ${when}`) : `Email me on ${when}`}
            </button>
          </div>
        </div>
      </div>
      {mail.state === "set" && (
        <p className={styles.done}>
          ✓ {mail.msg}{" "}
          <button type="button" className={styles.undo} onClick={cancelEmail}>Cancel</button>
        </p>
      )}
      {mail.state === "err" && <p className={styles.err}>{mail.msg}</p>}
      {done && mail.state !== "set" && <p className={styles.done}>✓ {done}</p>}
    </div>
  );
}

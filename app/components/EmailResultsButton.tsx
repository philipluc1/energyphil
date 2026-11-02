"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Icon from "./Icon";
import s from "./emailresults.module.css";

/** "Email me my results" (2 Nov 2026): today's results, sent now, as the monthly summary email. */
export default function EmailResultsButton() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");
  async function send() {
    if (!supabase || state === "busy") return;
    setState("busy");
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/email-results", { method: "POST", headers: { authorization: `Bearer ${data.session?.access_token ?? ""}` } }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    setState(body?.ok ? "done" : "err");
    setMsg(body?.message ?? "Couldn't send just now. Try again in a minute.");
  }
  return (
    <div className={s.row}>
      <button type="button" className={s.btn} onClick={send} disabled={state === "busy"}>
        <Icon name="mail" size={16} /> {state === "busy" ? "Sending…" : state === "done" ? "Send again" : "Email me these results"}
      </button>
      <span className={state === "err" ? s.err : s.note} role="status">
        {state === "idle" ? "The same summary also arrives on the 1st of each month." : msg}
      </span>
    </div>
  );
}

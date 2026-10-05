"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "../dashboard.module.css";

export default function DashboardLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("checking");
    const res = await fetch("/api/dashboard-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
      router.push(next);
      return;
    }
    const body = await res.json().catch(() => ({ message: "Something went wrong." }));
    setStatus("error");
    setErrorMsg(body.message || "Wrong password.");
  }

  return (
    <div className={styles.loginWrap}>
      <form className={styles.loginCard} onSubmit={handleSubmit}>
        <div className={styles.loginBrand}>
          Util<span className={styles.loginAccent}>o</span>
        </div>
        <p className={styles.loginSub}>Private dashboard — enter the password to continue.</p>
        <input
          type="password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={status === "checking" || password.length === 0}>
          {status === "checking" ? "Checking…" : "Enter"}
        </button>
        {status === "error" && <p className={styles.loginErr}>{errorMsg}</p>}
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * Is the person looking at this page a paying member? null while we check.
 * For showing or hiding member-only views only: anything that costs us money
 * (bill reading) is checked again on the server.
 */
export function useMember(): boolean | null {
  const [member, setMember] = useState<boolean | null>(supabase ? null : false);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    async function check(token: string | undefined) {
      if (!token) {
        if (alive) setMember(false);
        return;
      }
      const res = await fetch("/api/member-status", { headers: { authorization: `Bearer ${token}` } }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (alive) setMember(Boolean(body?.member));
    }
    supabase.auth.getSession().then(({ data }) => check(data.session?.access_token));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      check(session?.access_token);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  return member;
}

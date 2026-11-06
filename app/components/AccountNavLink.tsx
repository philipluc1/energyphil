"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/** "Member login" until we know the person is signed in, then "My dashboard" (6 Nov 2026: says who it's for). */
export default function AccountNavLink({ className }: { className: string }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return (
    <Link href="/account" className={className}>
      {signedIn ? "My dashboard" : "Member login"}
    </Link>
  );
}

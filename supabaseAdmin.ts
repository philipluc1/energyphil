import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY. Uses the Supabase "secret" key, which bypasses Row Level
// Security entirely — it must never be sent to the browser. The `server-only`
// import above makes the build fail loudly if any client component ever
// imports this file by mistake.
//
// Used only by the password-protected /dashboard route to read the leads
// table for Phil's own analytics — the public comparator never touches this.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export const supabaseAdmin: SupabaseClient | null =
  url && secretKey ? createClient(url, secretKey, { auth: { persistSession: false } }) : null;

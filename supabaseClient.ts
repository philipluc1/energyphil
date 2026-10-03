import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase's newer "publishable" key (sb_publishable_...) is a drop-in replacement for the
// legacy JWT "anon" key — same low-privilege access, same Row Level Security behaviour, safe
// to expose in client-side code.
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Client is null until the two env vars are set in Vercel (Project Settings > Environment
// Variables). The app must still render and work without it — lead capture just becomes a
// no-op with a console warning instead of crashing the whole page.
export const supabase: SupabaseClient | null =
  url && publishableKey ? createClient(url, publishableKey) : null;

export const supabaseConfigured = Boolean(supabase);

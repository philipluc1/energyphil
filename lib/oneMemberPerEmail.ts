import type { SupabaseClient } from "@supabase/supabase-js";

// One email per person (2 Nov 2026). Someone with more than one active
// membership row under the same address (old test sign-ups, a second join)
// got one copy of every email per row. The jobs now send only for the newest
// active row of each address.

export function newestPerEmail(rows: { id: string; email: string; created_at: string }[]): Set<string> {
  const best = new Map<string, { id: string; created_at: string }>();
  for (const r of rows) {
    const k = r.email.trim().toLowerCase();
    const cur = best.get(k);
    if (!cur || r.created_at > cur.created_at) best.set(k, { id: r.id, created_at: r.created_at });
  }
  return new Set([...best.values()].map((x) => x.id));
}

/** Ids of the rows to email: the newest active membership per address. Null if the lookup failed (send as before). */
export async function activeRowsToEmail(db: SupabaseClient): Promise<Set<string> | null> {
  const { data, error } = await db.from("subscribers").select("id, email, created_at").eq("status", "active");
  if (error) {
    console.error("oneMemberPerEmail:", error.message);
    return null;
  }
  return newestPerEmail((data ?? []) as { id: string; email: string; created_at: string }[]);
}

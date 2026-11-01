/**
 * The sender, tidied (1 Nov 2026): a stray quote or bracket in the Vercel
 * setting (e.g. "info@utilo.com.au>") made Resend refuse every email.
 * Accepts "Name <a@b.c>" or a bare "a@b.c" and rebuilds it as "Utilo <a@b.c>" if needed.
 */
export function cleanFromAddress(raw: string | undefined): string {
  const fallback = "Utilo <onboarding@resend.dev>";
  const v = (raw ?? "").trim().replace(/^["']+|["']+$/g, "");
  if (!v) return fallback;
  const addr = /([^\s<>"']+@[^\s<>"']+\.[^\s<>"']+)/.exec(v)?.[1];
  if (!addr) return fallback;
  const name = v.includes("<") ? v.slice(0, v.indexOf("<")).trim().replace(/^["']+|["']+$/g, "") : "";
  return `${name || "Utilo"} <${addr}>`;
}

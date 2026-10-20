// Email addresses as people type them vs. the inbox they belong to.

/** Trimmed and lower case: how memberships are stored and matched. */
export const normalEmail = (e: string): string => e.trim().toLowerCase();

/** The same inbox however it's written: lower case, no "+tag", and no dots
 *  for Gmail. For abuse checks only (e.g. referring yourself), never for sending. */
export function canonicalEmail(e: string): string {
  const n = normalEmail(e);
  const at = n.lastIndexOf("@");
  if (at < 1) return n;
  let user = n.slice(0, at).split("+")[0];
  let domain = n.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") user = user.replace(/\./g, "");
  return `${user}@${domain}`;
}

// Owner dashboard (/dashboard) sign-in. The cookie holds an HMAC of a fixed
// label keyed with DASHBOARD_PASSWORD, never the password itself. Works in
// both the edge middleware and Node (Web Crypto).

export const DASH_COOKIE = "vec_dash_auth";

export async function dashToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("utilo-owner-dashboard-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when the cookie value matches the current DASHBOARD_PASSWORD. */
export async function dashCookieValid(cookie: string | undefined): Promise<boolean> {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || !cookie) return false;
  return sameString(cookie, await dashToken(expected));
}

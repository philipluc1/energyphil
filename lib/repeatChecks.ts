// 4 Nov 2026: the free check is open to everyone, as often as they like. Someone who
// keeps coming back is doing Utilo Plus's job by hand, so on their third check in 30
// days we say so (a nudge, never a block). Counted in this browser only.

export const REPEAT_WINDOW_DAYS = 30;
/** Re-running within the hour (going back to tweak an answer) is the same check. */
export const SAME_CHECK_MS = 60 * 60 * 1000;
/** Show the nudge from this many checks in the window. */
export const REPEAT_NUDGE_AT = 3;
export const REPEAT_KEY = "utilo.checkTimes";

const DAY = 24 * 60 * 60 * 1000;

/** Keep the times inside the window, and add `now` unless the last check was within the hour. */
export function recordCheck(times: unknown, now: number): number[] {
  const list = (Array.isArray(times) ? times : [])
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t <= now && now - t < REPEAT_WINDOW_DAYS * DAY)
    .sort((a, b) => a - b)
    .slice(-50);
  const last = list[list.length - 1];
  if (last === undefined || now - last >= SAME_CHECK_MS) list.push(now);
  return list;
}

export function showRepeatNudge(times: number[]): boolean {
  return times.length >= REPEAT_NUDGE_AT;
}

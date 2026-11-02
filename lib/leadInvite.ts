// Who can get an owner-sent invite (2 Nov 2026). Pure, so the rules are tested.

export const INVITE_GAP_DAYS = 30;

/** Why this person can't be invited now, or null if they can. Rows are their leads, newest first. */
export function inviteBlock(
  leads: { unsubscribed: boolean | null; invite_sent_at?: string | null }[],
  isMember: boolean,
  now: Date,
): string | null {
  if (leads.length === 0) return "No result on file for that email.";
  if (leads.some((l) => l.unsubscribed)) return "They unsubscribed, so no more emails.";
  if (isMember) return "They're already a member.";
  const last = leads.map((l) => l.invite_sent_at).filter((x): x is string => !!x).sort().pop();
  if (last) {
    const days = (now.getTime() - new Date(last).getTime()) / 86_400_000;
    if (days < INVITE_GAP_DAYS) {
      const d = Math.max(0, Math.floor(days));
      const when = d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"} ago`;
      return `Already invited ${when}. One invite every ${INVITE_GAP_DAYS} days at most.`;
    }
  }
  return null;
}

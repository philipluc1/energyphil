// The second invite (3 Nov 2026): a look inside the dashboard, sent by the
// morning job once, a week after the owner-sent invite, if they still haven't
// joined. Pure, so the rule is tested.

export const INVITE_FOLLOW_UP_DAYS = 7;

export function inviteFollowUpDue(o: {
  invitedAt: string | null;
  followUpAt: string | null;
  unsubscribed: boolean;
  isMember: boolean;
  now: Date;
}): boolean {
  if (!o.invitedAt || o.followUpAt || o.unsubscribed || o.isMember) return false;
  const days = (o.now.getTime() - Date.parse(o.invitedAt)) / 86_400_000;
  // Not for very old invites (a follow-up months later reads as spam).
  return days >= INVITE_FOLLOW_UP_DAYS && days < INVITE_FOLLOW_UP_DAYS + 14;
}

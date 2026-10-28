/** "in 3 days", "in 5 hours", "in 20 minutes", "now": how long until a moment, for the planning-opens line. */
export function untilLabel(at: Date, now: Date): string {
  const ms = at.getTime() - now.getTime();
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${Math.max(1, mins)} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.round(ms / 3600000);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(ms / 86400000);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

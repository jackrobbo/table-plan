/** Estimated minutes (prep + cooking) as a short label: "≈ 25 min", "≈ 1 hr 5 min". Null for ready-to-eat items and unknowns. */
export function timeLabel(minutes: number | undefined | null): string | null {
  if (!minutes || minutes < 1) return null;
  if (minutes < 60) return `≈ ${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `≈ ${h} hr${m ? ` ${m} min` : ''}`;
}

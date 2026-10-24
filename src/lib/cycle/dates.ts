/** Week math in Europe/London (the product is UK-only). Weeks are keyed by their Monday as "YYYY-MM-DD". */
const TZ = 'Europe/London';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
});

export function londonParts(d: Date) {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, wd };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const londonDate = (d: Date) => { const p = londonParts(d); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function weekday(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The Monday on or before this date. */
export function mondayOf(ymd: string): string { return addDays(ymd, -((weekday(ymd) + 6) % 7)); }

/** The first Monday strictly after this date. */
export function nextMondayAfter(ymd: string): string { return addDays(mondayOf(ymd), 7); }

/** The instant at which the London wall clock reads `hour:minute` on `ymd` (handles BST/GMT changes). */
export function londonInstant(ymd: string, hour = 0, minute = 0): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const wanted = Date.UTC(y, m - 1, d, hour, minute);
  let t = wanted;
  for (let i = 0; i < 3; i++) {
    const p = londonParts(new Date(t));
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
    t += wanted - shown;
  }
  return new Date(t);
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = (ymd: string) => { const [, m, d] = ymd.split('-').map(Number); return { d, m: MONTH[m - 1] }; };

/** "26–30 Oct" (Mon–Fri), or "28 Sep – 2 Oct" across a month boundary. */
export function weekLabel(start: string): string {
  const a = dm(start), b = dm(addDays(start, 4));
  return a.m === b.m ? `${a.d}–${b.d} ${b.m}` : `${a.d} ${a.m} – ${b.d} ${b.m}`;
}

export const dayLabel = (ymd: string) => { const x = dm(ymd); return `${x.d} ${x.m}`; };

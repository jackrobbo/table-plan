/**
 * Is the weekly price feed healthy? Pure: takes the recent run records and the time, returns what is wrong.
 * Problems mean people may be seeing old prices (or none were updated); warnings are worth a look but prices are being served.
 */
export interface RunRecord {
  id: string;
  stores: string[];
  status: string;            // running | ok | partial | failed
  started_at: string;
  finished_at: string | null;
  rows_expected: number | null;
  rows_received: number | null;
  rows_held: number;
  notes: string | null;
}
export interface Health { ok: boolean; problems: string[]; warnings: string[] }

export const STALE_DAYS = 9;      // a weekly run is due every 7 days; a day or two of slack
export const STUCK_HOURS = 3;     // a run takes about 4 minutes; three hours with no webhook means it never arrived

const days = (a: Date, b: string) => (a.getTime() - new Date(b).getTime()) / 86_400_000;

export function checkFeedHealth(runs: RunRecord[], now: Date, stores: string[] = ['morrisons', 'tesco']): Health {
  const problems: string[] = [], warnings: string[] = [];
  for (const store of stores) {
    const mine = runs.filter((r) => r.stores.includes(store)).sort((a, b) => b.started_at.localeCompare(a.started_at));
    const latest = mine[0];
    if (!latest) { problems.push(`${store}: no price run in the last ${STALE_DAYS + 1} days (the Monday job did not start).`); continue; }
    const age = days(now, latest.started_at);
    if (latest.status === 'running') {
      if (age * 24 > STUCK_HOURS) problems.push(`${store}: the run from ${latest.started_at.slice(0, 16).replace('T', ' ')} never reported back (stuck "running"), so no new prices were stored.`);
      continue;
    }
    if (latest.status === 'failed') { problems.push(`${store}: the latest run failed (${(latest.notes ?? 'no reason recorded').slice(0, 160)}); the app is still showing the previous prices.`); continue; }
    const finished = latest.finished_at ?? latest.started_at;
    if (days(now, finished) > STALE_DAYS) { problems.push(`${store}: the newest good run is ${Math.floor(days(now, finished))} days old.`); continue; }
    if (latest.rows_held > 0) warnings.push(`${store}: ${latest.rows_held} price${latest.rows_held === 1 ? '' : 's'} moved over 50% and ${latest.rows_held === 1 ? 'is' : 'are'} held for review (not shown to people).`);
    if (latest.rows_expected && latest.rows_received != null && latest.rows_received / latest.rows_expected < 0.95) warnings.push(`${store}: only ${latest.rows_received} of ${latest.rows_expected} products came back.`);
  }
  return { ok: problems.length === 0, problems, warnings };
}

export function alertText(h: Health): string {
  return [`Table Plan price feed: ${h.ok ? 'needs a look' : 'PROBLEM'}`, ...h.problems.map((p) => `- ${p}`), ...h.warnings.map((w) => `- (note) ${w}`)].join('\n');
}

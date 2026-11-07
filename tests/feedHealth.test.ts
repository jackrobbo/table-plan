import { describe, expect, it, vi } from 'vitest';
import { alertText, checkFeedHealth, type RunRecord } from '@/lib/pricing/health';
import { runHealthCheck, webhookNotifier } from '@/lib/server/health';

const NOW = new Date('2026-11-09T08:00:00Z');
const run = (store: string, o: Partial<RunRecord> = {}): RunRecord => ({ id: Math.random().toString(36), stores: [store], status: 'ok', started_at: '2026-11-09T05:00:00Z', finished_at: '2026-11-09T05:05:00Z', rows_expected: 100, rows_received: 100, rows_held: 0, notes: null, ...o });
const good = [run('morrisons'), run('tesco')];

describe('feed health: what counts as a problem', () => {
  it('is quiet when both stores had a clean run this week', () => {
    expect(checkFeedHealth(good, NOW)).toEqual({ ok: true, problems: [], warnings: [] });
  });
  it('flags a store with no run at all (the cron did not start)', () => {
    const h = checkFeedHealth([run('morrisons')], NOW);
    expect(h.ok).toBe(false); expect(h.problems[0]).toMatch(/tesco: no price run/);
  });
  it('flags a failed latest run and quotes the reason', () => {
    const h = checkFeedHealth([run('morrisons', { status: 'failed', notes: 'only 40% of products came back' }), run('tesco')], NOW);
    expect(h.ok).toBe(false); expect(h.problems[0]).toMatch(/morrisons: the latest run failed \(only 40%/);
  });
  it('flags a run stuck "running" for hours, but not one that just started', () => {
    expect(checkFeedHealth([run('morrisons', { status: 'running', finished_at: null, started_at: '2026-11-09T04:00:00Z' }), run('tesco')], NOW).problems[0]).toMatch(/never reported back/);
    const fresh = checkFeedHealth([run('morrisons', { status: 'running', finished_at: null, started_at: '2026-11-09T07:30:00Z' }), run('tesco')], NOW);
    expect(fresh.ok).toBe(true);
  });
  it('judges by the newest run only, so a later good run clears an earlier failure', () => {
    const h = checkFeedHealth([run('morrisons', { status: 'failed', started_at: '2026-11-08T05:00:00Z' }), run('morrisons'), run('tesco')], NOW);
    expect(h.ok).toBe(true);
  });
  it('flags a store whose newest good run is over 9 days old', () => {
    const old = run('tesco', { started_at: '2026-10-28T05:00:00Z', finished_at: '2026-10-28T05:05:00Z' });
    expect(checkFeedHealth([run('morrisons'), old], NOW).problems[0]).toMatch(/tesco: the newest good run is 12 days old/);
  });
  it('warns, without failing, about held prices and thin coverage', () => {
    const h = checkFeedHealth([run('morrisons', { status: 'partial', rows_held: 2 }), run('tesco', { status: 'partial', rows_received: 90 })], NOW);
    expect(h.ok).toBe(true); expect(h.warnings).toHaveLength(2); expect(h.warnings[0]).toMatch(/2 prices moved over 50%/); expect(h.warnings[1]).toMatch(/90 of 100/);
  });
  it('words the alert plainly', () => {
    const t = alertText(checkFeedHealth([run('morrisons')], NOW));
    expect(t.startsWith('Table Plan price feed: PROBLEM')).toBe(true); expect(t).toContain('- tesco');
  });
});

describe('feed health: sending the alert', () => {
  it('sends nothing when all is well, one message when not, and still reports if sending fails', async () => {
    const notify = vi.fn(async () => {});
    expect(await runHealthCheck({ loadRuns: async () => good, notify, now: () => NOW })).toMatchObject({ ok: true, alerted: false });
    expect(notify).not.toHaveBeenCalled();
    expect(await runHealthCheck({ loadRuns: async () => [run('morrisons')], notify, now: () => NOW })).toMatchObject({ ok: false, alerted: true });
    expect(notify).toHaveBeenCalledTimes(1);
    const bad = await runHealthCheck({ loadRuns: async () => [run('morrisons')], notify: async () => { throw new Error('down https://ntfy.sh/secrettopic'); }, now: () => NOW });
    expect(bad.ok).toBe(false); expect(bad.alerted).toBe(false); expect(JSON.stringify(bad)).not.toContain('secrettopic');
  });
  it('works with no channel set: still reports, does not throw', async () => {
    expect(await runHealthCheck({ loadRuns: async () => [], now: () => NOW })).toMatchObject({ ok: false, alerted: false });
  });
  it('formats for ntfy (plain text), Slack and Discord, and ignores a missing or bad URL', async () => {
    const f = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
    await webhookNotifier('https://ntfy.sh/mytopic', f)!('hi');
    await webhookNotifier('https://hooks.slack.com/services/x', f)!('hi');
    await webhookNotifier('https://discord.com/api/webhooks/1/x', f)!('hi');
    const calls = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect(calls[0][1].body).toBe('hi'); expect(calls[1][1].body).toBe('{"text":"hi"}'); expect(calls[2][1].body).toBe('{"content":"hi"}');
    expect(webhookNotifier(undefined)).toBeUndefined(); expect(webhookNotifier('not a url')).toBeUndefined();
    await expect(webhookNotifier('https://ntfy.sh/t', (async () => new Response('', { status: 500 })) as unknown as typeof fetch)!('x')).rejects.toThrow(/HTTP 500/);
  });
});

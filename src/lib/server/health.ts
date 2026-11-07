import { alertText, checkFeedHealth, type Health, type RunRecord } from '../pricing/health';

export interface HealthDeps {
  loadRuns: () => Promise<RunRecord[]>;
  /** Sends the alert text somewhere a person will see it. Optional: with none, the check still reports and the route still fails visibly. */
  notify?: (text: string) => Promise<void>;
  now?: () => Date;
}

/** Checks the feed and, if anything is wrong (or worth a look), sends one message. Alert failures never hide the result. */
export async function runHealthCheck(d: HealthDeps): Promise<Health & { alerted: boolean; alertError?: string }> {
  const h = checkFeedHealth(await d.loadRuns(), (d.now ?? (() => new Date()))());
  if (h.ok && !h.warnings.length) return { ...h, alerted: false };
  if (!d.notify) return { ...h, alerted: false };
  try { await d.notify(alertText(h)); return { ...h, alerted: true }; }
  catch (e) { return { ...h, alerted: false, alertError: String((e as Error).message).replace(/https?:\/\/\S+/g, '[url]').slice(0, 120) }; }
}

/**
 * A notifier for a webhook URL kept in ALERT_WEBHOOK_URL. ntfy.sh topics (a phone push, no account) get plain text; Slack and Discord
 * incoming webhooks get their own JSON. The URL is a secret and is never logged or returned.
 */
export function webhookNotifier(url: string | undefined, fetchImpl: typeof fetch = fetch): ((text: string) => Promise<void>) | undefined {
  if (!url) return undefined;
  let host = '';
  try { host = new URL(url).host; } catch { return undefined; }
  return async (text) => {
    const slack = host === 'hooks.slack.com', discord = /(^|\.)discord(app)?\.com$/.test(host);
    const r = await fetchImpl(url, slack || discord
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(slack ? { text } : { content: text }) }
      : { method: 'POST', headers: { 'content-type': 'text/plain', Title: 'Table Plan price feed', Priority: 'high' }, body: text });
    if (!r.ok) throw new Error(`alert service answered HTTP ${r.status}`);
  };
}

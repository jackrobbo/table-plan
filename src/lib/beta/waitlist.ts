const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface WaitlistStore {
  /** Idempotent: adding the same email twice is not an error. */
  add(entry: { email: string; source: string; consentAt: string }): Promise<void>;
}

export type WaitlistResult = { status: number; body: { ok?: true; error?: string } };

/** Validates and stores a waitlist signup. Consent is required (UK GDPR) and stored with a timestamp. */
export async function joinWaitlist(a: { body: any; store: WaitlistStore | null; now?: Date }): Promise<WaitlistResult> {
  const { email, consent, source, company } = a.body ?? {};
  if (company) return { status: 200, body: { ok: true } };            // honeypot: bots fill hidden fields; pretend success
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) return { status: 400, body: { error: 'Enter a valid email address.' } };
  if (consent !== true) return { status: 400, body: { error: 'Please agree to be emailed about Table Plan.' } };
  if (!a.store) return { status: 503, body: { error: 'The waitlist is not open yet. Please try again soon.' } };
  await a.store.add({ email: email.trim().toLowerCase(), source: typeof source === 'string' ? source.slice(0, 40) : 'site', consentAt: (a.now ?? new Date()).toISOString() });
  return { status: 200, body: { ok: true } };
}

import { looksLikeCode, normaliseCode } from '../beta/invites';
import type { Result } from '../billing/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** What creating an account needs from the server side. Implemented on Supabase (service role) in context.ts. */
export interface SignupStore {
  /** Atomically marks an unused invite as used by this email. False if unknown or already used. */
  redeem(code: string, email: string): Promise<boolean>;
  /** Gives the code back (only if it is still held by this email), e.g. when the account turned out to exist already. */
  release(code: string, email: string): Promise<void>;
  /** Creates a confirmed login for the email so a sign-in code can be sent to it. */
  createUser(email: string): Promise<'created' | 'exists' | 'failed'>;
}

/**
 * The only way to make a new account. Sign-in codes are sent with `shouldCreateUser: false` and Supabase's own public sign-up is
 * switched off, so the invite check here can't be skipped by calling Supabase directly.
 */
export async function startSignup(a: { body: unknown; store: SignupStore | null; inviteRequired: boolean }): Promise<Result> {
  if (!a.store) return { status: 503, body: { error: 'Sign-up isn’t switched on yet.' } };
  const b = (a.body && typeof a.body === 'object' ? a.body : {}) as { email?: unknown; invite?: unknown };
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) return { status: 400, body: { error: 'Enter a valid email address.' } };

  let code: string | null = null;
  if (a.inviteRequired) {
    code = typeof b.invite === 'string' ? normaliseCode(b.invite) : '';
    if (!looksLikeCode(code)) return { status: 400, body: { error: 'That code does not look right.' } };
    if (!(await a.store.redeem(code, email))) return { status: 400, body: { error: 'That code is not valid or has already been used.' } };
  }

  const made = await a.store.createUser(email);
  if (made === 'created') return { status: 200, body: { ok: true } };
  if (code) await a.store.release(code, email);
  // Already registered: carry on to the sign-in code as normal (and say nothing about whether the account existed).
  return made === 'exists' ? { status: 200, body: { ok: true } } : { status: 502, body: { error: 'We couldn’t set up your account. Please try again.' } };
}

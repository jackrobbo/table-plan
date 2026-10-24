import { AuthApiError, AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthUnavailableError } from '@/lib/db';
import { createSupabaseBackend } from '@/lib/db/supabase';
import { emptyProfile } from '@/lib/profile';
import { clearStatus, getStatus, setStatus } from '@/lib/status';

type Listener = (event: string) => void;
function stub(opts: { session?: unknown; error?: unknown; upsert?: () => Promise<{ error: { message: string } | null }> }) {
  const listeners = new Set<Listener>();
  const client = {
    auth: {
      getSession: async () => ({ data: { session: opts.session ?? null }, error: opts.error ?? null }),
      signOut: async () => { listeners.forEach((l) => l('SIGNED_OUT')); },
      onAuthStateChange: (cb: Listener) => { listeners.add(cb); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }; },
    },
    from: () => ({ upsert: opts.upsert ?? (async () => ({ error: null })) }),
  } as unknown as SupabaseClient;
  return { client, emit: (e: string) => listeners.forEach((l) => l(e)) };
}

beforeEach(() => { clearStatus('offline'); clearStatus('save-failed'); });

describe('staying signed in', () => {
  it('returns the session when there is one', async () => {
    const { client } = stub({ session: { user: { id: 'u1', email: 'a@b.co' } } });
    expect(await createSupabaseBackend(client).auth.getSession()).toEqual({ userId: 'u1', email: 'a@b.co' });
  });

  it('treats "no session" as signed out', async () => {
    const { client } = stub({});
    expect(await createSupabaseBackend(client).auth.getSession()).toBeNull();
    const revoked = stub({ error: new AuthApiError('Invalid Refresh Token: Already Used', 400, 'refresh_token_already_used') });
    expect(await createSupabaseBackend(revoked.client).auth.getSession()).toBeNull();
  });

  it('does not treat a failed renewal with no signal as signed out', async () => {
    const { client } = stub({ error: new AuthRetryableFetchError('network down', 0) });
    await expect(createSupabaseBackend(client).auth.getSession()).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it('tells the app when the session ends elsewhere, but not when the person signs out here', async () => {
    const { client, emit } = stub({});
    const auth = createSupabaseBackend(client).auth;
    const ended = vi.fn();
    const off = auth.onSignedOut(ended);
    emit('TOKEN_REFRESHED');
    expect(ended).not.toHaveBeenCalled();
    emit('SIGNED_OUT');
    expect(ended).toHaveBeenCalledTimes(1);
    await auth.signOut();
    expect(ended).toHaveBeenCalledTimes(1);
    off();
    emit('SIGNED_OUT');
    expect(ended).toHaveBeenCalledTimes(1);
  });
});

describe('saves that fail are not silent', () => {
  it('flags a failed save, and clears the flag on the next good one', async () => {
    let fail = true;
    const { client } = stub({ upsert: async () => (fail ? { error: { message: 'JWT expired' } } : { error: null }) });
    const repo = createSupabaseBackend(client).profiles;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await repo.save('u1', emptyProfile());
    expect(getStatus()).toEqual({ kind: 'save-failed' });
    fail = false;
    await repo.save('u1', emptyProfile());
    expect(getStatus()).toBeNull();
  });

  it('a good save does not hide an offline notice', async () => {
    const { client } = stub({});
    setStatus({ kind: 'offline' });
    await createSupabaseBackend(client).profiles.save('u1', emptyProfile());
    expect(getStatus()).toEqual({ kind: 'offline' });
  });
});

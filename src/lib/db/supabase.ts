import { createClient, isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import type { Recipe } from '@/data';
import { createSupabaseBilling } from '../billing/supabase';
import { profileToRow, rowToProfile } from './profileRow';
import { clearStatus, setStatus } from '../status';
import { AuthUnavailableError, type AccountService, type AuthService, type Backend, type ProfileRepo, type RecipeRepo, type Session } from './types';

const toSession = (s: { user: { id: string; email?: string | null } } | null): Session | null =>
  s ? { userId: s.user.id, email: s.user.email ?? '' } : null;

export const NO_ACCOUNT = 'We couldn’t find an account for that email. New here? Go back and choose “Create my plan”.';

export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
}

/** Real backend: Supabase Auth (email OTP) + Postgres with row-level security. Billing reads the Stripe-fed `subscriptions` table. */
export function createSupabaseBackend(sb: SupabaseClient): Backend {
  let signingOut = false;   // our own sign-out is not an "unexpected" one
  const auth: AuthService = {
    async sendCode(email) {
      // Never creates accounts: new accounts are made by /api/auth/signup (invite check), and Supabase's public sign-up is off.
      const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
      if (!error) return;
      if (error.status === 429) throw new Error('Too many codes requested. Wait a minute and try again.');
      if (error.code === 'otp_disabled' || /signups? not allowed/i.test(error.message)) throw new Error(NO_ACCOUNT);
      throw new Error(error.message);
    },
    async verifyCode(email, code) {
      const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
      if (error || !data.session) throw new Error('That code is not right, or it has expired.');
      return toSession(data.session)!;
    },
    async getSession() {
      const { data, error } = await sb.auth.getSession();
      // An expired access token that can't be renewed because there's no signal is not the same as being signed out:
      // the refresh token is still stored and works once we're back online.
      if (!data.session && error && isAuthRetryableFetchError(error)) throw new AuthUnavailableError();
      return toSession(data.session);
    },
    async signOut() {
      signingOut = true;
      try { await sb.auth.signOut(); } finally { signingOut = false; }
    },
    onSignedOut(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT' && !signingOut) cb(); });
      return () => data.subscription.unsubscribe();
    },
  };

  // Saves are queued so rapid edits can't land out of order.
  let queue: Promise<unknown> = Promise.resolve();
  const profiles: ProfileRepo = {
    async load(userId) {
      const { data, error } = await sb.from('profiles').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToProfile(data) : null;
    },
    save(userId, p) {
      const run = queue.then(async () => {
        try {
          const { error } = await sb.from('profiles').upsert(profileToRow(userId, p), { onConflict: 'user_id' });
          if (error) { console.error('profile save failed', error.message); setStatus({ kind: 'save-failed' }); } else clearStatus('save-failed');
        } catch (e) {
          console.error('profile save failed', e);
          setStatus({ kind: 'save-failed' });
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
    async erase(userId) {
      await queue;
      const { error } = await sb.from('profiles').delete().eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
  };

  const recipes: RecipeRepo = {
    async listLive() {
      const { data, error } = await sb.from('recipes').select('*, recipe_ingredients(*)').eq('status', 'live').order('slug');
      if (error) throw new Error(error.message);
      return (data ?? []).map((r): Recipe => ({
        id: r.slug, c: r.course, e: r.emoji ?? '🍽️', n: r.name, p: Number(r.protein_g), k: r.kcal, serves: r.serves, m: r.method,
        allergens: r.allergens, macros_only: r.macros_only, cost: r.cost_pence ?? null, b: r.budget ?? null, ...(r.image_alt && r.image_colour ? { img: { a: r.image_alt, c: r.image_colour } } : {}),
        fresh: r.recipe_ingredients.filter((l: { cupboard: boolean }) => !l.cupboard).map((l: { ingredient_slug: string; qty: number }) => [l.ingredient_slug, Number(l.qty)]),
        cup: r.recipe_ingredients.filter((l: { cupboard: boolean }) => l.cupboard).map((l: { ingredient_slug: string }) => l.ingredient_slug),
      }));
    },
  };

  const token = async () => (await sb.auth.getSession()).data.session?.access_token ?? '';
  const account: AccountService = {
    async exportData() {
      const r = await fetch('/api/account/export', { headers: { authorization: `Bearer ${await token()}` } });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not prepare your data. Try again.');
      return JSON.stringify(await r.json(), null, 2);
    },
    async deleteAccount() {
      const r = await fetch('/api/account', { method: 'DELETE', headers: { authorization: `Bearer ${await token()}` } });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not delete your account. Try again.');
      // The login no longer exists on the server; clear this device's copy of the session.
      signingOut = true;
      try { await sb.auth.signOut({ scope: 'local' }); } finally { signingOut = false; }
    },
  };

  return { auth, profiles, recipes, billing: createSupabaseBilling(sb), account };
}

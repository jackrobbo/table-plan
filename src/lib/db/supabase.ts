import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Recipe } from '@/data';
import { createSupabaseBilling } from '../billing/supabase';
import { profileToRow, rowToProfile } from './profileRow';
import type { AuthService, Backend, ProfileRepo, RecipeRepo, Session } from './types';

const toSession = (s: { user: { id: string; email?: string | null } } | null): Session | null =>
  s ? { userId: s.user.id, email: s.user.email ?? '' } : null;

export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
}

/** Real backend: Supabase Auth (email OTP) + Postgres with row-level security. Billing reads the Stripe-fed `subscriptions` table. */
export function createSupabaseBackend(sb: SupabaseClient): Backend {
  const auth: AuthService = {
    async sendCode(email) {
      const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
      if (error) throw new Error(error.status === 429 ? 'Too many codes requested. Wait a minute and try again.' : error.message);
    },
    async verifyCode(email, code) {
      const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
      if (error || !data.session) throw new Error('That code is not right, or it has expired.');
      return toSession(data.session)!;
    },
    async getSession() {
      const { data } = await sb.auth.getSession();
      return toSession(data.session);
    },
    async signOut() { await sb.auth.signOut(); },
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
        const { error } = await sb.from('profiles').upsert(profileToRow(userId, p), { onConflict: 'user_id' });
        if (error) console.error('profile save failed', error.message);
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

  return { auth, profiles, recipes, billing: createSupabaseBilling(sb) };
}

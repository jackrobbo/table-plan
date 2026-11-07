import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WaitlistStore } from '../beta/waitlist';
import type { ServerUser, SubscriptionStore } from '../billing/server';
import type { Subscription } from '../billing/types';
import type { AccountStore } from './account';
import type { SignupStore } from './signup';
import type { RunRecord } from '../pricing/health';
import { shapeSnapshot, type PriceSnapshot } from '../pricing/snapshot';
import type { FeedDb } from './feed';
import type { RateStore } from './guard';
import { fileWaitlistStore } from './waitlistFile';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Service-role client (bypasses RLS). Server-only: SUPABASE_SERVICE_ROLE_KEY must never be exposed to the browser. */
function admin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return URL_ && key ? createClient(URL_, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

/** The signed-in user, from the Supabase access token the browser sends as `Authorization: Bearer ...`. */
export async function getServerUser(req: Request): Promise<ServerUser | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !URL_ || !ANON) return null;
  const { data, error } = await createClient(URL_, ANON, { auth: { persistSession: false } }).auth.getUser(token);
  return error || !data.user?.email ? null : { id: data.user.id, email: data.user.email };
}

export function getSubscriptionStore(): SubscriptionStore | null {
  const sb = admin();
  if (!sb) return null;
  return {
    async seen(eventId) {
      const { data } = await sb.from('stripe_events').select('id').eq('id', eventId).maybeSingle();
      return !!data;
    },
    async save(userId: string, s: Subscription, eventId: string) {
      const { error } = await sb.from('subscriptions').upsert({
        user_id: userId, stripe_customer_id: s.stripeCustomerId ?? null, status: s.status, plan: s.plan,
        trial_ends_at: s.trialEndsAt, current_period_end: s.currentPeriodEnd, cancel_at_period_end: s.cancelAtPeriodEnd, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      // 23503 = the user no longer exists (they deleted their account; Stripe still reports the subscription ending).
      // Nothing to record, and failing would only make Stripe retry for days.
      if (error && error.code !== '23503') throw new Error(error.message);
      await sb.from('stripe_events').insert({ id: eventId });
    },
  };
}

export async function getStripeCustomerId(user: ServerUser): Promise<string | undefined> {
  const sb = admin();
  if (!sb) return undefined;
  const { data } = await sb.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  return data?.stripe_customer_id ?? undefined;
}

/** Local dev can use WAITLIST_FILE; otherwise the waitlist is a Supabase insert (idempotent on email). */
export function getWaitlistStore(): WaitlistStore | null {
  if (process.env.WAITLIST_FILE) return fileWaitlistStore(process.env.WAITLIST_FILE);
  const sb = admin();
  if (!sb) return null;
  return {
    async add(e) {
      const { error } = await sb.from('waitlist').upsert({ email: e.email, source: e.source, consent_at: e.consentAt }, { onConflict: 'email', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    },
  };
}

/** Account creation for the invite gate: atomic single-use redemption via the `redeem_invite` SQL function, then a confirmed login. */
export function getSignupStore(): SignupStore | null {
  const sb = admin();
  if (!sb) return null;
  return {
    async redeem(code, email) {
      const { data, error } = await sb.rpc('redeem_invite', { p_code: code, p_email: email });
      return !error && data === true;
    },
    async release(code, email) {
      await sb.from('invites').update({ email: null, redeemed_at: null }).eq('code', code).eq('email', email);
    },
    async createUser(email) {
      const { error } = await sb.auth.admin.createUser({ email, email_confirm: true });
      if (!error) return 'created';
      if (!(error.code === 'email_exists' || /already (been )?registered/i.test(error.message))) return 'failed';
      await confirmExisting(sb, email);
      return 'exists';
    },
  };
}

/**
 * An account started under the old open sign-up and never confirmed can't be sent a sign-in code now that Supabase's public sign-up is
 * off (it is treated as a sign-up). Confirming it here is safe: the code still goes to the inbox, so only its owner gets in.
 */
async function confirmExisting(sb: SupabaseClient, email: string): Promise<void> {
  try {
    const { data } = await sb.auth.admin.generateLink({ type: 'magiclink', email });
    const user = data?.user;
    if (user && !user.email_confirmed_at) await sb.auth.admin.updateUserById(user.id, { email_confirm: true });
  } catch { /* the sign-in code step reports a real problem */ }
}

export async function saveFeedback(user: ServerUser | null, msg: { message: string; page: string }): Promise<boolean> {
  const sb = admin();
  if (!sb || !user) return false;
  const { error } = await sb.from('feedback').insert({ user_id: user.id, message: msg.message, page: msg.page });
  return !error;
}

/** Export and erasure for the signed-in person. Server-only: uses the service role. */
export function getAccountStore(): AccountStore | null {
  const sb = admin();
  if (!sb) return null;
  const must = (what: string, error: { message: string } | null) => { if (error) throw new Error(`${what}: ${error.message}`); };
  return {
    async stripeCustomerId(userId) {
      const { data } = await sb.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
      return data?.stripe_customer_id ?? undefined;
    },
    async exportData(user) {
      const email = user.email.toLowerCase();
      const [profile, sub, feedback, waitlist, invite] = await Promise.all([
        sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
        sb.from('subscriptions').select('status, plan, trial_ends_at, current_period_end, cancel_at_period_end, stripe_customer_id, updated_at').eq('user_id', user.id).maybeSingle(),
        sb.from('feedback').select('message, page, created_at').eq('user_id', user.id).order('created_at'),
        sb.from('waitlist').select('email, source, consent_at').eq('email', email).maybeSingle(),
        sb.from('invites').select('redeemed_at').eq('email', email).maybeSingle(),
      ]);
      for (const [what, r] of [['profile', profile], ['subscription', sub], ['feedback', feedback], ['waitlist', waitlist], ['invite', invite]] as const) must(what, r.error);
      return { profile: profile.data, subscription: sub.data, feedback: feedback.data ?? [], waitlist: waitlist.data, invite: invite.data };
    },
    async deleteData(user) {
      const email = user.email.toLowerCase();
      must('feedback', (await sb.from('feedback').delete().eq('user_id', user.id)).error);
      const { data: wl, error: wlErr } = await sb.from('waitlist').select('id').eq('email', email).maybeSingle();
      must('waitlist', wlErr);
      if (wl) {
        must('invites', (await sb.from('invites').update({ waitlist_id: null }).eq('waitlist_id', wl.id)).error);
        must('waitlist', (await sb.from('waitlist').delete().eq('id', wl.id)).error);
      }
      // The code stays used (it can't be redeemed again) but no longer points at a person.
      must('invites', (await sb.from('invites').update({ email: null }).eq('email', email)).error);
    },
    async deleteUser(userId) {
      const { error } = await sb.auth.admin.deleteUser(userId);
      if (error && error.status !== 404) throw new Error(error.message);
    },
  };
}

/** Shared request counter in Postgres (`rate_limit_hit`), so limits hold across serverless instances. */
export function getRateStore(): RateStore | null {
  const sb = admin();
  if (!sb) return null;
  return {
    async hit(key, limit, windowSeconds) {
      const { data, error } = await sb.rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
      if (error) throw new Error(error.message);
      return data === true;
    },
  };
}

/** The latest price book for a store, read with the service role (the price tables have no browser access). Null when the database is not configured. */
export interface PriceStore { snapshot(store: string): Promise<PriceSnapshot | null> }
export function getPriceStore(): PriceStore | null {
  const sb = admin();
  if (!sb) return null;
  return {
    async snapshot(store) {
      const [products, prices, costs] = await Promise.all([
        sb.from('store_products').select('ingredient_slug, product_ref, pack_size').eq('store', store),
        sb.from('latest_prices').select('product_ref, price_pence, was_price_pence, in_stock, priced_at').eq('store', store),
        sb.from('recipe_costs').select('recipe_slug, cost_pence, budget_tier, complete').eq('store', store),
      ]);
      for (const r of [products, prices, costs]) if (r.error) throw new Error(r.error.message);
      return shapeSnapshot({ store, products: products.data ?? [], prices: prices.data ?? [], costs: costs.data ?? [] });
    },
  };
}

/** Database access for the weekly price job (service role; the price tables have no browser access). Null when the database is not configured. */
export function getFeedDb(): FeedDb | null {
  const sb = admin();
  if (!sb) return null;
  const must = (what: string, e: { message: string } | null) => { if (e) throw new Error(`${what}: ${e.message}`); };
  return {
    async targets(store) {
      const [prods, prices] = await Promise.all([
        sb.from('store_products').select('ingredient_slug, product_ref, url').eq('store', store),
        sb.from('latest_prices').select('product_ref, price_pence, pack_text').eq('store', store),
      ]);
      must('store_products', prods.error); must('latest_prices', prices.error);
      const last = new Map((prices.data ?? []).map((p) => [p.product_ref as string, p]));
      return (prods.data ?? []).filter((p) => p.url).map((p) => ({ slug: p.ingredient_slug as string, ref: p.product_ref as string, url: p.url as string, lastPricePence: (last.get(p.product_ref as string)?.price_pence as number | undefined) ?? null, lastPackText: (last.get(p.product_ref as string)?.pack_text as string | undefined) ?? null }));
    },
    async createRun(store, expected, notes) {
      const { data, error } = await sb.from('price_runs').insert({ source: 'yappman', stores: [store], status: 'running', rows_expected: expected, notes }).select('id').single();
      must('price_runs', error);
      return data!.id as string;
    },
    async getRun(id) {
      const { data, error } = await sb.from('price_runs').select('id, status, stores').eq('id', id).maybeSingle();
      must('price_runs', error);
      return data ? { id: data.id as string, status: data.status as string, stores: data.stores as string[] } : null;
    },
    async saveRows(runId, rows) {
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200).map((r) => ({
          run_id: runId, store: r.store, product_ref: r.productRef, price_pence: r.pricePence, was_price_pence: r.wasPricePence, loyalty_price_pence: r.loyaltyPricePence,
          promo_text: r.promoText, in_stock: r.inStock, pack_text: r.packSize, priced_at: r.pricedAt ?? new Date().toISOString(), held: r.held, hold_reason: r.holdReason,
        }));
        must('store_prices', (await sb.from('store_prices').insert(chunk)).error);
      }
    },
    async finishRun(id, f) {
      must('price_runs', (await sb.from('price_runs').update({ status: f.status, finished_at: new Date().toISOString(), rows_received: f.rowsReceived, rows_held: f.rowsHeld, notes: f.notes }).eq('id', id)).error);
    },
    async currentPrices(store) {
      const [prods, prices] = await Promise.all([
        sb.from('store_products').select('ingredient_slug, product_ref').eq('store', store),
        sb.from('latest_prices').select('product_ref, price_pence, was_price_pence').eq('store', store),
      ]);
      must('store_products', prods.error); must('latest_prices', prices.error);
      const p = new Map((prices.data ?? []).map((x) => [x.product_ref as string, (x.was_price_pence ?? x.price_pence) as number]));
      const out: Record<string, number> = {};
      for (const sp of prods.data ?? []) { const v = p.get(sp.product_ref as string); if (v) out[sp.ingredient_slug as string] = v; }
      return out;
    },
    async saveCosts(store, runId, costs) {
      const asOf = new Date().toISOString();
      for (let i = 0; i < costs.length; i += 200) {
        const chunk = costs.slice(i, i + 200).map((c) => ({ store, recipe_slug: c.slug, cost_pence: c.cost, budget_tier: c.tier, complete: c.cost != null, missing: c.missing, run_id: runId, as_of: asOf }));
        must('recipe_costs', (await sb.from('recipe_costs').upsert(chunk, { onConflict: 'store,recipe_slug' })).error);
      }
    },
  };
}

/** The last 10 days of price runs, for the feed health check. Null without the service role key. */
export function getFeedRunsLoader(): (() => Promise<RunRecord[]>) | null {
  const sb = admin();
  if (!sb) return null;
  return async () => {
    const since = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const { data, error } = await sb.from('price_runs').select('id, stores, status, started_at, finished_at, rows_expected, rows_received, rows_held, notes').gte('started_at', since).order('started_at', { ascending: false });
    if (error) throw new Error(`price_runs: ${error.message}`);
    return (data ?? []) as RunRecord[];
  };
}

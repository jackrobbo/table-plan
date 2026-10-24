/**
 * Product analytics seam. Off unless the user has opted in AND a provider is registered.
 * Events carry only coarse, non-identifying values: never email, name, stats (height/weight/age/sex),
 * allergies or free text. `sanitise` enforces that so a careless call site can't leak health data.
 */
export type EventName =
  | 'onboarding_step' | 'onboarding_done' | 'week_generated' | 'week_planned' | 'list_saved'
  | 'paywall_viewed' | 'subscribed' | 'reminder_enabled' | 'signup_invite_redeemed'
  | 'install_prompt_shown' | 'install_prompt_accepted' | 'install_prompt_dismissed' | 'basket_fill_started';

type Props = Record<string, string | number | boolean>;
const SAFE_KEYS = new Set(['step', 'plan', 'days_in_band', 'days', 'items', 'mode', 'week_state', 'source', 'trial', 'platform', 'packs']);

export function sanitise(props: Record<string, unknown> = {}): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (!SAFE_KEYS.has(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && v.length <= 24 && !v.includes('@')) out[k] = v;
  }
  return out;
}

export type Provider = (name: EventName, props: Props) => void;
let provider: Provider | null = null;
let consent = false;

export const registerAnalytics = (p: Provider | null) => { provider = p; };
export const setAnalyticsConsent = (on: boolean) => { consent = on; };

export function track(name: EventName, props?: Record<string, unknown>) {
  if (!consent || !provider) return;
  try { provider(name, sanitise(props)); } catch { /* analytics must never break the app */ }
}

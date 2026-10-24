/**
 * Content-Security-Policy for the app (everything except the static /poc prototype and the API routes).
 *
 * Scripts: only ours (`'self'`) and those carrying this request's nonce, plus whatever those load (`'strict-dynamic'`). That is
 * what stops an injected script running even if one ever got into the page. Inline *styles* stay allowed because React's
 * `style={...}` attributes need it and a style can't run code.
 */
export interface CspOptions { nonce: string; dev?: boolean; supabaseUrl?: string }

export function buildCsp({ nonce, dev = false, supabaseUrl }: CspOptions): string {
  const connect = ["'self'"];
  if (supabaseUrl) {
    try {
      const u = new URL(supabaseUrl);
      connect.push(u.origin, `${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}`);
    } catch { /* an unusable URL just means no extra origin */ }
  }
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': connect,
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const body = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
  return dev ? body : `${body}; upgrade-insecure-requests`;
}

/** The legacy single-page prototype at /poc loads Google Fonts and runs one inline script, so it gets its own, looser, policy. */
export const POC_CSP = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: https:", "connect-src 'self'",
  "frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'",
].join('; ');

/** Headers that don't depend on the request. Applied to every route by next.config.mjs. */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

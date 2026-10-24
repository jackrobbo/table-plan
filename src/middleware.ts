import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@/lib/security/csp';

/** Gives every page request its own script nonce and the matching Content-Security-Policy (see lib/security/csp.ts). */
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV !== 'production', supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
  // Next reads the nonce from the request's CSP header and puts it on its own inline scripts.
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [{
    source: '/((?!api|_next/static|_next/image|icons|logos|meals|poc|favicon.ico|manifest.webmanifest).*)',
    missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }],
  }],
};

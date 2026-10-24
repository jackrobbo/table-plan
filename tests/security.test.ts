import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';
import { POC_CSP, SECURITY_HEADERS, buildCsp } from '@/lib/security/csp';

const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(name + ' '))?.slice(name.length + 1).split(' ') ?? [];

describe('content security policy', () => {
  const csp = buildCsp({ nonce: 'abc123', supabaseUrl: 'https://proj.supabase.co' });

  it('only runs our scripts and nonce-marked ones, never inline or eval', () => {
    const s = directive(csp, 'script-src');
    expect(s).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(s).not.toContain("'unsafe-inline'");
  });

  it('cannot be framed, embed plugins, or change where relative URLs point', () => {
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'frame-src')).toEqual(["'none'"]);
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('lets the browser talk to this site and our Supabase project, and nowhere else', () => {
    expect(directive(csp, 'connect-src')).toEqual(["'self'", 'https://proj.supabase.co', 'wss://proj.supabase.co']);
    expect(directive(buildCsp({ nonce: 'x' }), 'connect-src')).toEqual(["'self'"]);
    expect(directive(buildCsp({ nonce: 'x', supabaseUrl: 'not a url' }), 'connect-src')).toEqual(["'self'"]);
    expect(directive(csp, 'img-src')).toEqual(["'self'", 'data:', 'blob:']);
  });

  it('allows eval only while developing (Next needs it for hot reload)', () => {
    const dev = buildCsp({ nonce: 'x', dev: true });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(dev).not.toContain('upgrade-insecure-requests');
  });

  it('keeps the static prototype on its own policy, still unframeable', () => {
    expect(POC_CSP).toContain("frame-ancestors 'none'");
    expect(POC_CSP).toContain('fonts.googleapis.com');
  });
});

describe('response headers', () => {
  it('sends the fixed hardening headers on every route', () => {
    const h = Object.fromEntries(SECURITY_HEADERS.map((x) => [x.key, x.value]));
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Permissions-Policy']).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/);
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });

  it('gives each page request its own nonce, in the policy and passed on to the page', () => {
    const a = middleware(new NextRequest('https://table-plan-app.vercel.app/plan'));
    const b = middleware(new NextRequest('https://table-plan-app.vercel.app/plan'));
    const nonce = (r: Response) => /'nonce-([^']+)'/.exec(r.headers.get('content-security-policy') ?? '')?.[1];
    expect(nonce(a)).toBeTruthy();
    expect(nonce(a)).not.toBe(nonce(b));
    expect(a.headers.get('x-middleware-request-x-nonce')).toBe(nonce(a));
  });
});

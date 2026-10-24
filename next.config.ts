import type { NextConfig } from 'next';
import { POC_CSP, SECURITY_HEADERS } from './src/lib/security/csp';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/poc', destination: '/poc/index.html' }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      // Pages get their CSP (with a per-request nonce) from src/middleware.ts; the static prototype has its own.
      { source: '/poc', headers: [{ key: 'Content-Security-Policy', value: POC_CSP }] },
      { source: '/poc/:path*', headers: [{ key: 'Content-Security-Policy', value: POC_CSP }] },
    ];
  },
};
export default config;

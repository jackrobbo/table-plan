import { createMockBackend } from './mock';
import type { Backend, KV } from './types';

const memory = (): KV => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

let backend: Backend | null = null;

/**
 * Single seam for persistence. Mocked for now (localStorage in the browser).
 * Swap in the Supabase implementation of Backend here once a project exists —
 * schema is in supabase/migrations.
 */
export function getBackend(): Backend {
  if (!backend) {
    let kv: KV;
    try { kv = typeof window !== 'undefined' ? window.localStorage : memory(); } catch { kv = memory(); }
    backend = createMockBackend(kv);
  }
  return backend;
}
export const isMocked = true;
export * from './types';
export { MOCK_CODE } from './mock';

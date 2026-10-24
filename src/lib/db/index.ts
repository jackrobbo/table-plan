import { createMockBackend } from './mock';
import { createSupabaseBackend, createSupabaseClient } from './supabase';
import type { Backend, KV } from './types';

const memory = (): KV => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

let backend: Backend | null = null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** True when no Supabase project is configured, so the app runs on the localStorage mock (previews, tests). */
export const isMocked = !SUPABASE_URL || !SUPABASE_KEY;

/** Single seam for persistence: Supabase when NEXT_PUBLIC_SUPABASE_URL/_PUBLISHABLE_KEY are set, otherwise the mock. */
export function getBackend(): Backend {
  if (!backend) {
    let kv: KV;
    try { kv = typeof window !== 'undefined' ? window.localStorage : memory(); } catch { kv = memory(); }
    backend = isMocked ? createMockBackend(kv) : createSupabaseBackend(createSupabaseClient(SUPABASE_URL!, SUPABASE_KEY!));
  }
  return backend;
}
export * from './types';
export { MOCK_CODE } from './mock';

/** Unambiguous alphabet (no 0/O, 1/I/L) so codes survive being read out or typed from a screenshot. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUPS = 3, GROUP_LEN = 4;

export const normaliseCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** "TABL-E4X7-K2MP" style, 12 characters from a CSPRNG-backed `rand` (default: crypto). */
export function generateCode(rand: (n: number) => number = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n): string {
  return Array.from({ length: GROUPS }, () => Array.from({ length: GROUP_LEN }, () => ALPHABET[rand(ALPHABET.length)]).join('')).join('-');
}

export function generateCodes(n: number, rand?: (n: number) => number): string[] {
  const out = new Set<string>();
  while (out.size < n) out.add(generateCode(rand));
  return [...out];
}

export const looksLikeCode = (s: string) => normaliseCode(s).length === GROUPS * GROUP_LEN && [...normaliseCode(s)].every((c) => ALPHABET.includes(c));

export interface InviteStore {
  /** Atomically marks an unused code as used by this email. Returns false if unknown or already used. */
  redeem(code: string, email: string): Promise<boolean>;
}

export type RedeemResult = { ok: true } | { ok: false; reason: 'invalid' | 'used' | 'unavailable' };

export async function redeemInvite(store: InviteStore | null, rawCode: string, email: string): Promise<RedeemResult> {
  if (!store) return { ok: false, reason: 'unavailable' };
  const code = normaliseCode(rawCode);
  if (code.length !== GROUPS * GROUP_LEN) return { ok: false, reason: 'invalid' };
  return (await store.redeem(code, email.trim().toLowerCase())) ? { ok: true } : { ok: false, reason: 'used' };
}

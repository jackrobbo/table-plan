import { RECIPES } from '@/data';
import { createMockBilling } from '../billing/mock';
import { emptyProfile, type Profile } from '../profile';
import type { AccountService, AuthService, Backend, KV, ProfileRepo, RecipeRepo, Session } from './types';

/** The fixed OTP accepted by the mock backend. Shown in the UI while mocked. */
export const MOCK_CODE = '123456';
const SESSION_KEY = 'tp.session';
const profileKey = (uid: string) => `tp.profile.${uid}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const userIdFor = (email: string) => 'mock_' + email.trim().toLowerCase();

export function createMockBackend(kv: KV): Backend {
  let pendingEmail: string | null = null;

  const auth: AuthService = {
    async sendCode(email) {
      if (!EMAIL_RE.test(email.trim())) throw new Error('Enter a valid email address.');
      pendingEmail = email.trim().toLowerCase();
    },
    async verifyCode(email, code) {
      if (pendingEmail !== email.trim().toLowerCase()) throw new Error('Request a new code first.');
      if (code !== MOCK_CODE) throw new Error('That code is not right.');
      const session: Session = { userId: userIdFor(email), email: pendingEmail };
      kv.setItem(SESSION_KEY, JSON.stringify(session));
      pendingEmail = null;
      return session;
    },
    async getSession() {
      const raw = kv.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    },
    async signOut() { kv.removeItem(SESSION_KEY); },
    onSignedOut() { return () => undefined; },
  };

  const profiles: ProfileRepo = {
    async load(uid) {
      const raw = kv.getItem(profileKey(uid));
      if (!raw) return null;
      // Merge over defaults so profiles saved by older builds still load.
      return { ...emptyProfile(), ...(JSON.parse(raw) as Partial<Profile>) };
    },
    async save(uid, p) { kv.setItem(profileKey(uid), JSON.stringify(p)); },
    async erase(uid) { kv.removeItem(profileKey(uid)); },
  };

  const recipes: RecipeRepo = { async listLive() { return RECIPES; } };

  const billing = createMockBilling(kv);
  const account: AccountService = {
    async exportData(uid) {
      const session = JSON.parse(kv.getItem(SESSION_KEY) ?? 'null') as Session | null;
      return JSON.stringify({ exportedAt: new Date().toISOString(), account: { id: uid, email: session?.email ?? null }, profile: await profiles.load(uid), subscription: await billing.get(uid) }, null, 2);
    },
    async deleteAccount(uid) {
      kv.removeItem(profileKey(uid));
      kv.removeItem(`tp.sub.${uid}`);
      kv.removeItem(SESSION_KEY);
    },
  };

  return { auth, profiles, recipes, billing, account };
}

import type { Recipe } from '@/data';
import type { BillingService } from '../billing/types';
import type { Profile } from '../profile';

export interface Session { userId: string; email: string }

/** Thrown by `getSession` when we can't tell whether someone is signed in (no connection), as opposed to knowing they aren't. */
export class AuthUnavailableError extends Error {
  constructor() { super('Can’t reach the server.'); this.name = 'AuthUnavailableError'; }
}

export interface AuthService {
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<Session>;
  /** The current session, or null if signed out. Rejects with `AuthUnavailableError` if it can't be checked right now. */
  getSession(): Promise<Session | null>;
  signOut(): Promise<void>;
  /** Called when the session ends without the person asking (another tab signed out, or it could no longer be renewed). Returns an unsubscribe. */
  onSignedOut(cb: () => void): () => void;
}

export interface ProfileRepo {
  load(userId: string): Promise<Profile | null>;
  save(userId: string, profile: Profile): Promise<void>;
  /** GDPR erasure: removes the profile (and in the real backend, the account). */
  erase(userId: string): Promise<void>;
}

/** Read side of the recipe bank. Real backend queries `recipes where status = 'live'`. */
export interface RecipeRepo { listLive(): Promise<Recipe[]> }

export interface Backend { auth: AuthService; profiles: ProfileRepo; recipes: RecipeRepo; billing: BillingService }

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

import type { Recipe } from '@/data';
import type { Profile } from '../profile';

export interface Session { userId: string; email: string }

export interface AuthService {
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<Session>;
  getSession(): Promise<Session | null>;
  signOut(): Promise<void>;
}

export interface ProfileRepo {
  load(userId: string): Promise<Profile | null>;
  save(userId: string, profile: Profile): Promise<void>;
  /** GDPR erasure: removes the profile (and in the real backend, the account). */
  erase(userId: string): Promise<void>;
}

/** Read side of the recipe bank. Real backend queries `recipes where status = 'live'`. */
export interface RecipeRepo { listLive(): Promise<Recipe[]> }

export interface Backend { auth: AuthService; profiles: ProfileRepo; recipes: RecipeRepo }

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

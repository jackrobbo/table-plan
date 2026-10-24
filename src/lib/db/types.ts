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

export interface Backend { auth: AuthService; profiles: ProfileRepo }

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

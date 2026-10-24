// In-memory router for the single-file preview build (stands in for next/navigation).
import { useSyncExternalStore } from 'react';
let path = '/';
const subs = new Set<() => void>();
export const navigate = (to: string) => { path = to.split('?')[0]; subs.forEach((f) => f()); window.scrollTo(0, 0); };
export const usePath = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => path, () => path);
export const useRouter = () => ({ push: navigate, replace: navigate, back: () => navigate('/') });
export const usePathname = usePath;

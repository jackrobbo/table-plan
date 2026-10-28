import { STORE_LOGOS } from '@/lib/logos';
import { STORES, DEFAULT_STORE, type Store } from '@/lib/stores';

/** Swaps between the light and dark logo with the app theme (system setting or explicit data-theme). A store without a logo shows its name. */
export default function MorrisonsLogo({ height = 28, store = STORES[DEFAULT_STORE] }: { height?: number; store?: Store }) {
  const logo = STORE_LOGOS[store.id];
  if (!logo) return <span className="retailer-name" style={{ height, lineHeight: `${height}px` }}>{store.name}</span>;
  return (
    <span className="retailer-logo" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-light" src={logo.light} alt={store.name} height={height} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-dark" src={logo.dark} alt="" aria-hidden height={height} />
    </span>
  );
}

import { MORRISONS_LOGO } from '@/lib/logos';

/** Swaps between the light and dark logo with the app theme (system setting or explicit data-theme). */
export default function MorrisonsLogo({ height = 28 }: { height?: number }) {
  return (
    <span className="retailer-logo" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-light" src={MORRISONS_LOGO.light} alt="Morrisons" height={height} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-dark" src={MORRISONS_LOGO.dark} alt="" aria-hidden height={height} />
    </span>
  );
}

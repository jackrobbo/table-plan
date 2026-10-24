/** Small deterministic PRNG (mulberry32) so plans are reproducible from a seed. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick<T>(xs: readonly T[]): T { return xs[Math.floor(next() * xs.length)]; },
    /** Pick with probability proportional to `w(x)` (floored just above zero so nothing is impossible). */
    pickWeighted<T>(xs: readonly T[], w: (x: T) => number): T {
      const ws = xs.map((x) => Math.max(1e-6, w(x)));
      let r = next() * ws.reduce((a, b) => a + b, 0);
      for (let i = 0; i < xs.length; i++) { r -= ws[i]; if (r <= 0) return xs[i]; }
      return xs[xs.length - 1];
    },
    /** Random order where higher-weight items tend to come first (Efraimidis–Spirakis). */
    weightedShuffle<T>(xs: readonly T[], w: (x: T) => number): T[] {
      return xs.map((x) => ({ x, key: Math.pow(next(), 1 / Math.max(1e-6, w(x))) })).sort((a, b) => b.key - a.key).map((e) => e.x);
    },
    shuffle<T>(xs: readonly T[]): T[] {
      const a2 = xs.slice();
      for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; }
      return a2;
    },
  };
}

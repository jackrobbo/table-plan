import type { PlannedDay, Recipe, Targets } from "./types";
import { TOPUPS } from "./recipes";

const shuffle = <T>(a: T[]): T[] => {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

type Scored = PlannedDay & { score: number };

/**
 * Greedy, guardrail-checked planner. Fills Mon–Fri from the liked recipes,
 * keeping every day inside the calorie band and above the protein floor,
 * adding a top-up where it helps. If a day can't be satisfied it returns the
 * closest miss flagged `out: true` — days are flagged honestly, never faked.
 */
export function buildPlan(targets: Targets, liked: Recipe[]): PlannedDay[] {
  const T = targets;
  const pool = (c: string) => liked.filter((r) => r.c === c);
  const bf = pool("breakfast");
  const lu = pool("lunch");
  const sn = pool("snack");
  const dinnerPool = pool("dinner");

  const dinners = shuffle(dinnerPool).slice(0, 5);
  while (dinners.length < 5 && dinnerPool.length) {
    dinners.push(dinners[dinners.length % dinnerPool.length]);
  }

  const useCount: Record<string, number> = {};
  const days: PlannedDay[] = [];
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  for (let d = 0; d < 5; d++) {
    const din = dinners[d];
    let best: Scored | null = null;

    for (let t = 0; t < 400; t++) {
      const b = pick(bf);
      const l = pick(lu);
      const s = pick(sn);
      for (const tu of [null, ...TOPUPS]) {
        const P0 = b.p + l.p + s.p + din.p + (tu ? tu.p : 0);
        const K0 = b.k + l.k + s.k + din.k + (tu ? tu.k : 0);
        if (K0 < T.band[0] || K0 > T.band[1] || P0 < T.protein) continue;
        const rep = (useCount[b.id] || 0) + (useCount[l.id] || 0) + (useCount[s.id] || 0);
        const score = Math.abs((T.band[0] + T.band[1]) / 2 - K0) + rep * 40;
        if (!best || score < best.score) best = { b, l, s, din, tu, P: P0, K: K0, score };
      }
    }

    if (!best) {
      // Relax: take the closest miss and flag it honestly.
      for (let t = 0; t < 400; t++) {
        const b = pick(bf);
        const l = pick(lu);
        const s = pick(sn);
        const P0 = b.p + l.p + s.p + din.p;
        const K0 = b.k + l.k + s.k + din.k;
        const miss =
          Math.max(0, T.band[0] - K0) +
          Math.max(0, K0 - T.band[1]) +
          Math.max(0, T.protein - P0) * 8;
        if (!best || miss < best.score) best = { b, l, s, din, tu: null, P: P0, K: K0, score: miss, out: true };
      }
    }

    const chosen = best as Scored;
    [chosen.b, chosen.l, chosen.s].forEach((x) => {
      useCount[x.id] = (useCount[x.id] || 0) + 1;
    });
    days.push(chosen);
  }

  return days;
}

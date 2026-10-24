import type { PlannedDay } from "./types";
import { PRODUCTS } from "./products";
import { CUPBOARD_INFO } from "./cupboard";

export interface ShopLine {
  name: string;
  slug: string;
  cost: number; // pence
  note: string;
}
export interface Ledger {
  lines: ShopLine[];
  total: number; // pence
  cupboard: string[];
}

/**
 * Aggregate a week's fresh needs into a pack-aware Morrisons shop:
 * round each ingredient up to whole packs, price it, and note what it's for.
 * Dinners scale by household size; breakfasts/lunches/snacks are per-person.
 */
export function buildLedger(plan: PlannedDay[], hh: number): Ledger {
  const need: Record<string, number> = {};
  const usedBy: Record<string, Set<string>> = {};
  const cup = new Set<string>();

  const add = (prod: string, qty: number, who: string) => {
    need[prod] = (need[prod] || 0) + qty;
    (usedBy[prod] ||= new Set<string>()).add(who);
  };

  plan.forEach((d) => {
    [d.b, d.l, d.s].forEach((r) => {
      r.fresh.forEach(([pk, q]) => add(pk, q, r.n));
      r.cup.forEach((c) => cup.add(c));
    });
    const scale = hh === 2 ? 1 : 0.5;
    d.din.fresh.forEach(([pk, q]) => add(pk, q * scale, d.din.n));
    d.din.cup.forEach((c) => cup.add(c));
    if (d.tu) add(d.tu.prod, d.tu.qty, "top-ups");
  });

  let total = 0;
  const lines: ShopLine[] = Object.entries(need)
    .map(([pk, q]) => {
      const prod = PRODUCTS[pk];
      const packs = Math.max(1, Math.ceil(q / prod.pack));
      const cost = packs * prod.pr;
      total += cost;
      const bought = packs * prod.pack;
      const fmt = (v: number) =>
        prod.u === "g" || prod.u === "ml"
          ? Math.round(v) + prod.u
          : Math.round(v * 10) / 10 + " " + prod.u;
      const who = [...usedBy[pk]].slice(0, 3).join(", ");
      const note = bought - q > 0.01 ? `${fmt(q)} used of ${fmt(bought)} — ${who}` : who;
      return { name: prod.n + (packs > 1 ? ` ×${packs}` : ""), slug: prod.s, cost, note };
    })
    .sort((a, b) => b.cost - a.cost);

  return { lines, total, cupboard: [...cup].map((c) => CUPBOARD_INFO[c] || c) };
}

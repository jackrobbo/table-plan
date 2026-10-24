// Core domain types for Table Plan. Ported from the PoC data structures.

export type Course = "breakfast" | "lunch" | "snack" | "dinner";
export type Goal = "lose" | "maintain" | "gain";

/** A Morrisons SKU. Prices are in PENCE (integer). */
export interface Product {
  id: string;
  n: string; // shelf name
  pr: number; // price in pence
  pack: number; // pack size in `u`
  u: string; // unit (g, ml, eggs, wraps, …)
  s: string; // Morrisons product slug (…/<slug>/<id>)
}

/** A recipe. Macros are the EATER'S PORTION (per serving). */
export interface Recipe {
  id: string;
  c: Course;
  e: string; // emoji
  n: string; // name
  p: number; // protein g (per portion)
  k: number; // kcal (per portion)
  serves: number;
  fresh: Array<[productId: string, qty: number]>; // qty for the stated `serves`
  cup: string[]; // cupboard staple keys
  m: string[]; // method steps
}

/** A macro top-up the solver can add to close a gap. */
export interface Topup {
  n: string;
  p: number;
  k: number;
  prod: string; // product id
  qty: number;
}

export interface UserStats {
  sex: "" | "f" | "m";
  age: number;
  ht: number; // cm
  wt: number; // kg
  act: number; // activity multiplier
}

export interface Targets {
  target: number; // midpoint kcal
  band: [number, number]; // [lo, hi]
  protein: number; // floor (g)
  est: boolean; // true when using a default (no personal stats)
}

export interface PlannedDay {
  b: Recipe;
  l: Recipe;
  s: Recipe;
  din: Recipe;
  tu: Topup | null;
  P: number; // day protein
  K: number; // day kcal
  out?: boolean; // outside the band (honest flag, never hidden)
}

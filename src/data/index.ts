import products from './products.json';
import cupboard from './cupboard.json';
import recipes from './recipes.json';
import topups from './topups.json';

export type Course = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export interface Product { n: string; pr: number; pack: number; u: string; s: string }
export interface Recipe {
  id: string; c: Course; e: string; n: string; p: number; k: number; serves: number;
  fresh: [string, number][]; cup: string[]; m: string[];
}
export interface Topup { n: string; p: number; k: number; prod: string; qty: number }

export const PRODUCTS = products as Record<string, Product>;
export const CUPBOARD = cupboard as Record<string, string>;
export const RECIPES = recipes as Recipe[];
export const TOPUPS = topups as Topup[];

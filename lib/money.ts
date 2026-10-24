/** Pence (integer) → GBP string. UK-only. */
export const money = (pence: number): string => "£" + (pence / 100).toFixed(2);

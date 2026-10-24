export type HeightUnit = 'cm' | 'ftin';
export type WeightUnit = 'kg' | 'stlb' | 'lb';

export const ftInToCm = (ft: number, inch: number) => Math.round((ft * 12 + inch) * 2.54);
export const cmToFtIn = (cm: number) => {
  const total = Math.round(cm / 2.54);
  return { ft: Math.floor(total / 12), inch: total % 12 };
};
export const lbToKg = (lb: number) => Math.round(lb * 0.45359237 * 10) / 10;
export const stLbToKg = (st: number, lb: number) => lbToKg(st * 14 + lb);
export const kgToLb = (kg: number) => Math.round(kg / 0.45359237);
export const kgToStLb = (kg: number) => {
  const total = kgToLb(kg);
  return { st: Math.floor(total / 14), lb: total % 14 };
};

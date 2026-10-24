/** Meal header photos. Files are pre-sized by scripts/build-images.ts into public/meals/<slug>-<width>.webp. */
export const IMAGE_WIDTHS = [480, 960, 1440] as const;
/** Every photo is cropped to this shape so cards and sheets never jump. */
export const IMAGE_RATIO = 4 / 3;
/** Smallest source we accept: below this a photo looks soft on a phone's hero. */
export const IMAGE_MIN = { width: 1200, height: 900 } as const;

/** What the compiled recipe carries: alt text and the placeholder colour (the photo's average). */
export interface MealImage { a: string; c: string }

export const mealImageSrc = (id: string, width: (typeof IMAGE_WIDTHS)[number] = 960) => `/meals/${id}-${width}.webp`;
export const mealImageSrcSet = (id: string) => IMAGE_WIDTHS.map((w) => `${mealImageSrc(id, w)} ${w}w`).join(', ');

/** `#rrggbb` from sharp's `dominant` channel values. */
export const hexColour = ({ r, g, b }: { r: number; g: number; b: number }) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

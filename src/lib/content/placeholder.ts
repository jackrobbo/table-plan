/** Which stand-in photo a meal gets until it has its own. Keys are in content/images/placeholders.json (files: public/meals/ph-<key>-<w>.webp). */
const RULES: [RegExp, string][] = [
  [/smoothie|shake/, 'food-smoothie'],
  [/pasta-bake$|mac-and-cheese|pasta|spaghetti|lasagne|bolognese/, 'food-pasta'],
  [/porridge|overnight-oats|pancake/, 'food-oats'],
  [/yogurt|granola|berry-bowl|berries/, 'food-yogurt'],
  [/burger/, 'food-burger'],
  [/jacket-potato/, 'food-potato'],
  [/sausage-and|cottage-pie|pork-steaks|lean-beef/, 'food-sausage'],
  [/full-english|bacon-and-egg-bowl|bacon-butty|sausage-egg/, 'food-fry'],
  [/soup|stew|lentil/, 'food-soup'],
  [/noodle|fried-rice|stir-fry|teriyaki|5-spice|salt-and-pepper|honey-and-soy/, 'food-noodles'],
  [/curry|chilli|keema|burrito|rice-bowl|chickpea/, 'food-curry'],
  [/taco|fajita|quesadilla|kofta|gyros|pitta/, 'food-tacos'],
  [/wrap/, 'food-wrap'],
  [/cracker|rice-cake/, 'food-snack'],
  [/scrambled|omelette|frittata|shakshuka|hash|boiled|eggs-and|egg-and|avocado-and-egg/, 'food-eggs'],
  [/sandwich|toastie|bagel|toast|baguette/, 'food-sandwich'],
  [/steak/, 'food-steak'],
  [/salmon|cod-|prawn|tuna|fish/, 'food-fish'],
  [/traybake|roast|meatball|parcel|peri|one-pot|pesto-chicken|thigh|halloumi/, 'food-traybake'],
  [/salad|bowl|chicken/, 'slide-targets'],
  [/nuts|apple|cheese|babybel|cucumber|houmous|carrot|peanut|protein|grenade|wafer|pops|banana/, 'food-snack'],
];
const BY_COURSE: Record<string, string> = { breakfast: 'food-eggs', lunch: 'food-sandwich', dinner: 'food-traybake', snack: 'food-snack' };

export const placeholderKey = (r: { slug: string; course: string }): string =>
  RULES.find(([re]) => re.test(r.slug))?.[1] ?? BY_COURSE[r.course] ?? 'food-traybake';

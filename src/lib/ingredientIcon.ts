import {
  Apple, Banana, Bean, Beef, Carrot, Cherry, Citrus, Cookie, CookingPot, Croissant, Drumstick, Egg, Fish, Ham, Milk, Nut, Pizza, Salad,
  ShoppingBasket, Shrimp, Snowflake, Wheat, type LucideIcon,
} from 'lucide-react';

/** First match wins, so the specific words come before the general ones ("cream crackers" before "cream"). */
const RULES: [RegExp, LucideIcon][] = [
  [/cracker|rice cake|protein (bar|wafer|pops)|wafer|pops|oreo/i, Cookie],
  [/peanut butter|\bnut/i, Nut],
  [/banana/i, Banana],
  [/lemon|lime|orange/i, Citrus],
  [/apple/i, Apple],
  [/berr|tomato(es)? \d|baby plum|cherry/i, Cherry],
  [/frozen|chips/i, Snowflake],
  [/prawn|shrimp/i, Shrimp],
  [/cod|salmon|fish|tuna|haddock/i, Fish],
  [/chicken|turkey/i, Drumstick],
  [/beef|steak|lamb|sizzle/i, Beef],
  [/pork|ham\b|bacon|sausage|gammon/i, Ham],
  [/\begg/i, Egg],
  [/cheese|feta|halloumi|babybel|crème|creme|cream/i, Pizza],
  [/milk|yogurt|yoghurt/i, Milk],
  [/bagel|bread|loaf|naan|pitta|tortilla|wrap/i, Croissant],
  [/oats|porridge|rice|pasta|noodle|cereal/i, Wheat],
  [/bean|lentil|chickpea|\bpeas?\b/i, Bean],
  [/sauce|pesto|passata|chopped tomato|paste|soup|houmous|hummus|coconut|curry/i, CookingPot],
  [/lettuce|salad|spinach|cucumber|broccoli|avocado|leaf/i, Salad],
  [/carrot|potato|onion|pepper|courgette|mushroom|sweetcorn|chilli|veg|stir fry/i, Carrot],
];

const BY_AISLE: Record<string, LucideIcon> = {
  'Fruit & veg': Carrot, 'Meat & fish': Beef, 'Dairy & eggs': Milk, Bakery: Croissant, 'Frozen & ready to cook': Snowflake,
  'Tins, jars & sauces': CookingPot, 'Cereals, snacks & protein': Wheat,
};

export function ingredientIcon(name: string, aisle: string): LucideIcon {
  for (const [re, Icon] of RULES) if (re.test(name)) return Icon;
  return BY_AISLE[aisle] ?? ShoppingBasket;
}

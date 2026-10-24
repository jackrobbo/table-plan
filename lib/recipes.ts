import type { Recipe, Topup } from "./types";

// Recipe bank: per-portion macros; fresh quantities for the stated `serves`.
// Dinners serve 2 (macros are the eater's portion). Ported from the PoC.
export const RECIPES: Recipe[] = [
  // breakfasts (serve 1)
  { id: "BE", c: "breakfast", e: "🍳", n: "Scrambled Eggs on Toast", p: 29, k: 500, serves: 1, fresh: [["eggs", 3], ["loaf", 2]], cup: ["butter"],
    m: ["Whisk 3 eggs with a splash of milk; scramble gently.", "Toast 2 slices, butter, pile the eggs on."] },
  { id: "BS", c: "breakfast", e: "🥤", n: "Protein Smoothie", p: 31, k: 315, serves: 1, fresh: [["banana", 1], ["milk", 200]], cup: ["isolate", "frozenfruit"],
    m: ["Blend a scoop of isolate, 1 banana, 200ml milk and a handful of frozen berries."] },
  { id: "BO", c: "breakfast", e: "🫐", n: "Yogurt, Berries & Granola", p: 26, k: 320, serves: 1, fresh: [["yog", 1], ["blueb", 100]], cup: ["granola"],
    m: ["Empty a protein yogurt pot into a bowl.", "Top with 100g blueberries and 30g protein granola."] },
  { id: "BB", c: "breakfast", e: "🍌", n: "Yogurt & Banana Bowl", p: 24, k: 320, serves: 1, fresh: [["yog", 1], ["banana", 1]], cup: ["nuts"],
    m: ["Yogurt pot in a bowl, sliced banana on top, 15g chopped nuts to finish."] },
  { id: "BG", c: "breakfast", e: "🥚", n: "Boiled Eggs & Soldiers", p: 29, k: 500, serves: 1, fresh: [["eggs", 3], ["loaf", 2]], cup: ["butter"],
    m: ["Soft-boil 3 eggs (~6 min).", "Butter 2 slices of toast, cut into soldiers, dip away."] },
  { id: "BC", c: "breakfast", e: "🌯", n: "Bacon & Egg Breakfast Wrap", p: 36, k: 450, serves: 1, fresh: [["bacon", 3], ["eggs", 2], ["mission", 1]], cup: [],
    m: ["Grill 3 bacon medallions; scramble 2 eggs.", "Warm a protein wrap, fill and roll."] },
  // lunches (serve 1)
  { id: "LT", c: "lunch", e: "🐟", n: "Tuna Mayo Pasta Salad", p: 36, k: 440, serves: 1, fresh: [["salad", 30]], cup: ["tuna", "fusilli", "mayo", "sweetcorn"],
    m: ["Cook 60g fusilli; cool.", "Mix a drained tin of tuna with 1 tbsp light mayo.", "Toss with pasta, 40g sweetcorn and salad."] },
  { id: "LE", c: "lunch", e: "🥪", n: "Chicken-Mayo Sandwich", p: 33, k: 410, serves: 1, fresh: [["roast", 80], ["loaf", 2], ["salad", 20]], cup: ["mayo", "butter"],
    m: ["Mix 80g roast chicken slices with light mayo.", "Build the sandwich with salad."] },
  { id: "LH", c: "lunch", e: "🥪", n: "Ham & Cheese Sandwich", p: 27, k: 425, serves: 1, fresh: [["ham", 60], ["loaf", 2], ["salad", 20]], cup: ["cheddar", "butter"],
    m: ["Butter 2 slices; layer 60g ham, 30g cheddar and salad."] },
  { id: "LR", c: "lunch", e: "🍤", n: "Prawn Salad", p: 23, k: 180, serves: 1, fresh: [["prawns", 150], ["iceberg", 0.25], ["cuc", 0.25], ["plum", 60]], cup: ["seafood"],
    m: ["Prawns into a bowl with shredded iceberg, cucumber and halved baby plums.", "Dress with Marie Rose sauce."] },
  { id: "LW", c: "lunch", e: "🌯", n: "Chicken & Hummus Wrap", p: 25, k: 380, serves: 1, fresh: [["roast", 80], ["houm", 30], ["iceberg", 0.15], ["plum", 40], ["wraps", 1]], cup: [],
    m: ["Spread red pepper houmous over a wrap.", "Add chicken slices, iceberg and tomatoes; roll."] },
  { id: "LB", c: "lunch", e: "🍫", n: "Protein Grab-Bag", p: 41, k: 443, serves: 1, fresh: [["grenade", 1], ["yog", 1], ["apple", 1]], cup: [],
    m: ["Zero prep: a Grenade bar, a protein yogurt pot and an apple."] },
  // snacks (serve 1)
  { id: "SG", c: "snack", e: "🍫", n: "Grenade Oreo Bar", p: 21, k: 233, serves: 1, fresh: [["grenade", 1]], cup: [], m: [] },
  { id: "SW", c: "snack", e: "🧇", n: "Protein Wafer", p: 15, k: 194, serves: 1, fresh: [["wafer", 1]], cup: [], m: [] },
  { id: "SN", c: "snack", e: "🍿", n: "Protein Pops", p: 10, k: 187, serves: 1, fresh: [["pops", 1]], cup: [], m: [] },
  { id: "SK", c: "snack", e: "🥛", n: "Protein Yogurt Pot", p: 20, k: 130, serves: 1, fresh: [["yog", 1]], cup: [], m: [] },
  { id: "SD", c: "snack", e: "🧀", n: "Babybel ×2", p: 9, k: 118, serves: 1, fresh: [["babybel", 2]], cup: [], m: [] },
  // dinners (serve 2; macros are your portion)
  { id: "DSB", c: "dinner", e: "🍝", n: "Spaghetti Bolognese", p: 40, k: 520, serves: 2, fresh: [["mince", 250], ["onions", 1], ["carrots", 80], ["pepper", 0.5], ["ctoms", 400]], cup: ["spaghetti", "puree", "herbs", "parmesan", "garlic"],
    m: ["Brown the mince; soften the chopped veg.", "Add tomatoes, purée and herbs; simmer 20 min.", "Serve over spaghetti with parmesan."] },
  { id: "DFR", c: "dinner", e: "🍚", n: "Chicken Fried Rice", p: 50, k: 565, serves: 2, fresh: [["breast", 300], ["eggs", 2], ["onions", 0.5], ["pepper", 0.5], ["spring", 0.5]], cup: ["rice", "soy", "teriyaki", "garlic"],
    m: ["Cook the diced chicken; scramble the eggs; set both aside.", "Fry onion and pepper, then the cold rice and garlic; add soy.", "Everything back in, stir through teriyaki, top with spring onion."] },
  { id: "DPP", c: "dinner", e: "🍗", n: "Peri Peri Chicken Thighs", p: 55, k: 590, serves: 2, fresh: [["thigh", 600], ["pouch", 350], ["cobs", 2]], cup: ["peri", "oil"],
    m: ["Coat the thighs in peri-peri and oil; roast or air-fry ~22 min.", "Microwave the buttered potato pouch; boil the corn cobs."] },
  { id: "DBT", c: "dinner", e: "🌮", n: "Beef Tacos", p: 44, k: 615, serves: 2, fresh: [["mince", 250], ["kidney", 400], ["wraps", 4], ["iceberg", 0.15], ["plum", 40], ["greek", 50]], cup: ["puree", "fajita", "garlic", "cheddar"],
    m: ["Brown the mince; add seasoning, garlic, purée, beans and a splash of water; simmer till saucy.", "Load warm tortillas with iceberg, tomatoes, cheddar and a spoon of Greek yogurt."] },
  { id: "DHS", c: "dinner", e: "🍯", n: "Honey & Soy Chicken", p: 42, k: 475, serves: 2, fresh: [["breast", 280], ["brocc", 240]], cup: ["rice", "soy", "honey", "cornflour", "garlic"],
    m: ["Fry the sliced chicken.", "Add soy, honey, garlic and water; thicken with a cornflour slurry to a glossy glaze.", "Steam broccoli, cook rice, pour every drop of sauce over."] },
  { id: "DQ", c: "dinner", e: "🫑", n: "Chicken Fajitas", p: 43, k: 535, serves: 2, fresh: [["breast", 300], ["pepper", 1], ["onions", 0.5], ["wraps", 4]], cup: ["fajita", "oil", "cheddar"],
    m: ["Toss chicken strips in fajita seasoning; sear hot.", "Add pepper and onion for 3–4 min; serve sizzling with warm tortillas and cheddar."] },
  { id: "DST", c: "dinner", e: "🥩", n: "Steak Night", p: 43, k: 655, serves: 2, fresh: [["rump", 400], ["slices", 300], ["medley", 250]], cup: ["oil"],
    m: ["Oven the crispy potato slices.", "Sear the steaks 3–4 min a side; rest.", "Steam the green veg medley."] },
  { id: "DGY", c: "dinner", e: "🥙", n: "Greek Chicken Gyros", p: 52, k: 515, serves: 2, fresh: [["thigh", 500], ["pittas", 2], ["iceberg", 0.2], ["plum", 40], ["cuc", 0.25], ["greek", 150], ["lemon", 0.5]], cup: ["oregano", "garlic", "oil"],
    m: ["Marinate sliced thighs in oil, oregano, garlic, lemon; grill till charred.", "Mix tzatziki: Greek yogurt, grated cucumber, garlic, lemon.", "Build on warm pittas with iceberg and tomatoes."] },
  { id: "DCT", c: "dinner", e: "🥡", n: "Chinese 5-Spice Stir Fry", p: 46, k: 560, serves: 2, fresh: [["thigh", 500], ["stirfry", 400]], cup: ["rice", "soy", "fivespice"],
    m: ["Fry the thighs with 5-spice till cooked.", "Add stir-fry veg 3–4 min with a splash of soy; serve on rice."] },
  { id: "DFJ", c: "dinner", e: "🌯", n: "Steak Fajitas", p: 31, k: 475, serves: 2, fresh: [["sizzle", 320], ["mixpep", 3], ["onions", 1], ["wraps", 3]], cup: ["fajita"],
    m: ["Sear the sliced sizzle steak fast; set aside.", "Fry peppers and onion; return steak with seasoning.", "Serve with warm tortillas."] },
  { id: "DCP", c: "dinner", e: "🍝", n: "Creamy Chicken Pasta", p: 50, k: 560, serves: 2, fresh: [["breast", 280], ["creme", 100], ["spinach", 80]], cup: ["fusilli", "parmesan", "garlic"],
    m: ["Cook the chicken with garlic.", "Stir in crème fraîche and a splash of pasta water; wilt the spinach in.", "Toss with pasta, finish with parmesan."] },
  { id: "DLA", c: "dinner", e: "🍜", n: "Lasagne", p: 42, k: 575, serves: 2, fresh: [["mince", 300], ["onions", 1], ["carrots", 80], ["ctoms", 400], ["milk", 300]], cup: ["lasagne", "cornflour", "cheddar", "puree"],
    m: ["Make the ragu: mince, veg, tomatoes, purée; simmer.", "Cheese sauce from scratch: whisk cornflour into cold milk, heat till thick, melt in cheddar.", "Layer, top with cheddar, bake 35–40 min at 200°C."] },
  { id: "DSP", c: "dinner", e: "🍗", n: "Salt & Pepper Chicken", p: 46, k: 570, serves: 2, fresh: [["breast", 280], ["pepper", 1], ["onions", 1], ["chilli", 10], ["spring", 0.5], ["eggs", 2]], cup: ["rice", "cornflour", "fivespice"],
    m: ["Toss diced chicken in seasoned cornflour; fry till crisp.", "Stir-fry pepper, onion, chilli.", "Egg-fried rice; combine everything."] },
  { id: "DTS", c: "dinner", e: "🍜", n: "Teriyaki Chicken Noodles", p: 46, k: 540, serves: 2, fresh: [["breast", 280], ["stirfry", 400]], cup: ["noodles", "teriyaki"],
    m: ["Fry the sliced chicken.", "Add stir-fry veg, then teriyaki sauce and cooked noodles; toss."] },
];

export const TOPUPS: Topup[] = [
  { n: "Banana", p: 1, k: 95, prod: "banana", qty: 1 },
  { n: "Protein yogurt pot", p: 20, k: 130, prod: "yog", qty: 1 },
  { n: "Babybel ×2", p: 9, k: 118, prod: "babybel", qty: 2 },
];

export const COURSE_MIN: Record<string, number> = { breakfast: 3, lunch: 3, snack: 2, dinner: 5 };

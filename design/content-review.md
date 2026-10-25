# Content review list (for a dietitian or careful human)

Everything the nutrition and allergen data rests on that a machine can't vouch for. Numbers are per 100 g as used in the app. `npm run content:verify -- --table` re-checks the rest.

## 1. Closest-food matches (the CoFID entry is a stand-in)

| slug | product | used | note |
|---|---|---|---|
| sizzle | Morrisons British Beef Sizzle Steak 320g | 134 kcal, 23.8g P | matched to “Beef, sirloin steak, raw, lean” (closest food, not the same product) |
| roast | Morrisons Roast Chicken Breast Slices 180g | 131 kcal, 27g P | matched to “Turkey slices” (closest food, not the same product) |
| bacon | Morrisons Lean Smoked Bacon Medallions 8pk | 184 kcal, 33.4g P | matched to “Bacon loin steaks, lean, grilled” (closest food, not the same product) |
| pepper | Red Pepper (loose) | 15 kcal, 0.8g P | matched to “Peppers, capsicum, green, raw” (closest food, not the same product) |
| mixpep | Morrisons Savers Mixed Peppers 3 Pack | 15 kcal, 0.8g P | matched to “Peppers, capsicum, green, raw” (closest food, not the same product) |
| pouch | Morrisons Baby Potatoes with Chives & Butter 350g | 92 kcal, 1.8g P | matched to “Potatoes, new and salad, boiled in unsalted water, flesh and skin” (Label used: a ready-cooked pouch with butter and chives (92 kcal), so as-consumed is as-sold and richer than plain boiled new potatoes.) |
| stirfry | Morrisons Vegetable Stir Fry Mix 500g | 35 kcal, 1.4g P | matched to “Vegetables, mixed, stir-fry type, frozen, fried in rapeseed oil” (Label used: sold raw; CoFID's entry is stir-fried in oil.) |
| slices | Morrisons Crispy Potato Slices 300g | 189 kcal, 3.2g P | matched to “Potato chips, oven ready, no batter, baked” (closest food, not the same product) |
| medley | Morrisons Green Vegetable Medley 250g | 82 kcal, 4.3g P | matched to “Broccoli, green, raw” (Label used: the medley comes with a buttery sauce (contains milk), so it is not plain broccoli.) |
| babybel | Mini Babybel Original 6×20g | 295 kcal, 22g P | matched to “Cheese, Edam” (closest food, not the same product) |
| teriyaki | Teriyaki Stir Fry Sauce 152g | 92 kcal, 1.4g P | matched to “Sauce, Chinese stir fry” (closest food, not the same product) |
| frozenfruit | Frozen Summer Fruits 430g | 30 kcal, 0.6g P | matched to “Strawberries, raw” (closest food, not the same product) |
| turkeymince | Morrisons Turkey Mince 4% 500g | 112 kcal, 21.8g P | matched to “Turkey, whole, raw” (closest food, not the same product) |
| passata | Morrisons Passata 500g | 21 kcal, 1.2g P | matched to “Tomatoes, canned, whole contents” (closest food, not the same product) |
| tikka | Morrisons Tikka Masala Curry Paste 180g | 114 kcal, 3.1g P | matched to “Curry paste” (Label used: this paste is mostly water and tomato (114 kcal); CoFID's generic curry paste is oil-based.) |

## 2. No CoFID food fits (branded products; the pack label is the only source)

| slug | product | used | note |
|---|---|---|---|
| grenade | Grenade Oreo Protein Bars 4×60g | None kcal, Noneg P | no CoFID food fits (branded product); label only |
| granola | FUEL10K Protein Granola 400g | None kcal, Noneg P | no CoFID food fits (branded product); label only |
| seafood | Seafood Sauce 250ml | None kcal, Noneg P | no CoFID food fits (branded product); label only |
| isolate | Whey Isolate 1kg (MyProtein) | None kcal, Noneg P | no CoFID food fits (branded product); label only |

## 3. Label and CoFID disagree, or the label is missing

| slug | product | used | note |
|---|---|---|---|
| porkmince | Morrisons British Pork Mince 5% Fat 500g | 164 kcal, 19.2g P | label and CoFID disagree or no label: “Pork, mince, raw” |

## 4. Pack label with no CoFID cross-check

| slug | product | used | note |
|---|---|---|---|
| yog | Morrisons Protein Yogurt 200g pot | 68 kcal, 10.5g P | pack label only, no CoFID cross-check |
| mission | Mission Protein Tortilla Wraps 6pk | 277 kcal, 16.9g P | pack label only, no CoFID cross-check |
| wafer | Myprotein Protein Wafer Vanilla 40g | 481 kcal, 37g P | pack label only, no CoFID cross-check |
| pops | Novo Protein Pops Sour Cream & Onion 45g | 417 kcal, 23g P | pack label only, no CoFID cross-check |
| ricecakes | Morrisons Lightly Salted Rice Cakes 100g | 385 kcal, 8.4g P | pack label only, no CoFID cross-check |

## 5. Allergens we assert by hand (beyond what the pack's bold text declares)

These come from `content/cofid-map.json` and exist because a label was missing or the name implies an allergen the label omits. Please confirm each against the pack.

| slug | asserted allergens |
|---|---|
| salmon | fish |
| cod | fish |
| feta | milk |
| softcheese | milk |

## What is not covered anywhere

- “May contain” traces (the terms say so). A person with a serious allergy must read the pack.
- Packs change recipe: the nightly price crawl does not re-read allergen text. Re-run `npm run labels:fetch` before launch and every few months.
- Cooked-weight conversions are per recipe (`cupboard_qty`, `gramsPerUnit`); spot-check the five meals that still use declared macros (grenade-oreo-bar, prawn-salad, protein-grab-bag, protein-smoothie, yogurt-berries-and-granola).

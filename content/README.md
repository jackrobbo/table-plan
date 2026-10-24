# Content guide (M2 recipe bank)

Add recipes as `content/recipes/<slug>.json` (or an array of recipes in one file), then run
`npm run content:import` (validate + compile + seed SQL) and `npm run content:verify` (CoFID report).

```json
{
  "slug": "chicken-chilli-bowl", "name": "Chicken Chilli Bowl", "course": "dinner", "emoji": "🌶️",
  "serves": 2, "status": "live",
  "ingredients": [{ "ingredient": "breast", "qty": 300 }, { "ingredient": "kidney", "qty": 400 }],
  "cupboard": ["rice", "oil", "cumin"], "cupboard_qty": { "rice": 140, "oil": 10, "cumin": 3 },
  "method": ["Step one.", "Step two."]
}
```

- **Macros are never typed in.** The importer computes per-portion kcal/protein/carbs/fat from each ingredient's per-100 g data,
  and also the cost per portion and its `low`/`medium`/`high` tier (limits per course in `src/lib/content/macros.ts`).
  (`per_portion` is still accepted for grandfathered recipes, and is how a `macros_only` meal states its numbers.)
- `qty` is the amount for the WHOLE recipe, in the ingredient's unit; `serves` divides it. Cupboard items need a quantity in
  grams/ml in `cupboard_qty` (spices that are only a pinch are marked `negligible` instead).
- Counted units (eggs, slices, wraps) need `gramsPerUnit` on the ingredient (`content/cofid-map.json` `gpu`).
- **Allergens are derived** from ingredients: tag the ingredient, not the recipe (`extra_allergens` for cross-contact). The
  import fails if an ingredient's name implies an allergen it doesn't declare (cod without `fish`, feta without `milk`).

## Adding or changing an ingredient
1. Add it to `content/ingredients.json` with its Morrisons `product` (slug + SKU from the sitemap, price, pack size), or as a
   `cupboard` item with a `cupboardPrice`.
2. Say which CoFID 2021 food it is in `content/cofid-map.json` (`node scripts/cofid-search.mjs "chicken breast"` finds codes).
3. `npm run labels:fetch` reads the product's pack-label nutrition and bold allergens; `npm run nutrition:apply` merges them:
   a label that agrees with CoFID is used (it is the exact product), a label that disagrees is NOT trusted and is listed for
   a decision (`prefer` + `why` in the map record the call). Labels stated "as consumed/boiled" are ignored for as-sold weights.
4. `npm run content:import`, then `npm run content:verify -- --table` to eyeball macros, cost and tier per recipe.

## Meal photos
A meal can have a header photo; without one it shows its emoji, so nothing is ever blank.
1. Put the original in `content/images/originals/<slug>.jpg` (or .png/.webp): landscape, at least 1200x900, ideally the phone's full-size
   export. Originals are gitignored (keep them in your own storage); only the sized files are committed.
2. Add `"image": { "alt": "A folded omelette with spinach on a white plate" }` to the recipe (alt text is required, 12+ characters;
   optional `credit` if someone else took it).
3. `npm run images:build` makes `public/meals/<slug>-480|960|1440.webp` (cropped to 4:3), records the photo's average colour
   (the placeholder while it loads) in `content/images/manifest.json`, and skips unchanged originals.
4. `npm run content:import` fails if a recipe has alt text but no built photo (or the reverse) and reports how many meals have one.
Shooting tips: same backdrop and light for every dish, top-down or about 45 degrees, the real portion as written, no filters.

## Status workflow
`draft` → `verified` → `live`. Only `live` recipes reach the app.
- **verified / live (non-PoC)** needs every counted line (fresh and cupboard) to have `cofid.verified: true` + `per100` and a
  usable weight, and a quantity for every cupboard item.
- **live** also needs every non-cupboard ingredient mapped to a priced product.
- `source: "poc"` recipes that still carry hand-declared `per_portion` are grandfathered (5 of them lack data). The other 26 were
  recomputed from their ingredients; several declared figures were 20-30% low (lasagne 575 -> 755 kcal).

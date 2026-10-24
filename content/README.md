# Content guide (M2 recipe bank)

Add recipes as `content/recipes/<slug>.json` (or an array of recipes in one file), then run
`npm run content:import` (validate + compile + seed SQL) and `npm run content:verify` (CoFID report).

```json
{
  "slug": "chicken-chilli-bowl", "name": "Chicken Chilli Bowl", "course": "dinner", "emoji": "🌶️",
  "serves": 2, "status": "draft",
  "per_portion": { "kcal": 540, "protein_g": 48, "carbs_g": 52, "fat_g": 14 },
  "ingredients": [{ "ingredient": "breast", "qty": 300 }],
  "cupboard": ["rice"], "method": ["Step one.", "Step two."]
}
```

- `per_portion` is ONE portion; `qty` is the amount for the whole recipe, in the ingredient's unit.
- New ingredients go in `content/ingredients.json` (`unit`, `allergens`, optional `per100` + `cofid`, optional `product`).
- **Allergens are derived** from ingredients — tag the ingredient, not the recipe (`extra_allergens` for cross-contact).
- `macros_only: true` = an entry with no ingredients/method/pricing (e.g. eating out).

## Status workflow
`draft` → `verified` → `live`. Only `live` recipes reach the app.
- **verified / live (non-PoC)** needs every ingredient line to have `cofid.verified: true` + `per100`, and computed
  macros within 10% kcal (15% protein) of the declared ones.
- **live** also needs every non-cupboard ingredient mapped to a priced product.
- The 31 PoC recipes are `source: "poc"`: grandfathered live, flagged by `content:verify` until their ingredients are verified.

## Authoring notes (recipes marked `"source": "original"`)
- **CoFID data**: `per100` + `cofid: { code, verified: true }` are copied from McCance & Widdowson's CoFID 2021 dataset
  (GOV.UK). Use the entry for the form you *buy and weigh* (raw meat, dry rice/pasta/oats), so recipe quantities match the
  shopping list. Where CoFID has no good match for a product the generic entry is a proxy (e.g. houmous and Greek-style yogurt
  read higher than the Morrisons labels; chicken thigh reads lower), so per-portion macros are good estimates, not lab values.
- **Count units** (eggs, slices, bananas, wraps…): set `unit_g` on the ingredient (grams in one unit) so they count in verification.
- **Cupboard calories**: cupboard items aren't priced or quantified, so list the grams of anything calorie-bearing (oil, butter,
  honey, mayo, soy, cornflour…) in the recipe's `cupboard_g`. It feeds verification only. Leave out spices and trace amounts.
- **Allergens** are the *declared* ones from the Morrisons product page ("Contains …" plus the ingredient list), matching the
  app's stance that "may contain" traces aren't covered (see `legal/terms-notes.md`). Re-check a page when you add or swap a
  product, and avoid stock cubes and similar blends unless you want their allergens on every recipe that uses them.
- **Products**: use the real product URL slug (`name/SKU`); `npm run prices:refresh` checks the SKU and price nightly. Find
  candidates in `https://groceries.morrisons.com/sitemaps/sitemap_index.xml` (search pages are client-rendered).
- **Coverage check**: `tests/lib.test.ts` requires each of the 14 allergens to leave at least 5 breakfasts, lunches and dinners and
  3 snacks, so a milk-, gluten- or egg-free household still gets a full plan.

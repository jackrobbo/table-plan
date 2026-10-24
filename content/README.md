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

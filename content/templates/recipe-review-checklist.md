# Recipe review checklist

Tick every line before a recipe's status goes from `draft` to `live`. Jack reviews; Claude checks the data lines.

## Jack (does it feel right for a real person?)
- [ ] The name says what it is, in plain words.
- [ ] A normal person can cook it in the time stated, with ordinary kit.
- [ ] The method is in our own words, 3 to 6 short steps, nothing copied from another site.
- [ ] The portion is realistic for the macros (not a tiny plate that only hits the numbers).
- [ ] It tastes like something you would repeat, not a one-off.
- [ ] Ingredients are everyday ones people can buy at any of our supermarkets.
- [ ] Photo taken (same backdrop and light as the rest) and alt text agreed.

## Claude (data)
- [ ] Every ingredient maps to a priced product at each live supermarket.
- [ ] Macros come from the ingredients, not typed in; cost tier looks sensible.
- [ ] Allergens are derived and make sense for the dish.
- [ ] `npm run content:import` and `npm run content:verify -- --table` pass.
- [ ] Image built (`npm run images:build`) and alt text added.

## Where things live
- Recipe files: `content/recipes/<slug>.json` (template: `content/templates/recipe.example.json`).
- Photos: originals in `content/images/originals/<slug>.jpg` (gitignored, keep your own copies); web sizes are built into `public/meals/`.
- Shot list with suggested photos and alt text: `design/recipe-photo-shotlist.md`.

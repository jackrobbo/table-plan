# Recipe drafting guide (for drafting a batch of recipes)

You are drafting new recipes for Table Plan from recipe-site ideas Jack has chosen. Work only on your batch. Do not commit, do not run `npm run content:import`, and do not edit files outside the ones listed under "What you may write".

## Rules of the content
- **Idea and ingredient list only.** Write the method in our own words. Keep the original's **technique, step order, oven/hob temperatures and key timings**; do not copy sentences. No images.
- **Read the real page** (ingredients, quantities, serves, method, calories if shown). If a page cannot be read (blocked, book-only, paywalled without text), skip it and say so; never invent a recipe from memory.
- **Map ingredients to the catalogue only**: `content/ingredients.json` (`node -e "const i=require('./content/ingredients.json');console.log(i.map(x=>x.slug+' | '+(x.display||x.name)+' | unit '+x.unit+(x.gramsPerUnit?' ('+x.gramsPerUnit+' g each)':'')+(x.cupboard?' | CUPBOARD':'')).join('\n'))"`). Use sensible swaps (record them) where the original's item is not stocked. If an ingredient is essential and has no sensible swap (for example harissa, gnocchi, a curry paste), **skip that recipe** and list the missing ingredient in `content/needs/<batch>.md` (ingredient, which recipe, a suggested Morrisons product). Never edit `content/ingredients.json`, `content/cofid-map.json`, `package.json` or anything under `src/`.
- **Skip duplicates** of meals already in the app (`ls content/recipes`; open any similar one to compare). A different protein, sauce or method is not a duplicate. List what you skipped and why.

## Recipe file: `content/recipes/<slug>.json`
```json
{
 "slug": "chicken-milanese-pasta",
 "name": "Chicken Milanese Pasta",
 "course": "dinner",            // breakfast | lunch | dinner | snack
 "emoji": "🍝",
 "serves": 4,                   // dinner: 2 or 4; breakfast/lunch: 1 (2 for batch/prep-ahead)
 "status": "draft",
 "time": { "prep": 15, "cook": 25 },
 "ingredients": [ { "ingredient": "breast", "qty": 450 } ],   // fresh/product items; qty in the ingredient's own unit (g, ml, or a count such as 3 wraps, 0.5 onion)
 "cupboard": ["fusilli", "garlic", "oil"],                    // cupboard items (flagged CUPBOARD in the catalogue)
 "cupboard_qty": { "fusilli": 300, "garlic": 6, "oil": 15 },  // grams (ml counted as g) in the whole recipe; every cupboard item with real calories needs a quantity
 "method": ["step 1", "step 2", "step 3"],
 "source": "idea: Joe Wicks"
}
```
Copy the shape of an existing recipe of the same course. Scale the original to our serves (dinners 2 or 4, one-person lunches and breakfasts) and keep portions realistic (a dinner is roughly 450 to 750 kcal per portion).

## Method rules (these are tested)
- **3 to 6 steps**, each between 16 and 420 characters.
- **Mention every ingredient** you list (use its ordinary name in the step, e.g. "peppers", "yoghurt", "tomatoes", "tortilla" or "wrap").
- **Oven or grill**: say "Heat the oven to 200C (180C fan)" or "Heat the grill to high" before first using it, and give a temperature in C for the oven.
- **Timings**: write minutes as digits ("simmer for 10 minutes", "5 to 6 minutes"). The timings must add up to at least about half the cook time, and no single time may be longer than prep plus cook. Marinating counts as prep time.
- **Raw meat and fish** (chicken, pork, beef mince, sausages, turkey, lamb): say it is cooked through and give a time. Catalogue prawns are already cooked king prawns: heat them through, never "cook until pink".
- **The last step ends by serving** (serve, top, scatter, spoon, toss, divide and so on).

## Nutrition rules (these are tested)
- Every ingredient must have verified nutrition in the catalogue (they do, apart from FUEL10K granola, whey isolate and seafood sauce, so do not use those).
- Check your numbers: `npm run -s content:verify -- --table 2>&1 | grep <slug>`. Per portion: dinner plate weight 200 to 750 g (other courses 120 to 750 g), 0.6 to 2.6 kcal per gram, fat under 50% of calories, protein between 10% and 60%, kcal between 150 and 1000. If a recipe fails (very fatty, tiny), fix it sensibly (add a carb side, trim the fat source) and say so.
- If the page states calories per serving, add them to a fragment so we can compare (see below).

## What you may write
1. `content/recipes/<slug>.json` for each recipe you draft.
2. **Method outline fragment**: `tests/fixtures/outlines/<batch>.json`, an object keyed by slug:
```json
{ "chicken-milanese-pasta": { "source": "Joe Wicks", "steps": [
    { "do": ["oven"], "temp": 200 },
    { "do": ["pasta"], "mins": [10, 12] },
    { "do": ["bake"], "mins": [20, 25] } ] } }
```
   `do` is words that appear in your own step (first match at or after the previous step); `temp` is the original's oven temperature in C (we allow 20C either way); `mins` is [low, high] of the original's timing (we allow about a third either way). Use `"deviation": "reason of at least 20 characters"` on a step where you deliberately differ (for example boneless thighs cook faster, or one portion becomes four). Record only facts from the original, not wording. Recipes with no original (our own builds) use `"steps": []`.
3. **Source calories fragment** (only if the page states kcal): `tests/fixtures/source-nutrition/<batch>.json`: `{ "slug": { "kcal": 425, "source": "Site (serves 4)", "tolerance": 0.25, "note": "why a gap is expected" } }`. Default tolerance 0.2; use up to 0.4 with a note when portions or swaps explain the gap.
4. `content/needs/<batch>.md`: missing ingredients, skipped recipes and why.

## Run the checks and fix until they pass for your slugs
```
npm run -s content:verify -- --table 2>&1 | grep -E "<slug1>|<slug2>"
npx tsc --noEmit
npx vitest run tests/methodSense.test.ts tests/macroSense.test.ts tests/methodOutlines.test.ts tests/recipeRuns.test.ts 2>&1 | grep -E "Tests |FAIL|AssertionError"
```
Failures for other people's recipes are not yours; ignore them, but report them.

## Your final report (short)
Drafted: slug, name, course, kcal, protein, £ per portion. Skipped: name and reason. Swaps made. Needs written. Any test failure you could not fix.

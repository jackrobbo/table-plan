# Breakfast: grab-and-go (agreed direction, 7 Nov 2026)

Jack's point: the main breakfast problem is time, so pre-packed supermarket items (protein yoghurts, bars, shakes, overnight oats pots) belong in the plan alongside cooked recipes. Not built yet; parked while lunches are looked at.

## Time tiers
1. **Grab and go (0 min):** protein yoghurt, bars, shakes, a banana, ready-made overnight oats pots.
2. **5 minutes or the night before:** overnight oats, yoghurt bowls, cottage cheese and fruit, egg wrap or toast.
3. **Cooked (10+ min):** the recipe-site ideas in `design/meal-backlog-breakfasts.md`, for weekends or people with time.

## Why it suits the app
Exact macros from pack labels; long shelf life so little waste; the item is the meal or one item plus a banana.

## Decisions to make
- **Generic own-brand, matched by nutrition band across stores** (recommended): e.g. "protein yoghurt 200g, about 20g protein, under 130 kcal" maps to each store's own-brand equivalent, with that store's own label values. Brands (Grenade, Myprotein) stay an optional Morrisons-only extra. Jack to confirm.
- **A quality rule** in `design/ingredient-principles.md`: for example at least 15g protein and a sugar cap per serving, so "protein bar" does not mean a chocolate bar. Jack to define.
- **A time setting** so the planner knows how long someone has in the morning (rushed picks tiers 1 and 2; weekends allow tier 3). Recipes already carry `t` (minutes, 0 = ready to eat); the planner does not use it yet.

## Build plan (when picked up)
1. Search each store's own-brand protein yoghurts, bars, shakes and overnight oats pots with Yappman (search mode, about 3 to 4p per query), for prices. Needs the Apify token step (Jack copies it from Apify; see design/handoff.md).
2. Read pack labels for nutrition (Morrisons pages via `npm run labels:fetch`; other stores in Chrome).
3. Build about a dozen combos at roughly 350 to 450 kcal and 25 g protein; run the same macro tests as dinners.
4. Keep the best cooked recipes for slower mornings.

## What the catalogue has today
Morrisons Protein Yogurt 200g (68 kcal, 10.5 g protein per 100 g), Greek Style Yogurt, Mission Protein Wraps, Myprotein Protein Wafer, Novo Protein Pops, Babybel, Low Fat Cottage Cheese, Porridge Oats. Grenade bars, FUEL10K granola and whey isolate have no nutrition data yet.

## Also: supermarket ready meals, for lunch and dinner (Jack, 7 Nov 2026)
Example: Tesco Gym Kitchen ready meals (high-protein, calories on the pack). Other stores have similar healthy ranges (names to confirm when we search; I believe Sainsbury's has "Be Good To Yourself"-style ranges, Asda and Morrisons have own-brand healthy ranges).

**Why:** zero cooking, exact macros from the label, and no leftover ingredients, so it also serves the low-waste aim. Good for rushed days and for people who will not cook at all.

**What changes in the app (a data-model point, not just content):**
- A ready meal is a store product, not a recipe. Tesco Gym Kitchen only exists at Tesco, so the meal differs per store, and so do the calories and protein. Today a recipe has one set of macros computed from ingredients that are the same everywhere. A ready meal needs macros, price and a link per store.
- Matching is by nutrition band, as for the packaged breakfasts: "high-protein chicken and rice, about 40 g protein, under 550 kcal" maps to each store's closest own-range meal, and the person sees their own store's numbers. If a store has no match for a band, the meal is simply not offered to that store's users.
- This works best once the user has a default supermarket (set at registration, per Jack's earlier idea).
- Add to basket is one product per meal, which is simpler than a recipe.

**Cautions:** chilled meals last about 3 to 5 days, so they should sit early in the planned week or be frozen; price is typically £3 to £4.50 a meal, so they land in the "high" cost tier; and some are highly processed, so the quality rule (see above) applies here too.

**Build order:** after the packaged-breakfast build, since it needs the same store search and label reading. Needs the Apify token step from Jack.

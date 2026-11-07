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

-- Table Plan: removes ONLY the tables/functions this project creates (never touches auth.*).
-- Use it on a fresh project when a previous setup run stopped half-way ("relation ... already exists").
-- WARNING: deletes any data in these tables. Run, then run setup.sql again in a new query.
drop table if exists public.feedback, public.invites, public.waitlist, public.stripe_events, public.subscriptions,
  public.recipe_versions, public.recipe_ingredients, public.recipes, public.products, public.ingredients, public.profiles,
  public.cupboard_items cascade;
drop function if exists public.redeem_invite(text, text);
drop function if exists public.snapshot_recipe();
drop function if exists public.touch_updated_at();

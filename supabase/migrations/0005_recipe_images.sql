-- Meal header photos: the files are served from /meals/<slug>-<width>.webp; the database holds the alt text and the
-- placeholder colour (the photo's average) so any client can render a placeholder before the file arrives.
alter table public.recipes
  add column if not exists image_alt text,
  add column if not exists image_colour text check (image_colour ~ '^#[0-9a-f]{6}$');

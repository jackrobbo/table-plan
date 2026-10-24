-- Explicit consent to process health information (allergies, optional body measurements), and acceptance of the terms.
-- Shape: {"health": "<ISO time>", "terms": "<ISO time>", "version": "<policy version>"}. Null until the person has agreed.
alter table public.profiles add column if not exists consent jsonb;

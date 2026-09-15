ALTER TABLE public.agency_branches
  ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS official_address text;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS official_address text;
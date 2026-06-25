ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS is_popular boolean NOT NULL DEFAULT false;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS popularity_rank integer;
CREATE INDEX IF NOT EXISTS agencies_popular_rank_idx ON public.agencies (is_popular, popularity_rank);
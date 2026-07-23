
CREATE TABLE IF NOT EXISTS public.trip_branches (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.agency_branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, branch_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_branches TO authenticated;
GRANT ALL ON public.trip_branches TO service_role;

ALTER TABLE public.trip_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_branches viewable by agency members"
ON public.trip_branches FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_branches.trip_id
      AND (public.is_agency_owner(t.agency_id) OR public.is_branch_manager_of(t.agency_id))
  )
);

CREATE POLICY "trip_branches managed by owners or admin"
ON public.trip_branches FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_branches.trip_id AND public.is_agency_owner(t.agency_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_branches.trip_id AND public.is_agency_owner(t.agency_id))
);

CREATE INDEX IF NOT EXISTS trip_branches_branch_idx ON public.trip_branches(branch_id);
CREATE INDEX IF NOT EXISTS trip_branches_trip_idx ON public.trip_branches(trip_id);

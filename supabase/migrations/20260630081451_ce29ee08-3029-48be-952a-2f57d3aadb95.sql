
-- Branches (sous-agences) belonging to a parent company (agencies)
CREATE TABLE public.agency_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  parent_branch_id UUID REFERENCES public.agency_branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  phone TEXT,
  manager_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agency_branches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_branches TO authenticated;
GRANT ALL ON public.agency_branches TO service_role;

ALTER TABLE public.agency_branches ENABLE ROW LEVEL SECURITY;

-- Public can view active branches of active agencies
CREATE POLICY "Public can view active branches"
ON public.agency_branches FOR SELECT
USING (
  status = 'active' AND EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id = agency_branches.agency_id AND a.status = 'active'
  )
);

-- Agency owners can view all their branches
CREATE POLICY "Agency owners can view their branches"
ON public.agency_branches FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id = agency_branches.agency_id AND a.owner_id = auth.uid()
  )
);

-- Agency owners can insert branches in their agency
CREATE POLICY "Agency owners can create branches"
ON public.agency_branches FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id = agency_branches.agency_id AND a.owner_id = auth.uid()
  )
);

-- Agency owners can update their branches
CREATE POLICY "Agency owners can update their branches"
ON public.agency_branches FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id = agency_branches.agency_id AND a.owner_id = auth.uid()
  )
);

-- Agency owners can delete their branches
CREATE POLICY "Agency owners can delete their branches"
ON public.agency_branches FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id = agency_branches.agency_id AND a.owner_id = auth.uid()
  )
);

-- Admins full access
CREATE POLICY "Admins can manage all branches"
ON public.agency_branches FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_agency_branches_updated_at
BEFORE UPDATE ON public.agency_branches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agency_branches_agency ON public.agency_branches(agency_id);
CREATE INDEX idx_agency_branches_parent ON public.agency_branches(parent_branch_id);

-- Optional link from trips to a branch (which branch operates the trip)
ALTER TABLE public.trips ADD COLUMN branch_id UUID REFERENCES public.agency_branches(id) ON DELETE SET NULL;
CREATE INDEX idx_trips_branch ON public.trips(branch_id);

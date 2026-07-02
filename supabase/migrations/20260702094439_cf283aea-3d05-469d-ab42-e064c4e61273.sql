
-- Table linking auth users to agency branches as managers
CREATE TABLE public.branch_managers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.agency_branches(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agency_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_managers TO authenticated;
GRANT ALL ON public.branch_managers TO service_role;

ALTER TABLE public.branch_managers ENABLE ROW LEVEL SECURITY;

-- Helper: is caller the owner of this agency?
CREATE OR REPLACE FUNCTION public.is_agency_owner(_agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agencies
    WHERE id = _agency_id AND owner_id = auth.uid()
  )
$$;

CREATE POLICY "Owners manage their branch managers"
ON public.branch_managers
FOR ALL
TO authenticated
USING (public.is_agency_owner(agency_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_agency_owner(agency_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view own record"
ON public.branch_managers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_branch_managers_updated_at
BEFORE UPDATE ON public.branch_managers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 1) Allow agency owners to broadcast notifications to their branches
CREATE POLICY "Owners create notifications for their agency"
ON public.branch_notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_agency_owner(agency_id));

-- 2) Reports table: sub-agency -> main agency
CREATE TABLE public.agency_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.agency_branches(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  severity text NOT NULL DEFAULT 'normal',
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  owner_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_reports TO authenticated;
GRANT ALL ON public.agency_reports TO service_role;

ALTER TABLE public.agency_reports ENABLE ROW LEVEL SECURITY;

-- Managers: can insert reports for their branch/agency and see them
CREATE POLICY "Managers insert reports for their branch"
ON public.agency_reports
FOR INSERT
TO authenticated
WITH CHECK (
  branch_id = public.get_manager_branch(auth.uid())
  AND agency_id = public.get_manager_agency(auth.uid())
  AND reported_by = auth.uid()
);

CREATE POLICY "Managers view their own branch reports"
ON public.agency_reports
FOR SELECT
TO authenticated
USING (branch_id = public.get_manager_branch(auth.uid()));

-- Owners: view/update all reports for their agency
CREATE POLICY "Owners view agency reports"
ON public.agency_reports
FOR SELECT
TO authenticated
USING (public.is_agency_owner(agency_id));

CREATE POLICY "Owners update agency reports"
ON public.agency_reports
FOR UPDATE
TO authenticated
USING (public.is_agency_owner(agency_id))
WITH CHECK (public.is_agency_owner(agency_id));

-- Admins full access
CREATE POLICY "Admins manage all reports"
ON public.agency_reports
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER update_agency_reports_updated_at
BEFORE UPDATE ON public.agency_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agency_reports;

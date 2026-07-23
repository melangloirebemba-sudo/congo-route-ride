
-- 1) Attachments on agency_reports
ALTER TABLE public.agency_reports ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Group broadcasts on branch_notifications
ALTER TABLE public.branch_notifications ADD COLUMN IF NOT EXISTS broadcast_id uuid;
CREATE INDEX IF NOT EXISTS idx_branch_notifications_broadcast ON public.branch_notifications(broadcast_id);

-- 3) Scheduled broadcasts
CREATE TABLE IF NOT EXISTS public.scheduled_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  kind text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  target_branch_ids uuid[] NOT NULL DEFAULT '{}',
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  broadcast_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_broadcasts TO authenticated;
GRANT ALL ON public.scheduled_broadcasts TO service_role;

ALTER TABLE public.scheduled_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner or admin manage scheduled broadcasts" ON public.scheduled_broadcasts;
CREATE POLICY "Owner or admin manage scheduled broadcasts"
ON public.scheduled_broadcasts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_agency_owner(agency_id))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_agency_owner(agency_id));

DROP TRIGGER IF EXISTS trg_scheduled_broadcasts_updated ON public.scheduled_broadcasts;
CREATE TRIGGER trg_scheduled_broadcasts_updated
BEFORE UPDATE ON public.scheduled_broadcasts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Dispatcher
CREATE OR REPLACE FUNCTION public.dispatch_scheduled_broadcasts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.scheduled_broadcasts%ROWTYPE;
  v_bid uuid;
  v_branches uuid[];
  v_count int := 0;
BEGIN
  FOR r IN SELECT * FROM public.scheduled_broadcasts
           WHERE status = 'scheduled' AND scheduled_at <= now()
           FOR UPDATE SKIP LOCKED
  LOOP
    v_bid := gen_random_uuid();
    v_branches := r.target_branch_ids;
    IF v_branches IS NULL OR array_length(v_branches, 1) IS NULL THEN
      SELECT array_agg(id) INTO v_branches FROM public.agency_branches WHERE agency_id = r.agency_id;
    END IF;
    IF v_branches IS NOT NULL AND array_length(v_branches, 1) > 0 THEN
      INSERT INTO public.branch_notifications(branch_id, agency_id, kind, title, message, broadcast_id)
      SELECT unnest(v_branches), r.agency_id, r.kind, r.subject, r.message, v_bid;
    END IF;
    UPDATE public.scheduled_broadcasts
      SET status = 'sent', sent_at = now(), broadcast_id = v_bid
      WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 5) pg_cron every minute
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-scheduled-broadcasts') THEN
    PERFORM cron.schedule('dispatch-scheduled-broadcasts', '* * * * *', 'SELECT public.dispatch_scheduled_broadcasts();');
  END IF;
END $$;

-- 6) Storage policies for report-attachments (bucket created via tool)
DROP POLICY IF EXISTS "Managers upload own report attachments" ON storage.objects;
CREATE POLICY "Managers upload own report attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'report-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Read own agency report attachments" ON storage.objects;
CREATE POLICY "Read own agency report attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'report-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.owner_id = auth.uid()
        AND (storage.foldername(name))[2] = a.id::text
    )
  )
);

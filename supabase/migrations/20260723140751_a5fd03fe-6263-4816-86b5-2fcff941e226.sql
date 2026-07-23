
-- 1. Add status detail columns to scheduled_broadcasts
ALTER TABLE public.scheduled_broadcasts
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS fully_read_at timestamptz;

-- Allow 'failed' status (status is text so no enum change needed)

-- 2. Update dispatcher to catch failures per broadcast
CREATE OR REPLACE FUNCTION public.dispatch_scheduled_broadcasts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    BEGIN
      v_bid := gen_random_uuid();
      v_branches := r.target_branch_ids;
      IF v_branches IS NULL OR array_length(v_branches, 1) IS NULL THEN
        SELECT array_agg(id) INTO v_branches FROM public.agency_branches WHERE agency_id = r.agency_id;
      END IF;
      IF v_branches IS NULL OR array_length(v_branches, 1) IS NULL THEN
        UPDATE public.scheduled_broadcasts
          SET status = 'failed', failure_reason = 'Aucune sous-agence destinataire'
          WHERE id = r.id;
        CONTINUE;
      END IF;
      INSERT INTO public.branch_notifications(branch_id, agency_id, kind, title, message, broadcast_id)
      SELECT unnest(v_branches), r.agency_id, r.kind, r.subject, r.message, v_bid;
      UPDATE public.scheduled_broadcasts
        SET status = 'sent', sent_at = now(), broadcast_id = v_bid, failure_reason = NULL
        WHERE id = r.id;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.scheduled_broadcasts
        SET status = 'failed', failure_reason = SQLERRM
        WHERE id = r.id;
    END;
  END LOOP;
  RETURN v_count;
END;
$function$;

-- 3. Trigger: when a broadcast notification is read, check if all recipients have read.
CREATE OR REPLACE FUNCTION public.check_broadcast_fully_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_read int;
BEGIN
  IF NEW.broadcast_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.read_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.read_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT count(*), count(read_at)
    INTO v_total, v_read
    FROM public.branch_notifications
    WHERE broadcast_id = NEW.broadcast_id;

  IF v_total > 0 AND v_total = v_read THEN
    UPDATE public.scheduled_broadcasts
      SET fully_read_at = COALESCE(fully_read_at, now())
      WHERE broadcast_id = NEW.broadcast_id AND fully_read_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_broadcast_fully_read ON public.branch_notifications;
CREATE TRIGGER trg_check_broadcast_fully_read
AFTER UPDATE OF read_at ON public.branch_notifications
FOR EACH ROW EXECUTE FUNCTION public.check_broadcast_fully_read();

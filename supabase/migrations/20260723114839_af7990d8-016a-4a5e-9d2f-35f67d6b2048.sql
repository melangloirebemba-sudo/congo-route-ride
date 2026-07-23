
-- 1. bookings: colonne boarding_branch_id
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS boarding_branch_id uuid REFERENCES public.agency_branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_boarding_branch ON public.bookings(boarding_branch_id);

-- 2. Étendre les politiques RLS bookings au boarding_branch_id
DROP POLICY IF EXISTS "Managers can view bookings of their branch" ON public.bookings;
CREATE POLICY "Managers can view bookings of their branch"
ON public.bookings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = bookings.trip_id
      AND t.branch_id IS NOT NULL
      AND t.branch_id = public.get_manager_branch(auth.uid())
  )
  OR (
    bookings.boarding_branch_id IS NOT NULL
    AND bookings.boarding_branch_id = public.get_manager_branch(auth.uid())
  )
);

DROP POLICY IF EXISTS "Managers can update bookings of their branch" ON public.bookings;
CREATE POLICY "Managers can update bookings of their branch"
ON public.bookings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = bookings.trip_id
      AND t.branch_id IS NOT NULL
      AND t.branch_id = public.get_manager_branch(auth.uid())
  )
  OR (
    bookings.boarding_branch_id IS NOT NULL
    AND bookings.boarding_branch_id = public.get_manager_branch(auth.uid())
  )
);

-- 3. Table de notifications aux sous-agences
CREATE TABLE IF NOT EXISTS public.branch_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.agency_branches(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'booking_assigned',
  title text NOT NULL,
  message text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_notifications TO authenticated;
GRANT ALL ON public.branch_notifications TO service_role;

ALTER TABLE public.branch_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners see notifications of their agency"
ON public.branch_notifications FOR SELECT
USING (public.is_agency_owner(agency_id));

CREATE POLICY "Managers see notifications for their branch"
ON public.branch_notifications FOR SELECT
USING (branch_id = public.get_manager_branch(auth.uid()));

CREATE POLICY "Managers mark their notifications"
ON public.branch_notifications FOR UPDATE
USING (branch_id = public.get_manager_branch(auth.uid()))
WITH CHECK (branch_id = public.get_manager_branch(auth.uid()));

CREATE POLICY "Owners mark notifications of their agency"
ON public.branch_notifications FOR UPDATE
USING (public.is_agency_owner(agency_id))
WITH CHECK (public.is_agency_owner(agency_id));

CREATE INDEX IF NOT EXISTS idx_branch_notif_branch ON public.branch_notifications(branch_id, read_at);

-- 4. Trigger auto-notification à l'assignation d'un boarding_branch_id
CREATE OR REPLACE FUNCTION public.notify_boarding_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_branch public.agency_branches%ROWTYPE;
BEGIN
  IF NEW.boarding_branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.boarding_branch_id IS NOT DISTINCT FROM NEW.boarding_branch_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = NEW.trip_id;
  SELECT * INTO v_branch FROM public.agency_branches WHERE id = NEW.boarding_branch_id;

  INSERT INTO public.branch_notifications(branch_id, agency_id, booking_id, kind, title, message)
  VALUES (
    NEW.boarding_branch_id,
    v_trip.agency_id,
    NEW.id,
    'booking_assigned',
    'Nouvelle réservation à embarquer',
    format('Passager %s, siège #%s, trajet %s → %s le %s à %s (code %s).',
      NEW.passenger_name, NEW.seat_number,
      COALESCE(v_trip.departure,'?'), COALESCE(v_trip.destination,'?'),
      COALESCE(v_trip.date::text,'?'), COALESCE(v_trip.departure_time::text,'?'),
      NEW.qr_code)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_boarding_branch_ins ON public.bookings;
CREATE TRIGGER trg_notify_boarding_branch_ins
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_boarding_branch();

DROP TRIGGER IF EXISTS trg_notify_boarding_branch_upd ON public.bookings;
CREATE TRIGGER trg_notify_boarding_branch_upd
AFTER UPDATE OF boarding_branch_id ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_boarding_branch();

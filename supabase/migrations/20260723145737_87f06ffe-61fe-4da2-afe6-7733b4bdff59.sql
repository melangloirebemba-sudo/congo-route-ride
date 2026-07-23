
-- Passenger notifications inbox
CREATE TABLE IF NOT EXISTS public.passenger_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE,
  agency_id uuid,
  branch_id uuid REFERENCES public.agency_branches(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'boarding_info',
  title text NOT NULL,
  message text NOT NULL,
  boarding_date date,
  boarding_time time,
  boarding_location text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.passenger_notifications TO authenticated;
GRANT ALL ON public.passenger_notifications TO service_role;

ALTER TABLE public.passenger_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own passenger notifications"
  ON public.passenger_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own passenger notifications"
  ON public.passenger_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_passenger_notifications_user ON public.passenger_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passenger_notifications_trip ON public.passenger_notifications(trip_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.passenger_notifications;

-- Broadcast RPC: sub-agency notifies all paid passengers of a trip
-- boarding at their branch, using the sending branch's address/city as location.
CREATE OR REPLACE FUNCTION public.broadcast_boarding_info(
  _trip_id uuid,
  _extra_message text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_branch public.agency_branches%ROWTYPE;
  v_trip public.trips%ROWTYPE;
  v_is_owner boolean := false;
  v_branch_id uuid;
  v_location text;
  v_title text;
  v_msg text;
  v_count int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'notfound', 'message', 'Trajet introuvable');
  END IF;

  -- Determine sender branch: manager's branch, or owner picks trip.branch_id
  SELECT branch_id INTO v_branch_id FROM public.branch_managers
    WHERE user_id = v_uid AND status = 'active' AND agency_id = v_trip.agency_id LIMIT 1;

  IF v_branch_id IS NULL THEN
    v_is_owner := public.is_agency_owner(v_trip.agency_id) OR public.has_role(v_uid, 'admin');
    IF NOT v_is_owner THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
    END IF;
    v_branch_id := v_trip.branch_id;
  END IF;

  IF v_branch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_branch', 'message', 'Aucune agence expéditrice');
  END IF;

  SELECT * INTO v_branch FROM public.agency_branches WHERE id = v_branch_id;

  v_location := COALESCE(
    NULLIF(trim(concat_ws(' — ', v_branch.name, concat_ws(', ', v_branch.address, v_branch.district, v_branch.city))), ''),
    v_branch.name
  );

  v_title := 'Rappel embarquement : ' || COALESCE(v_trip.departure,'?') || ' → ' || COALESCE(v_trip.destination,'?');
  v_msg := format(
    'Embarquement le %s à %s. Lieu : %s.%s',
    to_char(v_trip.date, 'DD/MM/YYYY'),
    to_char(v_trip.departure_time, 'HH24:MI'),
    v_location,
    CASE WHEN _extra_message IS NOT NULL AND length(trim(_extra_message)) > 0
         THEN E'\n' || _extra_message ELSE '' END
  );

  WITH targets AS (
    SELECT DISTINCT ON (b.user_id) b.id AS booking_id, b.user_id
    FROM public.bookings b
    WHERE b.trip_id = _trip_id
      AND b.payment_status = 'paid'
      AND b.status <> 'cancelled'
      AND b.user_id IS NOT NULL
      AND (
        b.boarding_branch_id = v_branch_id
        OR (b.boarding_branch_id IS NULL AND v_trip.branch_id = v_branch_id)
      )
  ), ins AS (
    INSERT INTO public.passenger_notifications
      (user_id, booking_id, trip_id, agency_id, branch_id, kind, title, message,
       boarding_date, boarding_time, boarding_location)
    SELECT t.user_id, t.booking_id, _trip_id, v_trip.agency_id, v_branch_id,
           'boarding_info', v_title, v_msg,
           v_trip.date, v_trip.departure_time, v_location
    FROM targets t
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  INSERT INTO public.agency_audit_logs(actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
  VALUES (v_uid, public._actor_role(v_uid), v_trip.agency_id, v_branch_id,
          'boarding_broadcast', 'trip', _trip_id,
          jsonb_build_object('recipients', v_count, 'location', v_location,
                             'date', v_trip.date, 'time', v_trip.departure_time));

  RETURN jsonb_build_object('ok', true, 'sent', v_count, 'location', v_location);
END;
$$;

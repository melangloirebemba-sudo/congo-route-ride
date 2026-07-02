
CREATE TABLE public.seat_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  seat_number integer NOT NULL,
  locked_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX seat_locks_trip_seat_uniq ON public.seat_locks(trip_id, seat_number);
CREATE INDEX seat_locks_expires_idx ON public.seat_locks(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seat_locks TO authenticated;
GRANT ALL ON public.seat_locks TO service_role;

ALTER TABLE public.seat_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read seat locks"
  ON public.seat_locks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage their own locks"
  ON public.seat_locks FOR ALL TO authenticated
  USING (locked_by = auth.uid()) WITH CHECK (locked_by = auth.uid());

CREATE OR REPLACE FUNCTION public.lock_seat(_trip_id uuid, _seat_number integer, _ttl_seconds integer DEFAULT 300)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.seat_locks%ROWTYPE;
  v_booked boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'Non authentifié');
  END IF;

  -- clean expired locks for this trip
  DELETE FROM public.seat_locks WHERE trip_id = _trip_id AND expires_at < now();

  -- seat already booked?
  SELECT EXISTS(
    SELECT 1 FROM public.bookings
    WHERE trip_id = _trip_id AND seat_number = _seat_number AND status <> 'cancelled'
  ) INTO v_booked;
  IF v_booked THEN
    RETURN jsonb_build_object('ok', false, 'code', 'booked', 'message', 'Ce siège est déjà réservé');
  END IF;

  SELECT * INTO v_existing FROM public.seat_locks
    WHERE trip_id = _trip_id AND seat_number = _seat_number FOR UPDATE;

  IF FOUND THEN
    IF v_existing.locked_by = v_uid THEN
      UPDATE public.seat_locks
        SET expires_at = now() + make_interval(secs => _ttl_seconds)
        WHERE id = v_existing.id
        RETURNING expires_at INTO v_existing.expires_at;
      RETURN jsonb_build_object('ok', true, 'code', 'renewed', 'expires_at', v_existing.expires_at);
    ELSE
      RETURN jsonb_build_object('ok', false, 'code', 'locked', 'message', 'Ce siège est en cours de réservation par un autre agent', 'expires_at', v_existing.expires_at);
    END IF;
  END IF;

  INSERT INTO public.seat_locks(trip_id, seat_number, locked_by, expires_at)
    VALUES (_trip_id, _seat_number, v_uid, now() + make_interval(secs => _ttl_seconds))
    RETURNING expires_at INTO v_existing.expires_at;

  RETURN jsonb_build_object('ok', true, 'code', 'locked', 'expires_at', v_existing.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_seat(_trip_id uuid, _seat_number integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;
  DELETE FROM public.seat_locks
    WHERE trip_id = _trip_id AND seat_number = _seat_number AND locked_by = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

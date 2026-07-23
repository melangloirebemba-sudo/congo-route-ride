CREATE OR REPLACE FUNCTION public.prevent_past_trip_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_datetime TIMESTAMPTZ;
BEGIN
  SELECT ((t.date::text || ' ' || COALESCE(t.departure_time::text, '00:00')) )::timestamp AT TIME ZONE 'Africa/Brazzaville'
    INTO trip_datetime
  FROM public.trips t
  WHERE t.id = NEW.trip_id;

  IF trip_datetime IS NULL THEN
    RAISE EXCEPTION 'Trajet introuvable';
  END IF;

  IF trip_datetime < now() THEN
    RAISE EXCEPTION 'Ce trajet est déjà passé, réservation impossible';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_past_trip_booking ON public.bookings;
CREATE TRIGGER trg_prevent_past_trip_booking
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_past_trip_booking();
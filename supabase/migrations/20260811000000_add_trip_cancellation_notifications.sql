-- 1. Create function to notify passengers when a trip is cancelled or edited
CREATE OR REPLACE FUNCTION public.notify_trip_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_booking record;
BEGIN
  -- Handle Cancellation
  IF (TG_OP = 'UPDATE' AND OLD.status != 'cancelled' AND NEW.status = 'cancelled') THEN
    v_title := 'Voyage Annulé : ' || OLD.departure || ' → ' || OLD.destination;
    v_message := 'Nous sommes au regret de vous informer que votre voyage prévu le ' || 
                 to_char(OLD.date, 'DD/MM/YYYY') || ' à ' || 
                 to_char(OLD.departure_time, 'HH24:MI') || 
                 ' a été annulé par l''agence. Veuillez contacter l''agence pour un remboursement ou un report.';
    
    FOR v_booking IN 
      SELECT id, user_id FROM public.bookings 
      WHERE trip_id = NEW.id AND status != 'cancelled' AND user_id IS NOT NULL
    LOOP
      INSERT INTO public.passenger_notifications (user_id, booking_id, trip_id, agency_id, branch_id, kind, title, message)
      VALUES (v_booking.user_id, v_booking.id, NEW.id, NEW.agency_id, NEW.branch_id, 'trip_cancelled', v_title, v_message);
    END LOOP;
  END IF;

  -- Handle change in departure time or date (if not cancelled)
  IF (TG_OP = 'UPDATE' AND NEW.status != 'cancelled') THEN
    IF (OLD.date != NEW.date OR OLD.departure_time != NEW.departure_time) THEN
      v_title := 'Modification d''horaire : ' || NEW.departure || ' → ' || NEW.destination;
      v_message := 'L''horaire de votre voyage a été modifié. Nouvel horaire : ' || 
                   to_char(NEW.date, 'DD/MM/YYYY') || ' à ' || 
                   to_char(NEW.departure_time, 'HH24:MI') || 
                   ' (Anciennement : ' || to_char(OLD.date, 'DD/MM/YYYY') || ' à ' || 
                   to_char(OLD.departure_time, 'HH24:MI') || ').';

      FOR v_booking IN 
        SELECT id, user_id FROM public.bookings 
        WHERE trip_id = NEW.id AND status != 'cancelled' AND user_id IS NOT NULL
      LOOP
        INSERT INTO public.passenger_notifications (user_id, booking_id, trip_id, agency_id, branch_id, kind, title, message)
        VALUES (v_booking.user_id, v_booking.id, NEW.id, NEW.agency_id, NEW.branch_id, 'trip_updated', v_title, v_message);
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Create trigger on trips table
CREATE TRIGGER trg_notify_trip_change
AFTER UPDATE ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.notify_trip_change();

-- 3. Function to notify if seats become unavailable (e.g. reduction of total seats below current bookings)
CREATE OR REPLACE FUNCTION public.notify_seat_unavailability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid_count int;
  v_title text := 'Alerte : Places indisponibles';
  v_message text;
  v_booking record;
BEGIN
  -- If total_seats is reduced, check if it's now below the number of active bookings
  IF (NEW.total_seats < OLD.total_seats) THEN
    SELECT count(*) INTO v_paid_count FROM public.bookings 
    WHERE trip_id = NEW.id AND status != 'cancelled';

    IF (NEW.total_seats < v_paid_count) THEN
      v_message := 'Suite à un changement technique, le nombre de places sur votre trajet ' || 
                   NEW.departure || ' → ' || NEW.destination || ' du ' || 
                   to_char(NEW.date, 'DD/MM/YYYY') || 
                   ' a été réduit. Votre réservation est maintenue mais l''agence pourrait vous contacter pour un réajustement.';
      
      -- Notify affected passengers (simple version: notify all active bookings for this trip)
      FOR v_booking IN 
        SELECT id, user_id FROM public.bookings 
        WHERE trip_id = NEW.id AND status != 'cancelled' AND user_id IS NOT NULL
      LOOP
        INSERT INTO public.passenger_notifications (user_id, booking_id, trip_id, agency_id, branch_id, kind, title, message)
        VALUES (v_booking.user_id, v_booking.id, NEW.id, NEW.agency_id, NEW.branch_id, 'seat_unavailability', v_title, v_message);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create trigger for seat unavailability
CREATE TRIGGER trg_notify_seat_unavailability
AFTER UPDATE OF total_seats ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.notify_seat_unavailability();

-- 5. Migration completed log
INSERT INTO public.agency_audit_logs(actor_id, action, entity_type, details)
VALUES (auth.uid(), 'migration_applied', 'schema', '{"version": "20260811000000", "description": "Trip change and seat reduction notifications"}');

CREATE OR REPLACE FUNCTION public.enforce_boarding_branch_counter_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_trip public.trips%ROWTYPE;
  v_is_privileged boolean;
  v_is_online_self boolean;
BEGIN
  IF NEW.boarding_branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = NEW.trip_id;

  v_is_privileged := public.has_role(v_uid, 'admin')
    OR (v_trip.agency_id IS NOT NULL AND public.is_agency_owner(v_trip.agency_id))
    OR EXISTS (SELECT 1 FROM public.branch_managers
               WHERE user_id = v_uid AND status = 'active'
                 AND agency_id = v_trip.agency_id);

  -- Allow online self-service bookings: the customer selects their own boarding branch
  v_is_online_self := COALESCE(NEW.sale_channel, 'online') = 'online'
    AND NEW.user_id IS NOT NULL
    AND NEW.user_id = v_uid;

  IF NOT v_is_privileged AND NOT v_is_online_self THEN
    RAISE EXCEPTION 'Le choix du lieu d''embarquement est réservé aux ventes au guichet'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- Item 2: Explicit server-side block for sub-agencies (branch managers) on trip write operations.
-- Managers must never insert, update or delete trips even if they call the API directly.
CREATE OR REPLACE FUNCTION public.block_manager_trip_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  -- Admins are always allowed
  IF public.has_role(v_uid, 'admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Branch managers are strictly forbidden from writing to trips
  IF EXISTS (SELECT 1 FROM public.branch_managers
             WHERE user_id = v_uid AND status = 'active') THEN
    RAISE EXCEPTION 'Les sous-agences ne peuvent pas modifier ou supprimer un trajet'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_block_manager_trip_writes ON public.trips;
CREATE TRIGGER trg_block_manager_trip_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.block_manager_trip_writes();

-- Item 3: Restrict `boarding_branch_id` to counter sales only (agency owner / branch manager / admin).
-- If a regular client tries to set a boarding branch, reject the insert/update.
CREATE OR REPLACE FUNCTION public.enforce_boarding_branch_counter_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trip public.trips%ROWTYPE;
  v_is_privileged boolean;
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

  IF NOT v_is_privileged THEN
    RAISE EXCEPTION 'Le choix du lieu d''embarquement est réservé aux ventes au guichet'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_boarding_branch_counter_only ON public.bookings;
CREATE TRIGGER trg_enforce_boarding_branch_counter_only
  BEFORE INSERT OR UPDATE OF boarding_branch_id ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_boarding_branch_counter_only();

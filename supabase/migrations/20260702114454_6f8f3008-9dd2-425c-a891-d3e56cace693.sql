
-- Helpers
CREATE OR REPLACE FUNCTION public.get_manager_agency(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agency_id FROM public.branch_managers WHERE user_id = _user_id AND status = 'active' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_manager_branch(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.branch_managers WHERE user_id = _user_id AND status = 'active' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_branch_manager_of(_agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.branch_managers
    WHERE user_id = auth.uid() AND agency_id = _agency_id AND status = 'active'
  )
$$;

-- Managers can view bookings on trips of their agency
CREATE POLICY "Managers can view bookings of their agency"
ON public.bookings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.trips t
  WHERE t.id = bookings.trip_id AND public.is_branch_manager_of(t.agency_id)
));

-- Managers can update bookings on trips of their agency (for status changes)
CREATE POLICY "Managers can update bookings of their agency"
ON public.bookings FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.trips t
  WHERE t.id = bookings.trip_id AND public.is_branch_manager_of(t.agency_id)
));

-- Managers can view branches of their agency
CREATE POLICY "Managers can view branches of their agency"
ON public.agency_branches FOR SELECT
USING (public.is_branch_manager_of(agency_id));

-- Managers can view their agency
CREATE POLICY "Managers can view their agency"
ON public.agencies FOR SELECT
USING (public.is_branch_manager_of(id));

-- Update check_in_booking to allow managers
CREATE OR REPLACE FUNCTION public.check_in_booking(_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.bookings%ROWTYPE;
  v_trip public.trips%ROWTYPE;
  v_agency_owner uuid;
  v_is_admin boolean;
  v_is_manager boolean := false;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'Non authentifié');
  END IF;

  SELECT * INTO v_row FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'notfound', 'message', 'Réservation introuvable');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_row.trip_id;
  IF FOUND THEN
    SELECT owner_id INTO v_agency_owner FROM public.agencies WHERE id = v_trip.agency_id;
    v_is_manager := public.is_branch_manager_of(v_trip.agency_id);
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin');

  IF NOT v_is_admin AND NOT v_is_manager AND (v_agency_owner IS NULL OR v_agency_owner <> v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Accès refusé pour cette agence');
  END IF;

  IF v_row.status IN ('used','checked_in') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'used', 'message', 'Billet déjà utilisé', 'status', v_row.status, 'payment_status', v_row.payment_status);
  END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'cancelled', 'message', 'Billet annulé', 'status', v_row.status, 'payment_status', v_row.payment_status);
  END IF;
  IF v_row.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unpaid', 'message', 'Billet non payé', 'status', v_row.status, 'payment_status', v_row.payment_status);
  END IF;
  IF v_trip.id IS NOT NULL AND (v_trip.date::date < CURRENT_DATE) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'expired', 'message', 'Trajet expiré', 'status', v_row.status, 'payment_status', v_row.payment_status);
  END IF;

  UPDATE public.bookings SET status = 'used', updated_at = now() WHERE id = _booking_id;

  RETURN jsonb_build_object('ok', true, 'code', 'checked_in', 'message', 'Embarquement validé', 'status', 'used', 'payment_status', v_row.payment_status, 'checked_in_at', now());
END;
$$;

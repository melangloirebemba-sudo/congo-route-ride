
CREATE OR REPLACE FUNCTION public.check_in_booking(_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.bookings%ROWTYPE;
  v_trip public.trips%ROWTYPE;
  v_agency_owner uuid;
  v_is_admin boolean;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'Non authentifié');
  END IF;

  -- Lock the booking row to serialize concurrent check-ins
  SELECT * INTO v_row FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'notfound', 'message', 'Réservation introuvable');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_row.trip_id;
  IF FOUND THEN
    SELECT owner_id INTO v_agency_owner FROM public.agencies WHERE id = v_trip.agency_id;
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin');

  IF NOT v_is_admin AND (v_agency_owner IS NULL OR v_agency_owner <> v_uid) THEN
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
  IF v_trip.id IS NOT NULL AND (v_trip.departure_date::date < CURRENT_DATE) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'expired', 'message', 'Trajet expiré', 'status', v_row.status, 'payment_status', v_row.payment_status);
  END IF;

  UPDATE public.bookings
     SET status = 'used', updated_at = now()
   WHERE id = _booking_id;

  RETURN jsonb_build_object('ok', true, 'code', 'checked_in', 'message', 'Embarquement validé', 'status', 'used', 'payment_status', v_row.payment_status, 'checked_in_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_booking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO service_role;

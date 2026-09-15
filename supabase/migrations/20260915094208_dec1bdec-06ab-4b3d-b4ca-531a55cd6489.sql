CREATE OR REPLACE FUNCTION public.collect_cash_payment(_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  t RECORD;
  ag RECORD;
  _uid uuid := auth.uid();
  _allowed boolean := false;
  _rate numeric;
  _commission integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Non authentifié');
  END IF;

  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Réservation introuvable');
  END IF;

  SELECT * INTO t FROM public.trips WHERE id = b.trip_id;
  SELECT * INTO ag FROM public.agencies WHERE id = t.agency_id;

  IF public.has_role(_uid, 'admin') THEN
    _allowed := true;
  ELSIF ag.owner_id = _uid THEN
    _allowed := true;
  ELSIF public.get_manager_agency(_uid) = t.agency_id
        AND (b.boarding_branch_id IS NULL OR public.get_manager_branch(_uid) = b.boarding_branch_id) THEN
    _allowed := true;
  END IF;

  IF NOT _allowed THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Action non autorisée pour ce guichet');
  END IF;

  IF b.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Réservation annulée : encaissement impossible');
  END IF;

  IF b.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Cette réservation est déjà payée');
  END IF;

  UPDATE public.bookings
  SET payment_status = 'paid',
      payment_method = 'cash',
      status = 'confirmed',
      payment_deadline = NULL,
      updated_at = now()
  WHERE id = _booking_id;

  _rate := COALESCE(ag.commission_rate, 10);
  _commission := ROUND(COALESCE(b.total_amount, 0) * _rate / 100.0);

  INSERT INTO public.transactions (booking_id, agency_id, amount, commission, net_amount, payment_method, status)
  VALUES (_booking_id, t.agency_id, COALESCE(b.total_amount, 0), _commission, COALESCE(b.total_amount, 0) - _commission, 'cash', 'completed');

  IF b.user_id IS NOT NULL THEN
    INSERT INTO public.passenger_notifications (user_id, booking_id, trip_id, agency_id, branch_id, kind, title, message)
    VALUES (b.user_id, _booking_id, b.trip_id, t.agency_id, b.boarding_branch_id, 'payment_confirmed',
            'Paiement encaissé au guichet',
            'Votre réservation ' || COALESCE(b.qr_code, '') || ' a été payée en espèces au guichet. Votre billet est confirmé.');
  END IF;

  INSERT INTO public.agency_audit_logs (actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
  VALUES (_uid, public._actor_role(_uid), t.agency_id, b.boarding_branch_id, 'cash_payment_collected', 'booking', _booking_id,
          jsonb_build_object('amount', b.total_amount, 'previous_method', b.payment_method, 'sale_channel', b.sale_channel));

  RETURN jsonb_build_object('ok', true, 'message', 'Paiement en espèces encaissé');
END;
$$;

REVOKE ALL ON FUNCTION public.collect_cash_payment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.collect_cash_payment(uuid) TO authenticated;
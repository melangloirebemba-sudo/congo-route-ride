
-- Payment simulation: init a "MoMo request" as a passenger_notification of kind 'payment_request'
CREATE OR REPLACE FUNCTION public.init_payment_simulation(_booking_id uuid, _momo_phone text, _provider text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_b public.bookings%ROWTYPE;
  v_trip public.trips%ROWTYPE;
  v_notif_id uuid;
  v_provider text := lower(coalesce(_provider,'mtn'));
  v_label text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code','unauthenticated');
  END IF;
  SELECT * INTO v_b FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code','notfound'); END IF;
  IF v_b.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'code','forbidden');
  END IF;
  IF v_b.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'code','already_paid');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_b.trip_id;

  v_label := CASE v_provider WHEN 'airtel' THEN 'Airtel Money' WHEN 'mtn' THEN 'MTN MoMo' ELSE 'Mobile Money' END;

  -- Mark booking as awaiting confirmation, store MoMo phone in payment_method
  UPDATE public.bookings
  SET payment_status = 'pending',
      payment_method = v_label || ' (' || _momo_phone || ')',
      updated_at = now()
  WHERE id = _booking_id;

  -- Purge older unread payment_request notifications for this booking
  DELETE FROM public.passenger_notifications
  WHERE booking_id = _booking_id AND kind = 'payment_request' AND read_at IS NULL;

  INSERT INTO public.passenger_notifications(user_id, booking_id, trip_id, agency_id, kind, title, message)
  VALUES (
    v_uid, _booking_id, v_b.trip_id, v_trip.agency_id, 'payment_request',
    'Confirmez votre paiement ' || v_label,
    format('Une demande de paiement de %s FCFA a été envoyée au %s via %s pour le trajet %s → %s (siège #%s, code %s). Confirmez ou refusez cette transaction.',
      v_b.total_amount::text, _momo_phone, v_label,
      COALESCE(v_trip.departure,'?'), COALESCE(v_trip.destination,'?'),
      v_b.seat_number::text, v_b.qr_code)
  ) RETURNING id INTO v_notif_id;

  RETURN jsonb_build_object('ok', true, 'notification_id', v_notif_id, 'booking_id', _booking_id);
END;
$$;

-- Confirm the simulated payment
CREATE OR REPLACE FUNCTION public.confirm_payment_simulation(_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n public.passenger_notifications%ROWTYPE;
  v_b public.bookings%ROWTYPE;
  v_trip public.trips%ROWTYPE;
  v_commission integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'code','unauthenticated'); END IF;
  SELECT * INTO v_n FROM public.passenger_notifications WHERE id = _notification_id FOR UPDATE;
  IF NOT FOUND OR v_n.user_id <> v_uid OR v_n.kind <> 'payment_request' THEN
    RETURN jsonb_build_object('ok', false, 'code','forbidden');
  END IF;
  SELECT * INTO v_b FROM public.bookings WHERE id = v_n.booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code','notfound'); END IF;
  IF v_b.payment_status = 'paid' THEN
    UPDATE public.passenger_notifications SET read_at = now() WHERE id = _notification_id;
    RETURN jsonb_build_object('ok', true, 'code','already_paid');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_b.trip_id;
  v_commission := round((v_b.total_amount * 0.1)::numeric);

  UPDATE public.bookings
  SET payment_status = 'paid',
      status = 'confirmed',
      updated_at = now()
  WHERE id = v_b.id;

  INSERT INTO public.transactions(agency_id, amount, commission, net_amount, payment_method, status)
  VALUES (v_trip.agency_id, v_b.total_amount, v_commission, v_b.total_amount - v_commission,
          COALESCE(v_b.payment_method,'Mobile Money'), 'completed');

  UPDATE public.passenger_notifications SET read_at = now() WHERE id = _notification_id;

  INSERT INTO public.passenger_notifications(user_id, booking_id, trip_id, agency_id, kind, title, message)
  VALUES (v_uid, v_b.id, v_b.trip_id, v_trip.agency_id, 'payment_confirmed',
    'Paiement confirmé',
    format('Votre paiement de %s FCFA pour le trajet %s → %s a été confirmé. Billet %s.',
      v_b.total_amount::text, COALESCE(v_trip.departure,'?'), COALESCE(v_trip.destination,'?'), v_b.qr_code));

  RETURN jsonb_build_object('ok', true, 'booking_id', v_b.id);
END;
$$;

-- Refuse the simulated payment
CREATE OR REPLACE FUNCTION public.refuse_payment_simulation(_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n public.passenger_notifications%ROWTYPE;
  v_b public.bookings%ROWTYPE;
  v_trip public.trips%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'code','unauthenticated'); END IF;
  SELECT * INTO v_n FROM public.passenger_notifications WHERE id = _notification_id FOR UPDATE;
  IF NOT FOUND OR v_n.user_id <> v_uid OR v_n.kind <> 'payment_request' THEN
    RETURN jsonb_build_object('ok', false, 'code','forbidden');
  END IF;
  SELECT * INTO v_b FROM public.bookings WHERE id = v_n.booking_id;
  SELECT * INTO v_trip FROM public.trips WHERE id = v_b.trip_id;

  UPDATE public.passenger_notifications SET read_at = now() WHERE id = _notification_id;

  IF v_b.payment_status <> 'paid' THEN
    UPDATE public.bookings
    SET payment_status = 'pending',
        payment_method = NULL,
        updated_at = now()
    WHERE id = v_b.id;
  END IF;

  INSERT INTO public.passenger_notifications(user_id, booking_id, trip_id, agency_id, kind, title, message)
  VALUES (v_uid, v_b.id, v_b.trip_id, v_trip.agency_id, 'payment_refused',
    'Paiement refusé',
    format('Vous avez refusé la transaction pour le billet %s. Vous pouvez relancer un paiement depuis vos réservations.', v_b.qr_code));

  RETURN jsonb_build_object('ok', true);
END;
$$;

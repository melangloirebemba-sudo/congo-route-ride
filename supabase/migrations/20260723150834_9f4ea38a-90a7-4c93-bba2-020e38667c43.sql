
CREATE OR REPLACE FUNCTION public.claim_booking_by_ref(_qr text, _phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_b public.bookings%ROWTYPE;
  v_owner_is_anon boolean := false;
  v_trip public.trips%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'Connectez-vous d''abord');
  END IF;
  IF _qr IS NULL OR length(trim(_qr)) = 0 OR _phone IS NULL OR length(trim(_phone)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_input', 'message', 'Code du billet et téléphone requis');
  END IF;

  SELECT * INTO v_b FROM public.bookings WHERE qr_code = _qr FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'notfound', 'message', 'Billet introuvable');
  END IF;

  IF regexp_replace(coalesce(v_b.phone,''), '\D', '', 'g')
     <> regexp_replace(_phone, '\D', '', 'g') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'phone_mismatch', 'message', 'Numéro de téléphone incorrect');
  END IF;

  IF v_b.user_id = v_uid THEN
    RETURN jsonb_build_object('ok', true, 'code', 'already_owned', 'message', 'Ce billet est déjà lié à votre compte', 'booking_id', v_b.id);
  END IF;

  IF v_b.user_id IS NOT NULL THEN
    SELECT (au.is_anonymous IS TRUE) INTO v_owner_is_anon FROM auth.users au WHERE au.id = v_b.user_id;
    IF NOT v_owner_is_anon THEN
      RETURN jsonb_build_object('ok', false, 'code', 'already_claimed', 'message', 'Ce billet est déjà lié à un autre compte');
    END IF;
  END IF;

  UPDATE public.bookings SET user_id = v_uid, updated_at = now() WHERE id = v_b.id;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_b.trip_id;
  INSERT INTO public.agency_audit_logs(actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
  VALUES (v_uid, public._actor_role(v_uid), v_trip.agency_id, v_trip.branch_id,
          'booking_claimed', 'booking', v_b.id,
          jsonb_build_object('qr', _qr, 'previous_owner', v_b.user_id));

  RETURN jsonb_build_object('ok', true, 'code', 'claimed', 'message', 'Billet récupéré avec succès', 'booking_id', v_b.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_booking_by_ref(text, text) TO authenticated;

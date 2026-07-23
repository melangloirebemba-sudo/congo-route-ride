
-- 1) Unicité globale du code QR
CREATE UNIQUE INDEX IF NOT EXISTS bookings_qr_code_unique ON public.bookings (qr_code) WHERE qr_code IS NOT NULL;

-- 2) Statut d'embarquement
DO $$ BEGIN
  CREATE TYPE public.boarding_status AS ENUM ('pending', 'boarded', 'refused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS boarding_status public.boarding_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS boarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS boarded_by uuid,
  ADD COLUMN IF NOT EXISTS boarding_notes text;

-- Rétro-compat : billets déjà utilisés = embarqués
UPDATE public.bookings SET boarding_status = 'boarded', boarded_at = COALESCE(boarded_at, updated_at)
  WHERE status = 'used' AND boarding_status = 'pending';

-- 3) Met à jour check_in_booking pour renseigner le statut d'embarquement
CREATE OR REPLACE FUNCTION public.check_in_booking(_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.bookings%ROWTYPE;
  v_trip public.trips%ROWTYPE;
  v_agency_owner uuid;
  v_is_admin boolean;
  v_is_manager boolean := false;
  v_manager_branch uuid;
  v_branch public.agency_branches%ROWTYPE;
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
    v_manager_branch := public.get_manager_branch(v_uid);
    v_is_manager := v_manager_branch IS NOT NULL
                    AND (
                      (v_trip.branch_id IS NOT NULL AND v_trip.branch_id = v_manager_branch)
                      OR (v_row.boarding_branch_id IS NOT NULL AND v_row.boarding_branch_id = v_manager_branch)
                    );
    IF v_is_manager THEN
      SELECT * INTO v_branch FROM public.agency_branches WHERE id = v_manager_branch;
      IF NOT COALESCE(v_branch.can_scan, true) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'forbidden',
          'message', 'Permission « scanner les billets » désactivée pour votre agence secondaire');
      END IF;
    END IF;
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin');

  IF NOT v_is_admin AND NOT v_is_manager AND (v_agency_owner IS NULL OR v_agency_owner <> v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Accès refusé pour cette branche');
  END IF;

  IF v_row.boarding_status = 'refused' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'refused', 'message', 'Billet refusé à l''embarquement', 'status', v_row.status, 'payment_status', v_row.payment_status, 'boarding_status', v_row.boarding_status);
  END IF;
  IF v_row.status IN ('used','checked_in') OR v_row.boarding_status = 'boarded' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'used', 'message', 'Billet déjà utilisé', 'status', v_row.status, 'payment_status', v_row.payment_status, 'boarding_status', 'boarded');
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

  UPDATE public.bookings
    SET status = 'used',
        boarding_status = 'boarded',
        boarded_at = now(),
        boarded_by = v_uid,
        updated_at = now()
    WHERE id = _booking_id;

  INSERT INTO public.agency_audit_logs(actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
  VALUES (v_uid,
          CASE WHEN v_is_admin THEN 'admin' WHEN v_is_manager THEN 'branch_manager' ELSE 'agency_owner' END,
          v_trip.agency_id, COALESCE(v_manager_branch, v_trip.branch_id),
          'booking_checked_in', 'booking', _booking_id,
          jsonb_build_object('trip_id', v_row.trip_id, 'seat', v_row.seat_number));

  RETURN jsonb_build_object('ok', true, 'code', 'checked_in', 'message', 'Embarquement validé',
    'status', 'used', 'payment_status', v_row.payment_status, 'boarding_status', 'boarded', 'checked_in_at', now());
END;
$function$;

-- 4) Refus d'embarquement
CREATE OR REPLACE FUNCTION public.refuse_boarding(_booking_id uuid, _reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.bookings%ROWTYPE;
  v_trip public.trips%ROWTYPE;
  v_agency_owner uuid;
  v_is_admin boolean;
  v_is_manager boolean := false;
  v_manager_branch uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;
  SELECT * INTO v_row FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'notfound', 'message', 'Réservation introuvable');
  END IF;
  SELECT * INTO v_trip FROM public.trips WHERE id = v_row.trip_id;
  IF FOUND THEN
    SELECT owner_id INTO v_agency_owner FROM public.agencies WHERE id = v_trip.agency_id;
    v_manager_branch := public.get_manager_branch(v_uid);
    v_is_manager := v_manager_branch IS NOT NULL
                    AND (
                      (v_trip.branch_id IS NOT NULL AND v_trip.branch_id = v_manager_branch)
                      OR (v_row.boarding_branch_id IS NOT NULL AND v_row.boarding_branch_id = v_manager_branch)
                    );
  END IF;
  v_is_admin := public.has_role(v_uid, 'admin');
  IF NOT v_is_admin AND NOT v_is_manager AND (v_agency_owner IS NULL OR v_agency_owner <> v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Accès refusé');
  END IF;

  UPDATE public.bookings
    SET boarding_status = 'refused',
        boarded_at = now(),
        boarded_by = v_uid,
        boarding_notes = _reason,
        updated_at = now()
    WHERE id = _booking_id;

  INSERT INTO public.agency_audit_logs(actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
  VALUES (v_uid,
          CASE WHEN v_is_admin THEN 'admin' WHEN v_is_manager THEN 'branch_manager' ELSE 'agency_owner' END,
          v_trip.agency_id, COALESCE(v_manager_branch, v_trip.branch_id),
          'booking_refused', 'booking', _booking_id,
          jsonb_build_object('trip_id', v_row.trip_id, 'seat', v_row.seat_number, 'reason', _reason));

  RETURN jsonb_build_object('ok', true, 'code', 'refused', 'message', 'Billet refusé', 'boarding_status', 'refused');
END;
$function$;

-- 5) Realtime pour les notifications de sous-agence
ALTER TABLE public.branch_notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.branch_notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

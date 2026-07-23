
-- =========================================================
-- 1) Audit log table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.agency_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid,
  actor_role text,
  agency_id uuid,
  branch_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.agency_audit_logs TO authenticated;
GRANT ALL ON public.agency_audit_logs TO service_role;

ALTER TABLE public.agency_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view all audit"        ON public.agency_audit_logs;
DROP POLICY IF EXISTS "Agency owner can view own audit" ON public.agency_audit_logs;
DROP POLICY IF EXISTS "Managers insert audit"           ON public.agency_audit_logs;

CREATE POLICY "Admin can view all audit"
  ON public.agency_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agency owner can view own audit"
  ON public.agency_audit_logs FOR SELECT TO authenticated
  USING (agency_id IS NOT NULL AND public.is_agency_owner(agency_id));

-- Only triggers (security definer) write; block direct inserts by non-privileged clients
CREATE POLICY "Service role inserts audit"
  ON public.agency_audit_logs FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS agency_audit_logs_agency_idx ON public.agency_audit_logs(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agency_audit_logs_branch_idx ON public.agency_audit_logs(branch_id, created_at DESC);

-- =========================================================
-- 2) Helper: current actor role summary
-- =========================================================
CREATE OR REPLACE FUNCTION public._actor_role(_uid uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN _uid IS NULL THEN 'anonymous'
    WHEN public.has_role(_uid, 'admin') THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM public.agencies WHERE owner_id = _uid) THEN 'agency_owner'
    WHEN EXISTS (SELECT 1 FROM public.branch_managers WHERE user_id = _uid AND status = 'active') THEN 'branch_manager'
    ELSE 'user'
  END
$$;

-- =========================================================
-- 3) Permission change trigger on agency_branches
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_branch_permission_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_diff jsonb := '{}'::jsonb;
BEGIN
  IF NEW.can_create_trips IS DISTINCT FROM OLD.can_create_trips THEN
    v_diff := v_diff || jsonb_build_object('can_create_trips', jsonb_build_object('from', OLD.can_create_trips, 'to', NEW.can_create_trips));
  END IF;
  IF NEW.can_sell_counter IS DISTINCT FROM OLD.can_sell_counter THEN
    v_diff := v_diff || jsonb_build_object('can_sell_counter', jsonb_build_object('from', OLD.can_sell_counter, 'to', NEW.can_sell_counter));
  END IF;
  IF NEW.can_scan IS DISTINCT FROM OLD.can_scan THEN
    v_diff := v_diff || jsonb_build_object('can_scan', jsonb_build_object('from', OLD.can_scan, 'to', NEW.can_scan));
  END IF;
  IF NEW.can_view_stats IS DISTINCT FROM OLD.can_view_stats THEN
    v_diff := v_diff || jsonb_build_object('can_view_stats', jsonb_build_object('from', OLD.can_view_stats, 'to', NEW.can_view_stats));
  END IF;

  IF v_diff <> '{}'::jsonb THEN
    INSERT INTO public.agency_audit_logs(actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
    VALUES (v_uid, public._actor_role(v_uid), NEW.agency_id, NEW.id, 'permission_changed', 'branch', NEW.id,
            jsonb_build_object('branch_name', NEW.name, 'changes', v_diff));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branch_perm_change ON public.agency_branches;
CREATE TRIGGER trg_branch_perm_change
AFTER UPDATE ON public.agency_branches
FOR EACH ROW EXECUTE FUNCTION public.log_branch_permission_change();

-- =========================================================
-- 4) Enforce + log booking inserts by managers
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_and_log_booking_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mgr public.branch_managers%ROWTYPE;
  v_branch public.agency_branches%ROWTYPE;
  v_trip public.trips%ROWTYPE;
BEGIN
  SELECT * INTO v_trip FROM public.trips WHERE id = NEW.trip_id;

  SELECT * INTO v_mgr FROM public.branch_managers
    WHERE user_id = v_uid AND status = 'active' LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_branch FROM public.agency_branches WHERE id = v_mgr.branch_id;
    IF NOT COALESCE(v_branch.can_sell_counter, true) THEN
      RAISE EXCEPTION 'Permission « vendre au guichet » désactivée pour votre agence secondaire'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.agency_audit_logs(actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
    VALUES (v_uid, 'branch_manager', v_trip.agency_id, v_mgr.branch_id, 'booking_created', 'booking', NEW.id,
            jsonb_build_object('trip_id', NEW.trip_id, 'seat', NEW.seat_number,
                               'amount', NEW.total_amount, 'payment_method', NEW.payment_method,
                               'payment_status', NEW.payment_status));
  ELSIF v_trip.id IS NOT NULL THEN
    -- log online / owner-created sales too
    INSERT INTO public.agency_audit_logs(actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
    VALUES (v_uid, public._actor_role(v_uid), v_trip.agency_id, v_trip.branch_id, 'booking_created', 'booking', NEW.id,
            jsonb_build_object('trip_id', NEW.trip_id, 'seat', NEW.seat_number,
                               'amount', NEW.total_amount, 'payment_method', NEW.payment_method,
                               'payment_status', NEW.payment_status));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_log_booking_insert ON public.bookings;
CREATE TRIGGER trg_enforce_log_booking_insert
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_and_log_booking_insert();

-- =========================================================
-- 5) Enforce + log trip inserts/updates by managers
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_and_log_trip_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mgr public.branch_managers%ROWTYPE;
  v_branch public.agency_branches%ROWTYPE;
  v_action text := lower(TG_OP);
BEGIN
  SELECT * INTO v_mgr FROM public.branch_managers
    WHERE user_id = v_uid AND status = 'active' LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_branch FROM public.agency_branches WHERE id = v_mgr.branch_id;
    IF NOT COALESCE(v_branch.can_create_trips, true) THEN
      RAISE EXCEPTION 'Permission « gérer les trajets » désactivée pour votre agence secondaire'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.agency_audit_logs(actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
  VALUES (v_uid, public._actor_role(v_uid), NEW.agency_id, NEW.branch_id,
          CASE WHEN TG_OP = 'INSERT' THEN 'trip_created' ELSE 'trip_updated' END,
          'trip', NEW.id,
          jsonb_build_object('departure', NEW.departure, 'destination', NEW.destination, 'date', NEW.date, 'price', NEW.price));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_log_trip_change ON public.trips;
CREATE TRIGGER trg_enforce_log_trip_change
BEFORE INSERT OR UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.enforce_and_log_trip_change();

-- =========================================================
-- 6) Update check_in_booking to enforce can_scan + log
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_in_booking(_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
                    AND v_trip.branch_id IS NOT NULL
                    AND v_trip.branch_id = v_manager_branch;
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

  INSERT INTO public.agency_audit_logs(actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
  VALUES (v_uid,
          CASE WHEN v_is_admin THEN 'admin' WHEN v_is_manager THEN 'branch_manager' ELSE 'agency_owner' END,
          v_trip.agency_id, COALESCE(v_manager_branch, v_trip.branch_id),
          'booking_checked_in', 'booking', _booking_id,
          jsonb_build_object('trip_id', v_row.trip_id, 'seat', v_row.seat_number));

  RETURN jsonb_build_object('ok', true, 'code', 'checked_in', 'message', 'Embarquement validé',
    'status', 'used', 'payment_status', v_row.payment_status, 'checked_in_at', now());
END;
$$;

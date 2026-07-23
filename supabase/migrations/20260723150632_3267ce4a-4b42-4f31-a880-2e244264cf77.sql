
CREATE TABLE public.scheduled_boarding_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.agency_branches(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  extra_message text,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  sent_at timestamptz,
  recipients_count int,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_boarding_broadcasts TO authenticated;
GRANT ALL ON public.scheduled_boarding_broadcasts TO service_role;

ALTER TABLE public.scheduled_boarding_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and owners see own agency scheduled boarding broadcasts"
ON public.scheduled_boarding_broadcasts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_agency_owner(agency_id)
  OR public.is_branch_manager_of(agency_id)
);

CREATE POLICY "Managers create scheduled boarding broadcasts for their branch"
ON public.scheduled_boarding_broadcasts FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_agency_owner(agency_id)
    OR (public.is_branch_manager_of(agency_id) AND branch_id = public.get_manager_branch(auth.uid()))
  )
);

CREATE POLICY "Creators cancel their own scheduled boarding broadcasts"
ON public.scheduled_boarding_broadcasts FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_agency_owner(agency_id)
)
WITH CHECK (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_agency_owner(agency_id)
);

CREATE POLICY "Creators delete their own scheduled boarding broadcasts"
ON public.scheduled_boarding_broadcasts FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_agency_owner(agency_id)
);

CREATE TRIGGER sched_boarding_bc_updated
BEFORE UPDATE ON public.scheduled_boarding_broadcasts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dispatcher: runs pending scheduled boarding broadcasts.
CREATE OR REPLACE FUNCTION public.dispatch_scheduled_boarding_broadcasts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.scheduled_boarding_broadcasts%ROWTYPE;
  v_branch public.agency_branches%ROWTYPE;
  v_trip public.trips%ROWTYPE;
  v_location text;
  v_title text;
  v_msg text;
  v_count int := 0;
  v_total int := 0;
BEGIN
  FOR r IN SELECT * FROM public.scheduled_boarding_broadcasts
           WHERE status = 'scheduled' AND scheduled_at <= now()
           FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      SELECT * INTO v_trip FROM public.trips WHERE id = r.trip_id;
      SELECT * INTO v_branch FROM public.agency_branches WHERE id = r.branch_id;
      IF v_trip.id IS NULL OR v_branch.id IS NULL THEN
        UPDATE public.scheduled_boarding_broadcasts
          SET status='failed', failure_reason='Trajet ou sous-agence introuvable'
          WHERE id = r.id;
        CONTINUE;
      END IF;

      v_location := COALESCE(
        NULLIF(trim(concat_ws(' — ', v_branch.name, concat_ws(', ', v_branch.address, v_branch.district, v_branch.city))), ''),
        v_branch.name
      );
      v_title := 'Rappel embarquement : ' || COALESCE(v_trip.departure,'?') || ' → ' || COALESCE(v_trip.destination,'?');
      v_msg := format(
        'Embarquement le %s à %s. Lieu : %s.%s',
        to_char(v_trip.date, 'DD/MM/YYYY'),
        to_char(v_trip.departure_time, 'HH24:MI'),
        v_location,
        CASE WHEN r.extra_message IS NOT NULL AND length(trim(r.extra_message)) > 0
             THEN E'\n' || r.extra_message ELSE '' END
      );

      WITH targets AS (
        SELECT DISTINCT ON (b.user_id) b.id AS booking_id, b.user_id
        FROM public.bookings b
        WHERE b.trip_id = r.trip_id
          AND b.payment_status = 'paid'
          AND b.status <> 'cancelled'
          AND b.user_id IS NOT NULL
          AND (
            b.boarding_branch_id = r.branch_id
            OR (b.boarding_branch_id IS NULL AND v_trip.branch_id = r.branch_id)
          )
      ), ins AS (
        INSERT INTO public.passenger_notifications
          (user_id, booking_id, trip_id, agency_id, branch_id, kind, title, message,
           boarding_date, boarding_time, boarding_location)
        SELECT t.user_id, t.booking_id, r.trip_id, r.agency_id, r.branch_id,
               'boarding_info', v_title, v_msg,
               v_trip.date, v_trip.departure_time, v_location
        FROM targets t
        RETURNING 1
      )
      SELECT count(*) INTO v_total FROM ins;

      UPDATE public.scheduled_boarding_broadcasts
        SET status='sent', sent_at=now(), recipients_count=v_total, failure_reason=NULL
        WHERE id = r.id;

      INSERT INTO public.agency_audit_logs(actor_id, actor_role, agency_id, branch_id, action, entity_type, entity_id, details)
      VALUES (r.created_by, public._actor_role(r.created_by), r.agency_id, r.branch_id,
              'boarding_broadcast_scheduled_sent', 'trip', r.trip_id,
              jsonb_build_object('recipients', v_total, 'location', v_location,
                                 'scheduled_at', r.scheduled_at));

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.scheduled_boarding_broadcasts
        SET status='failed', failure_reason=SQLERRM
        WHERE id = r.id;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Schedule dispatcher every minute
SELECT cron.schedule(
  'dispatch-scheduled-boarding-broadcasts',
  '* * * * *',
  $$SELECT public.dispatch_scheduled_boarding_broadcasts();$$
);

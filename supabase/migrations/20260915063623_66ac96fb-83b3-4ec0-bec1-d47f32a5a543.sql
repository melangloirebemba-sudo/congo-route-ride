ALTER TABLE public.agency_branches
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.agency_branches(id) ON DELETE SET NULL,
  event text NOT NULL,
  to_number text NOT NULL,
  from_number text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  provider_sid text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all whatsapp messages"
ON public.whatsapp_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agency staff view their whatsapp messages"
ON public.whatsapp_messages FOR SELECT TO authenticated
USING (
  agency_id IS NOT NULL
  AND (public.is_agency_owner(agency_id) OR public.is_branch_manager_of(agency_id))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_booking ON public.whatsapp_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_agency_created ON public.whatsapp_messages(agency_id, created_at DESC);
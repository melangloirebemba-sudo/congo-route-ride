
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS sale_channel text NOT NULL DEFAULT 'counter',
  ADD COLUMN IF NOT EXISTS payment_deadline timestamptz;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_sale_channel_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_sale_channel_check
  CHECK (sale_channel IN ('online','counter'));

CREATE INDEX IF NOT EXISTS idx_bookings_sale_channel ON public.bookings(sale_channel);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);

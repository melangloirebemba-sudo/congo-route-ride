
CREATE POLICY "Agency owners can view bookings on their trips"
ON public.bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    JOIN public.agencies a ON a.id = t.agency_id
    WHERE t.id = bookings.trip_id AND a.owner_id = auth.uid()
  )
);

CREATE POLICY "Agency owners can update bookings on their trips"
ON public.bookings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    JOIN public.agencies a ON a.id = t.agency_id
    WHERE t.id = bookings.trip_id AND a.owner_id = auth.uid()
  )
);

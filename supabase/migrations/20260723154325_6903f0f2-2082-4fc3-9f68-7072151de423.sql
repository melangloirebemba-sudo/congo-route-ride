CREATE POLICY "trip_branches public read" ON public.trip_branches FOR SELECT USING (true);
GRANT SELECT ON public.trip_branches TO anon, authenticated;
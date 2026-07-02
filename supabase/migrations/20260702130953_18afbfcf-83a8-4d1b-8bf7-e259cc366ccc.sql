
CREATE TABLE public.city_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, name)
);
GRANT SELECT ON public.city_districts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.city_districts TO authenticated;
GRANT ALL ON public.city_districts TO service_role;
ALTER TABLE public.city_districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read city districts" ON public.city_districts FOR SELECT USING (true);
CREATE POLICY "Admins can insert city districts" ON public.city_districts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update city districts" ON public.city_districts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete city districts" ON public.city_districts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed with existing static list
INSERT INTO public.city_districts (city, name) VALUES
  ('Brazzaville','Makélékélé'),('Brazzaville','Bacongo'),('Brazzaville','Poto-Poto'),
  ('Brazzaville','Moungali'),('Brazzaville','Ouenzé'),('Brazzaville','Talangaï'),
  ('Brazzaville','Mfilou'),('Brazzaville','Madibou'),
  ('Pointe-Noire','Lumumba'),('Pointe-Noire','Mvou-Mvou'),('Pointe-Noire','Tié-Tié'),
  ('Pointe-Noire','Loandjili'),('Pointe-Noire','Mongo-Mpoukou'),('Pointe-Noire','Ngoyo'),
  ('Dolisie','Centre-ville'),('Dolisie','Mouyondzi'),('Dolisie','Loubomo'),
  ('Nkayi','Centre'),('Nkayi','Kimongo')
ON CONFLICT DO NOTHING;

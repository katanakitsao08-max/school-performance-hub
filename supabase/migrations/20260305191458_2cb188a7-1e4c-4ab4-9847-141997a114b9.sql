CREATE TABLE public.streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage streams" ON public.streams FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view streams" ON public.streams FOR SELECT TO authenticated USING (true);

INSERT INTO public.streams (name) VALUES ('A'), ('B'), ('C'), ('D');
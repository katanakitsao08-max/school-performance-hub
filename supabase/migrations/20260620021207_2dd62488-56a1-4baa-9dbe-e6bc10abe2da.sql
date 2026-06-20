CREATE TABLE IF NOT EXISTS public.system_health_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  db_ok boolean NOT NULL,
  latency_ms integer NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_health_pings_created_at ON public.system_health_pings (created_at DESC);
GRANT SELECT, INSERT ON public.system_health_pings TO authenticated;
GRANT ALL ON public.system_health_pings TO service_role;
ALTER TABLE public.system_health_pings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin read health" ON public.system_health_pings;
CREATE POLICY "super_admin read health" ON public.system_health_pings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TABLE IF NOT EXISTS public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'closed' CHECK (status IN ('active','closed','archived')),
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.academic_years TO authenticated, anon;
GRANT ALL ON public.academic_years TO service_role;

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ay_read_all" ON public.academic_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "ay_sa_insert" ON public.academic_years FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "ay_sa_update" ON public.academic_years FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "ay_sa_delete" ON public.academic_years FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS trg_academic_years_updated ON public.academic_years;
CREATE TRIGGER trg_academic_years_updated
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_single_current_year()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.academic_years
      SET is_current = false,
          status = CASE WHEN status='active' THEN 'closed' ELSE status END
      WHERE id <> NEW.id AND is_current = true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_academic_years_single_current ON public.academic_years;
CREATE TRIGGER trg_academic_years_single_current
  BEFORE INSERT OR UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_current_year();

-- Seed rows
WITH src AS (
  SELECT DISTINCT s.year AS y FROM public.scores s WHERE s.year IS NOT NULL
  UNION SELECT DISTINCT f.year FROM public.fee_records f WHERE f.year IS NOT NULL
  UNION SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int
  UNION SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int + 1
)
INSERT INTO public.academic_years (year, status, is_current)
SELECT y, 'closed', false FROM src
ON CONFLICT (year) DO NOTHING;

UPDATE public.academic_years
  SET status = 'active', is_current = true
  WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)::int;

-- FK columns
ALTER TABLE public.scores        ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.attendance    ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.fee_records   ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.strand_scores ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;

UPDATE public.scores s SET academic_year_id = ay.id
  FROM public.academic_years ay WHERE ay.year = s.year AND s.academic_year_id IS NULL;
UPDATE public.fee_records f SET academic_year_id = ay.id
  FROM public.academic_years ay WHERE ay.year = f.year AND f.academic_year_id IS NULL;
UPDATE public.strand_scores ss SET academic_year_id = ay.id
  FROM public.academic_years ay WHERE ay.year = ss.year AND ss.academic_year_id IS NULL;
UPDATE public.attendance a SET academic_year_id = ay.id
  FROM public.academic_years ay WHERE ay.year = EXTRACT(YEAR FROM a.date)::int AND a.academic_year_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_scores_academic_year        ON public.scores(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_attendance_academic_year    ON public.attendance(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_academic_year   ON public.fee_records(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_strand_scores_academic_year ON public.strand_scores(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_notifications_academic_year ON public.notifications(academic_year_id);

CREATE OR REPLACE FUNCTION public.ensure_current_academic_year()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE this_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  INSERT INTO public.academic_years (year, status, is_current)
    VALUES (this_year, 'active', true)
    ON CONFLICT (year) DO UPDATE SET status='active', is_current=true;
  INSERT INTO public.academic_years (year, status, is_current)
    VALUES (this_year + 1, 'closed', false)
    ON CONFLICT (year) DO NOTHING;
END $$;

GRANT EXECUTE ON FUNCTION public.ensure_current_academic_year() TO authenticated, anon;

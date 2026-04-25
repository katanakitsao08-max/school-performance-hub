-- Fee structures
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  grade text NOT NULL,
  term int NOT NULL CHECK (term BETWEEN 1 AND 3),
  year int NOT NULL DEFAULT EXTRACT(year FROM now()),
  fee_type text NOT NULL DEFAULT 'tuition',
  amount numeric NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_structures_lookup
  ON public.fee_structures (school_id, grade, term, year);

ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin school fee_structures"
  ON public.fee_structures FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Users view school fee_structures"
  ON public.fee_structures FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Parent view fee_structures"
  ON public.fee_structures FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'parent'::app_role) AND school_id IN (
    SELECT school_id FROM public.parent_learners WHERE parent_user_id = auth.uid()
  ));

CREATE POLICY "SA full fee_structures"
  ON public.fee_structures FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_fee_structures_updated
  BEFORE UPDATE ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit fields + receipt number on fee_records
ALTER TABLE public.fee_records
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_records_receipt
  ON public.fee_records (school_id, receipt_number)
  WHERE receipt_number IS NOT NULL;

-- Receipt number generator function
CREATE OR REPLACE FUNCTION public.generate_receipt_number(_school_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_seq int;
  yr text;
BEGIN
  yr := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CASE WHEN receipt_number ~ ('^RCP-' || yr || '-[0-9]+$')
      THEN (regexp_replace(receipt_number, '^RCP-' || yr || '-', ''))::int
      ELSE 0
    END
  ), 0) + 1
  INTO next_seq
  FROM public.fee_records
  WHERE school_id = _school_id;
  RETURN 'RCP-' || yr || '-' || lpad(next_seq::text, 5, '0');
END;
$$;

-- Create fee_records table
CREATE TABLE public.fee_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id),
  term INTEGER NOT NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(year FROM now()),
  fee_type TEXT NOT NULL DEFAULT 'tuition',
  amount_charged NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE,
  payment_method TEXT DEFAULT 'cash',
  mpesa_reference TEXT,
  description TEXT,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fee_records ENABLE ROW LEVEL SECURITY;

-- Admin full access for their school
CREATE POLICY "Admin school fee_records"
ON public.fee_records FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

-- Headteacher view
CREATE POLICY "HT view fee_records"
ON public.fee_records FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

-- Super admin full access
CREATE POLICY "SA full fee_records"
ON public.fee_records FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Parent view linked children fees
CREATE POLICY "Parent view linked fee_records"
ON public.fee_records FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'parent'::app_role) AND learner_id IN (
  SELECT parent_learners.learner_id FROM parent_learners WHERE parent_learners.parent_user_id = auth.uid()
));

-- Indexes
CREATE INDEX idx_fee_records_learner ON public.fee_records(learner_id);
CREATE INDEX idx_fee_records_school ON public.fee_records(school_id);
CREATE INDEX idx_fee_records_term_year ON public.fee_records(term, year);

-- Trigger for updated_at
CREATE TRIGGER update_fee_records_updated_at
BEFORE UPDATE ON public.fee_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

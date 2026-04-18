-- ============================================================
-- Curriculum Design Manager: versioned, Superadmin-controlled
-- ============================================================

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.curriculum_status AS ENUM ('draft', 'review', 'approved', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.curriculum_source AS ENUM ('manual', 'ai_pdf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Top-level curriculum design (one per grade+subject+term+version)
CREATE TABLE IF NOT EXISTS public.curriculum_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
  version INTEGER NOT NULL DEFAULT 1,
  status public.curriculum_status NOT NULL DEFAULT 'draft',
  source public.curriculum_source NOT NULL DEFAULT 'manual',
  title TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (grade, subject, term, version)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_designs_lookup
  ON public.curriculum_designs (grade, subject, term, status);

-- Strands
CREATE TABLE IF NOT EXISTS public.curriculum_strands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  design_id UUID NOT NULL REFERENCES public.curriculum_designs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_curriculum_strands_design ON public.curriculum_strands(design_id);

-- Sub-strands (the meaty curriculum content lives here)
CREATE TABLE IF NOT EXISTS public.curriculum_sub_strands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  strand_id UUID NOT NULL REFERENCES public.curriculum_strands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  lesson_allocation INTEGER NOT NULL DEFAULT 1,
  slos TEXT[] NOT NULL DEFAULT '{}',
  activities TEXT[] NOT NULL DEFAULT '{}',
  assessment_methods TEXT[] NOT NULL DEFAULT '{}',
  inquiry_questions TEXT[] NOT NULL DEFAULT '{}',
  resources TEXT[] NOT NULL DEFAULT '{}',
  competencies TEXT[] NOT NULL DEFAULT '{}',
  values TEXT[] NOT NULL DEFAULT '{}',
  pcis TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_curriculum_sub_strands_strand ON public.curriculum_sub_strands(strand_id);

-- Updated_at trigger on curriculum_designs
DROP TRIGGER IF EXISTS trg_curriculum_designs_updated_at ON public.curriculum_designs;
CREATE TRIGGER trg_curriculum_designs_updated_at
  BEFORE UPDATE ON public.curriculum_designs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- When a row is set to 'active', archive any other active version for same grade+subject+term
CREATE OR REPLACE FUNCTION public.set_active_curriculum_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.curriculum_designs
    SET status = 'archived'
    WHERE grade = NEW.grade
      AND subject = NEW.subject
      AND term = NEW.term
      AND id <> NEW.id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_curriculum_designs_active_unique ON public.curriculum_designs;
CREATE TRIGGER trg_curriculum_designs_active_unique
  AFTER INSERT OR UPDATE OF status ON public.curriculum_designs
  FOR EACH ROW EXECUTE FUNCTION public.set_active_curriculum_version();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.curriculum_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_strands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_sub_strands ENABLE ROW LEVEL SECURITY;

-- Super Admin: full control
CREATE POLICY "SA full curriculum_designs"
  ON public.curriculum_designs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "SA full curriculum_strands"
  ON public.curriculum_strands FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "SA full curriculum_sub_strands"
  ON public.curriculum_sub_strands FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Everyone signed-in: read ACTIVE curriculum only
CREATE POLICY "Anyone view active curriculum_designs"
  ON public.curriculum_designs FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Anyone view active curriculum_strands"
  ON public.curriculum_strands FOR SELECT
  TO authenticated
  USING (design_id IN (SELECT id FROM public.curriculum_designs WHERE status = 'active'));

CREATE POLICY "Anyone view active curriculum_sub_strands"
  ON public.curriculum_sub_strands FOR SELECT
  TO authenticated
  USING (strand_id IN (
    SELECT s.id FROM public.curriculum_strands s
    JOIN public.curriculum_designs d ON d.id = s.design_id
    WHERE d.status = 'active'
  ));
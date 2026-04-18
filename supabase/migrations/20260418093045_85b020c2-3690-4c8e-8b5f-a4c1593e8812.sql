ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'primary';
CREATE INDEX IF NOT EXISTS idx_streams_school_level ON public.streams(school_id, level);
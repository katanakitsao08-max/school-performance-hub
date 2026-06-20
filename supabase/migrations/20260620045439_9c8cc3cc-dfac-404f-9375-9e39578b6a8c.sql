
ALTER TABLE public.timetable_settings
  ADD COLUMN IF NOT EXISTS start_time time NOT NULL DEFAULT '07:30',
  ADD COLUMN IF NOT EXISTS lesson_duration_min integer NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS short_break_min integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS long_break_min integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS lunch_min integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS break_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scheduling_rules jsonb NOT NULL DEFAULT '{
    "reserveGames": true,
    "allowDoubleLessons": true,
    "preventSameSubjectConsecutive": false,
    "limitTeacherLoadPerDay": 0,
    "spreadPracticals": true,
    "lockAssemblies": false,
    "respectTeacherAvailability": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS template_name text;

-- Backfill break_slots from legacy break_periods/break_labels for existing rows
UPDATE public.timetable_settings ts
SET break_slots = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'slot', (bp.elem)::int,
    'label', COALESCE(bl.elem, 'BREAK'),
    'type', CASE
      WHEN COALESCE(bl.elem,'') ILIKE '%lunch%' THEN 'lunch'
      WHEN COALESCE(bl.elem,'') ILIKE '%long%'  THEN 'long'
      ELSE 'short'
    END
  ) ORDER BY (bp.elem)::int), '[]'::jsonb)
  FROM jsonb_array_elements_text(ts.break_periods) WITH ORDINALITY AS bp(elem, idx)
  LEFT JOIN jsonb_array_elements_text(ts.break_labels) WITH ORDINALITY AS bl(elem, idx)
    ON bp.idx = bl.idx
)
WHERE (ts.break_slots IS NULL OR ts.break_slots = '[]'::jsonb)
  AND jsonb_typeof(ts.break_periods) = 'array';

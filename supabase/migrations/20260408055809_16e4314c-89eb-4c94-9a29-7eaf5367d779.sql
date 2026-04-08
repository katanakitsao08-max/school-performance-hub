ALTER TABLE public.streams DROP CONSTRAINT streams_name_key;
ALTER TABLE public.streams ADD CONSTRAINT streams_name_school_unique UNIQUE (name, school_id);
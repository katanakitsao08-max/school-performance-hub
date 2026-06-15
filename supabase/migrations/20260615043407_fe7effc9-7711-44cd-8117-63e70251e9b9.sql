DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['scores','sms_logs','schools','platform_alerts','learners','user_roles']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
  EXECUTE 'ALTER TABLE public.user_activity_log REPLICA IDENTITY FULL';
END $$;
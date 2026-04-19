
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.whatsapp_template_category AS ENUM ('utility', 'marketing', 'authentication');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.whatsapp_template_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.whatsapp_queue_status AS ENUM ('queued', 'processing', 'sent', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ whatsapp_templates ============
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        public.whatsapp_template_category NOT NULL DEFAULT 'utility',
  language        text NOT NULL DEFAULT 'en',
  header_text     text,
  body_text       text NOT NULL,
  footer_text     text,
  buttons         jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_vars   text[] NOT NULL DEFAULT '{}',
  status          public.whatsapp_template_status NOT NULL DEFAULT 'approved',
  provider_template_id text,
  is_system       boolean NOT NULL DEFAULT false,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_school ON public.whatsapp_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_wa_templates_status ON public.whatsapp_templates(status);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage school wa_templates" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view school wa_templates" ON public.whatsapp_templates
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "SA full wa_templates" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_wa_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ whatsapp_settings ============
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_display_name      text,
  enforce_school_branding  boolean NOT NULL DEFAULT true,
  auto_send_report_cards   boolean NOT NULL DEFAULT false,
  auto_send_fee_reminders  boolean NOT NULL DEFAULT false,
  auto_send_attendance     boolean NOT NULL DEFAULT false,
  daily_send_limit         integer NOT NULL DEFAULT 1000,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage wa_settings" ON public.whatsapp_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Users view school wa_settings" ON public.whatsapp_settings
  FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));

CREATE POLICY "SA full wa_settings" ON public.whatsapp_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_wa_settings_updated_at
  BEFORE UPDATE ON public.whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ whatsapp_queue ============
CREATE TABLE IF NOT EXISTS public.whatsapp_queue (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  template_id         uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  learner_id          uuid REFERENCES public.learners(id) ON DELETE SET NULL,
  recipient           text NOT NULL,
  variables           jsonb NOT NULL DEFAULT '{}'::jsonb,
  rendered_message    text,
  status              public.whatsapp_queue_status NOT NULL DEFAULT 'queued',
  attempt_count       integer NOT NULL DEFAULT 0,
  max_attempts        integer NOT NULL DEFAULT 3,
  scheduled_for       timestamptz NOT NULL DEFAULT now(),
  last_attempt_at     timestamptz,
  sent_at             timestamptz,
  channel_used        text,
  provider_message_id text,
  error_message       text,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_queue_school ON public.whatsapp_queue(school_id);
CREATE INDEX IF NOT EXISTS idx_wa_queue_status_sched ON public.whatsapp_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_wa_queue_learner ON public.whatsapp_queue(learner_id);

ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage wa_queue" ON public.whatsapp_queue
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view wa_queue" ON public.whatsapp_queue
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "SA full wa_queue" ON public.whatsapp_queue
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_wa_queue_updated_at
  BEFORE UPDATE ON public.whatsapp_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ whatsapp_schedules ============
CREATE TABLE IF NOT EXISTS public.whatsapp_schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  template_id     uuid NOT NULL REFERENCES public.whatsapp_templates(id) ON DELETE CASCADE,
  name            text NOT NULL,
  target_scope    text NOT NULL DEFAULT 'school',  -- 'school' | 'grade' | 'stream' | 'class' | 'custom'
  target_grade    text,
  target_stream   text,
  recipient_ids   uuid[] DEFAULT '{}',
  variables       jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_at          timestamptz NOT NULL,
  last_run_at     timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_sched_school ON public.whatsapp_schedules(school_id);
CREATE INDEX IF NOT EXISTS idx_wa_sched_active_runat ON public.whatsapp_schedules(is_active, run_at);

ALTER TABLE public.whatsapp_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage wa_schedules" ON public.whatsapp_schedules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view wa_schedules" ON public.whatsapp_schedules
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "SA full wa_schedules" ON public.whatsapp_schedules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_wa_sched_updated_at
  BEFORE UPDATE ON public.whatsapp_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ extend report_delivery_log ============
ALTER TABLE public.report_delivery_log
  ADD COLUMN IF NOT EXISTS template_id   uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivered_at  timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS message_body  text;

-- ============ Seeding function ============
CREATE OR REPLACE FUNCTION public.seed_whatsapp_defaults_for_school(_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- settings
  INSERT INTO public.whatsapp_settings (school_id)
  VALUES (_school_id)
  ON CONFLICT (school_id) DO NOTHING;

  -- Report Card
  INSERT INTO public.whatsapp_templates (school_id, name, category, body_text, required_vars, is_system, status)
  VALUES (_school_id, 'Report Card',
    'utility',
    E'{{school_name}} - Report Card Update\n\nHello {{1}},\n\n{{school_name}} informs you that {{2}}''s report card is ready.\n\nDownload here:\n{{3}}\n\n- {{school_name}}',
    ARRAY['1','2','3'],
    true, 'approved')
  ON CONFLICT (school_id, name) DO NOTHING;

  -- Fee Reminder
  INSERT INTO public.whatsapp_templates (school_id, name, category, body_text, required_vars, is_system, status)
  VALUES (_school_id, 'Fee Reminder',
    'utility',
    E'{{school_name}}\n\nHello {{1}},\n\nThis is a reminder that {{2}} has pending school fees.\n\nPlease clear at your earliest convenience.\n\n- {{school_name}}',
    ARRAY['1','2'],
    true, 'approved')
  ON CONFLICT (school_id, name) DO NOTHING;

  -- Attendance Alert
  INSERT INTO public.whatsapp_templates (school_id, name, category, body_text, required_vars, is_system, status)
  VALUES (_school_id, 'Attendance Alert',
    'utility',
    E'{{school_name}}\n\nHello {{1}},\n\n{{2}} was absent from school today.\n\nPlease follow up.\n\n- {{school_name}}',
    ARRAY['1','2'],
    true, 'approved')
  ON CONFLICT (school_id, name) DO NOTHING;

  -- OTP
  INSERT INTO public.whatsapp_templates (school_id, name, category, body_text, required_vars, is_system, status)
  VALUES (_school_id, 'OTP',
    'authentication',
    E'{{school_name}}\n\nYour verification code is: {{1}}\n\nDo not share this code.\n\n- {{school_name}}',
    ARRAY['1'],
    true, 'approved')
  ON CONFLICT (school_id, name) DO NOTHING;
END;
$$;

-- ============ Trigger: seed on school create ============
CREATE OR REPLACE FUNCTION public.handle_new_school_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_whatsapp_defaults_for_school(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_whatsapp_on_school_insert ON public.schools;
CREATE TRIGGER trg_seed_whatsapp_on_school_insert
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_school_whatsapp();

-- ============ Backfill existing schools ============
DO $$
DECLARE s RECORD;
BEGIN
  FOR s IN SELECT id FROM public.schools LOOP
    PERFORM public.seed_whatsapp_defaults_for_school(s.id);
  END LOOP;
END $$;

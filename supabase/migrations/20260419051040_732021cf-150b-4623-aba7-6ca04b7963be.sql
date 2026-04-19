
-- Helper: lookup a system template by name for a school
CREATE OR REPLACE FUNCTION public.find_system_wa_template(_school_id uuid, _name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.whatsapp_templates
  WHERE school_id = _school_id AND name = _name AND status = 'approved'
  LIMIT 1;
$$;

-- ====== Attendance trigger ======
CREATE OR REPLACE FUNCTION public.queue_attendance_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  l RECORD;
  tpl_id uuid;
BEGIN
  IF NEW.status <> 'absent' THEN RETURN NEW; END IF;
  SELECT auto_send_attendance INTO s FROM public.whatsapp_settings WHERE school_id = NEW.school_id;
  IF NOT COALESCE(s.auto_send_attendance, false) THEN RETURN NEW; END IF;

  SELECT id, full_name, parent_name, parent_phone INTO l FROM public.learners WHERE id = NEW.learner_id;
  IF l.parent_phone IS NULL OR l.parent_phone = '' THEN RETURN NEW; END IF;

  tpl_id := public.find_system_wa_template(NEW.school_id, 'Attendance Alert');
  IF tpl_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.whatsapp_queue (school_id, template_id, learner_id, recipient, variables, created_by)
  VALUES (NEW.school_id, tpl_id, l.id, l.parent_phone,
    jsonb_build_object('1', COALESCE(l.parent_name, 'Parent'), '2', l.full_name),
    NEW.marked_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_wa_queue ON public.attendance;
CREATE TRIGGER trg_attendance_wa_queue
  AFTER INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.queue_attendance_whatsapp();

-- ====== Fees trigger ======
CREATE OR REPLACE FUNCTION public.queue_fee_reminder_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  l RECORD;
  tpl_id uuid;
  balance numeric;
BEGIN
  IF NEW.school_id IS NULL THEN RETURN NEW; END IF;
  SELECT auto_send_fee_reminders INTO s FROM public.whatsapp_settings WHERE school_id = NEW.school_id;
  IF NOT COALESCE(s.auto_send_fee_reminders, false) THEN RETURN NEW; END IF;

  balance := COALESCE(NEW.amount_charged, 0) - COALESCE(NEW.amount_paid, 0);
  IF balance <= 0 THEN RETURN NEW; END IF;

  SELECT id, full_name, parent_name, parent_phone INTO l FROM public.learners WHERE id = NEW.learner_id;
  IF l.parent_phone IS NULL OR l.parent_phone = '' THEN RETURN NEW; END IF;

  tpl_id := public.find_system_wa_template(NEW.school_id, 'Fee Reminder');
  IF tpl_id IS NULL THEN RETURN NEW; END IF;

  -- De-dupe: skip if a fee reminder for this learner was queued in the last 24h
  IF EXISTS (
    SELECT 1 FROM public.whatsapp_queue
    WHERE learner_id = l.id AND template_id = tpl_id AND created_at > now() - interval '24 hours'
  ) THEN RETURN NEW; END IF;

  INSERT INTO public.whatsapp_queue (school_id, template_id, learner_id, recipient, variables, created_by)
  VALUES (NEW.school_id, tpl_id, l.id, l.parent_phone,
    jsonb_build_object('1', COALESCE(l.parent_name, 'Parent'), '2', l.full_name),
    NEW.recorded_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fees_wa_queue ON public.fee_records;
CREATE TRIGGER trg_fees_wa_queue
  AFTER INSERT OR UPDATE OF amount_charged, amount_paid ON public.fee_records
  FOR EACH ROW EXECUTE FUNCTION public.queue_fee_reminder_whatsapp();

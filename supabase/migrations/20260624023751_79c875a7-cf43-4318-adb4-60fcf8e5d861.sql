
-- ============================================================
-- 1. AUDIT LOGS (unified, immutable, multi-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  user_id       uuid,
  user_name     text,
  role          text,
  action        text NOT NULL,         -- delete, edit, restore, archive, bulk_upload, replace, create, disable, login, etc.
  module        text NOT NULL,         -- assessment, fees, users, settings, school, etc.
  record_type   text,                  -- scores, profile, school, ...
  record_id     uuid,
  before_state  jsonb,
  after_state   jsonb,
  affected_count int DEFAULT 1,
  reason        text,
  device_info   text,
  ip_address    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_created ON public.audit_logs (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_action ON public.audit_logs (module, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs (record_type, record_id);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SuperAdmins see all; school members see only their school's logs
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      school_id IS NOT NULL
      AND school_id = public.get_user_school_id(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'headteacher'::app_role)
      )
    )
  );

-- Inserts only via security-definer log_audit() function (server-side). We still allow authenticated inserts to allow the function path; the trigger enforces immutability.
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Immutability: block UPDATE/DELETE via trigger for ALL roles incl service_role
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only and cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- Append-only writer
CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _module text,
  _record_type text DEFAULT NULL,
  _record_id uuid DEFAULT NULL,
  _before jsonb DEFAULT NULL,
  _after jsonb DEFAULT NULL,
  _affected int DEFAULT 1,
  _reason text DEFAULT NULL,
  _device text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _school_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  full_name text;
  role_text text;
  sch uuid := COALESCE(_school_id, public.get_user_school_id(uid));
  new_id uuid;
BEGIN
  SELECT p.full_name INTO full_name FROM public.profiles p WHERE p.user_id = uid LIMIT 1;
  SELECT ur.role::text INTO role_text FROM public.user_roles ur WHERE ur.user_id = uid LIMIT 1;

  INSERT INTO public.audit_logs (
    school_id, user_id, user_name, role, action, module, record_type, record_id,
    before_state, after_state, affected_count, reason, device_info, ip_address
  ) VALUES (
    sch, uid, full_name, role_text, _action, _module, _record_type, _record_id,
    _before, _after, COALESCE(_affected, 1), _reason, _device, _ip
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit(text,text,text,uuid,jsonb,jsonb,int,text,text,text,uuid) TO authenticated, service_role;

-- ============================================================
-- 2. SUBJECT COMBINATION SETTINGS (school-admin only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subject_combination_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE UNIQUE,
  combine_enabled boolean NOT NULL DEFAULT true,
  updated_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.subject_combination_settings TO authenticated;
GRANT ALL ON public.subject_combination_settings TO service_role;

ALTER TABLE public.subject_combination_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scs_select" ON public.subject_combination_settings;
CREATE POLICY "scs_select" ON public.subject_combination_settings
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR school_id = public.get_user_school_id(auth.uid())
  );

DROP POLICY IF EXISTS "scs_admin_write" ON public.subject_combination_settings;
CREATE POLICY "scs_admin_write" ON public.subject_combination_settings
  FOR ALL TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin'::app_role)
       AND school_id = public.get_user_school_id(auth.uid()))
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::app_role)
       AND school_id = public.get_user_school_id(auth.uid()))
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP TRIGGER IF EXISTS trg_scs_updated ON public.subject_combination_settings;
CREATE TRIGGER trg_scs_updated BEFORE UPDATE ON public.subject_combination_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit changes
CREATE OR REPLACE FUNCTION public.audit_subject_combination()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_audit(
    TG_OP, 'settings', 'subject_combination', NEW.id,
    CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW), 1, NULL, NULL, NULL, NEW.school_id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_subject_combination ON public.subject_combination_settings;
CREATE TRIGGER trg_audit_subject_combination
  AFTER INSERT OR UPDATE ON public.subject_combination_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_subject_combination();

-- ============================================================
-- 3. SCHOOL LIFECYCLE (soft-delete + cascade revoke)
-- ============================================================
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_access_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE OR REPLACE FUNCTION public.disable_school(_school_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.schools
     SET subscription_status = 'disabled',
         deleted_at = COALESCE(deleted_at, now()),
         deleted_by = COALESCE(deleted_by, auth.uid()),
         updated_at = now()
   WHERE id = _school_id;

  UPDATE public.profiles
     SET school_access_status = 'disabled',
         disabled_at = COALESCE(disabled_at, now())
   WHERE school_id = _school_id;
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.user_sessions
     SET session_status = 'offline',
         logout_time = COALESCE(logout_time, now())
   WHERE school_id = _school_id AND logout_time IS NULL;

  PERFORM public.log_audit(
    'disable', 'school', 'school', _school_id,
    NULL, jsonb_build_object('disabled_users', affected),
    affected, _reason, NULL, NULL, _school_id
  );

  RETURN jsonb_build_object('disabled_users', affected, 'school_id', _school_id);
END $$;

CREATE OR REPLACE FUNCTION public.restore_school(_school_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected int; deleted_when timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT deleted_at INTO deleted_when FROM public.schools WHERE id = _school_id;
  IF deleted_when IS NOT NULL AND deleted_when < now() - interval '30 days' THEN
    RAISE EXCEPTION 'restore window of 30 days has elapsed';
  END IF;

  UPDATE public.schools
     SET subscription_status = 'active',
         deleted_at = NULL,
         deleted_by = NULL,
         updated_at = now()
   WHERE id = _school_id;

  UPDATE public.profiles
     SET school_access_status = 'active',
         disabled_at = NULL
   WHERE school_id = _school_id;
  GET DIAGNOSTICS affected = ROW_COUNT;

  PERFORM public.log_audit(
    'restore', 'school', 'school', _school_id,
    NULL, jsonb_build_object('restored_users', affected),
    affected, NULL, NULL, NULL, _school_id
  );

  RETURN jsonb_build_object('restored_users', affected, 'school_id', _school_id);
END $$;

GRANT EXECUTE ON FUNCTION public.disable_school(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_school(uuid) TO authenticated;

-- ============================================================
-- 4. AUDIT WRAPPERS: extend existing bulk delete to also write to unified audit_logs
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_soft_delete_scores(_score_ids uuid[], _reason text DEFAULT NULL)
RETURNS TABLE(deleted_count integer, skipped_count integer, skipped_reasons jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  user_school uuid := public.get_user_school_id(uid);
  is_admin boolean := public.has_role(uid, 'admin'::app_role) OR public.has_role(uid, 'super_admin'::app_role);
  is_ht boolean := public.has_role(uid, 'headteacher'::app_role);
  is_teacher boolean := public.has_role(uid, 'teacher'::app_role);
  assigned_grades text[] := public.get_user_assigned_grades(uid);
  rec record;
  d_count int := 0;
  s_count int := 0;
  s_reasons jsonb := '[]'::jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (is_admin OR is_ht OR is_teacher) THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR rec IN
    SELECT s.*, l.grade AS learner_grade
    FROM public.scores s
    JOIN public.learners l ON l.id = s.learner_id
    WHERE s.id = ANY(_score_ids) AND s.deleted_at IS NULL
  LOOP
    IF NOT public.has_role(uid, 'super_admin'::app_role) AND rec.school_id <> user_school THEN
      s_count := s_count + 1;
      s_reasons := s_reasons || jsonb_build_object('id', rec.id, 'reason', 'wrong school');
      CONTINUE;
    END IF;

    IF is_teacher AND NOT is_admin THEN
      IF assigned_grades IS NULL OR NOT (rec.learner_grade = ANY(assigned_grades)) THEN
        s_count := s_count + 1;
        s_reasons := s_reasons || jsonb_build_object('id', rec.id, 'reason', 'not assigned to grade');
        CONTINUE;
      END IF;
      IF public.is_score_locked(rec.submitted_at, rec.status) THEN
        s_count := s_count + 1;
        s_reasons := s_reasons || jsonb_build_object('id', rec.id, 'reason', 'score locked');
        CONTINUE;
      END IF;
    END IF;

    IF is_ht AND NOT is_admin THEN
      IF public.is_score_locked(rec.submitted_at, rec.status) THEN
        s_count := s_count + 1;
        s_reasons := s_reasons || jsonb_build_object('id', rec.id, 'reason', 'score locked');
        CONTINUE;
      END IF;
    END IF;

    UPDATE public.scores
       SET deleted_at = now(), deleted_by = uid, delete_reason = _reason, updated_at = now()
     WHERE id = rec.id;

    INSERT INTO public.score_audit_log
      (score_table, score_id, learner_id, learning_area_id, school_id, actor_user_id, action, previous_value, reason)
    VALUES
      ('scores', rec.id, rec.learner_id, rec.learning_area_id, rec.school_id, uid, 'delete',
       to_jsonb(rec) - 'learner_grade', _reason);

    d_count := d_count + 1;
  END LOOP;

  -- single unified audit_logs row summarising the bulk operation
  IF d_count > 0 THEN
    PERFORM public.log_audit(
      'delete', 'assessment', 'scores', NULL,
      NULL, jsonb_build_object('deleted_ids', _score_ids),
      d_count, _reason, NULL, NULL, user_school
    );
  END IF;

  deleted_count := d_count;
  skipped_count := s_count;
  skipped_reasons := s_reasons;
  RETURN NEXT;
END $$;

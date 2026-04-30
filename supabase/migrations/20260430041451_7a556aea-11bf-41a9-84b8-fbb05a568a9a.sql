-- Per-school SMS provider config
CREATE TABLE public.school_sms_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'olympus_teleserve',
  endpoint text NOT NULL DEFAULT '',
  api_key text NOT NULL DEFAULT '',
  sender_id text NOT NULL DEFAULT '',
  headers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.school_sms_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SA full school_sms_config" ON public.school_sms_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin own school_sms_config" ON public.school_sms_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));

CREATE TRIGGER trg_school_sms_config_updated BEFORE UPDATE ON public.school_sms_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Global fallback (single row enforced by unique partial index)
CREATE TABLE public.global_sms_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  provider text NOT NULL DEFAULT 'olympus_teleserve',
  endpoint text NOT NULL DEFAULT '',
  api_key text NOT NULL DEFAULT '',
  sender_id text NOT NULL DEFAULT 'PERFORMTRK',
  headers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX global_sms_config_singleton ON public.global_sms_config(singleton);
ALTER TABLE public.global_sms_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA full global_sms_config" ON public.global_sms_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_global_sms_config_updated BEFORE UPDATE ON public.global_sms_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-school SMS credits
CREATE TABLE public.school_sms_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 0,
  used integer NOT NULL DEFAULT 0,
  low_threshold integer NOT NULL DEFAULT 50,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.school_sms_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA full sms_credits" ON public.school_sms_credits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin view own sms_credits" ON public.school_sms_credits FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "HT view own sms_credits" ON public.school_sms_credits FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher') AND school_id = get_user_school_id(auth.uid()));

CREATE TRIGGER trg_sms_credits_updated BEFORE UPDATE ON public.school_sms_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SMS logs
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  recipient text NOT NULL,
  message text NOT NULL,
  sender_id text,
  provider text,
  used_global_fallback boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  error text,
  segments integer NOT NULL DEFAULT 1,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA full sms_logs" ON public.sms_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin view own sms_logs" ON public.sms_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "HT view own sms_logs" ON public.sms_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher') AND school_id = get_user_school_id(auth.uid()));

CREATE INDEX sms_logs_school_sent_idx ON public.sms_logs(school_id, sent_at DESC);

-- Atomic credit deduction helper (used by edge function via service role)
CREATE OR REPLACE FUNCTION public.deduct_sms_credits(_school_id uuid, _amount integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_balance int; is_enabled boolean;
BEGIN
  SELECT balance, enabled INTO current_balance, is_enabled FROM public.school_sms_credits WHERE school_id = _school_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.school_sms_credits(school_id, balance, used) VALUES (_school_id, 0, 0);
    RETURN false;
  END IF;
  IF NOT is_enabled THEN RETURN false; END IF;
  IF current_balance < _amount THEN RETURN false; END IF;
  UPDATE public.school_sms_credits
    SET balance = balance - _amount, used = used + _amount, updated_at = now()
    WHERE school_id = _school_id;
  RETURN true;
END; $$;
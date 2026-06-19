GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_billing TO authenticated;
GRANT ALL ON public.school_billing TO service_role;
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PlanFeatures = {
  ai_remarks?: boolean;
  whatsapp_auto?: boolean;
  batch_reports?: boolean;
  timetable?: boolean;
  advanced_analytics?: boolean;
  bulk_upload?: boolean;
  max_learners?: number;
};

export function usePlanFeatures() {
  const { schoolId, role } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['school-plan-features', schoolId],
    queryFn: async (): Promise<PlanFeatures> => {
      if (!schoolId) return {};
      const { data, error } = await supabase
        .from('schools')
        .select('plan_expires_at, plan:subscription_plans(features)')
        .eq('id', schoolId)
        .maybeSingle();
      if (error) return {};
      const expired = data?.plan_expires_at && new Date(data.plan_expires_at) < new Date();
      if (expired) {
        // Fall back to Free plan features
        const { data: free } = await supabase
          .from('subscription_plans')
          .select('features')
          .eq('name', 'Free')
          .maybeSingle();
        return (free?.features as PlanFeatures) || {};
      }
      return ((data?.plan as any)?.features as PlanFeatures) || {};
    },
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  // Super admins bypass all plan gates
  const has = (key: keyof PlanFeatures): boolean => {
    if (role === 'super_admin') return true;
    const v = data?.[key];
    return typeof v === 'boolean' ? v : v != null;
  };

  return { features: data || {}, has, isLoading };
}

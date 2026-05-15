import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type LpEntitlement = {
  id: string;
  learner_id: string;
  status: 'pending' | 'active' | 'rejected' | 'expired';
  mpesa_code: string | null;
  amount: number;
  weeks: number;
  expires_at: string | null;
  activated_at: string | null;
  submitted_at: string;
  rejection_reason: string | null;
};

export function useLearningPathAccess(learnerId: string | null | undefined) {
  const { user, role } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['lp-access', learnerId, user?.id],
    queryFn: async () => {
      if (!learnerId) return { active: null, latest: null };
      const { data } = await supabase
        .from('learning_path_entitlements')
        .select('*')
        .eq('learner_id', learnerId)
        .order('submitted_at', { ascending: false })
        .limit(10);
      const rows = (data || []) as LpEntitlement[];
      const now = new Date();
      const active = rows.find(r =>
        r.status === 'active' && (!r.expires_at || new Date(r.expires_at) > now)
      ) || null;
      return { active, latest: rows[0] || null, all: rows };
    },
    enabled: !!learnerId && !!user,
    staleTime: 30_000,
  });

  // Super admins bypass paywall
  const hasAccess = role === 'super_admin' || !!data?.active;

  return {
    hasAccess,
    activeEntitlement: data?.active || null,
    latestEntitlement: data?.latest || null,
    history: data?.all || [],
    isLoading,
    refetch,
  };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSchoolStreams() {
  const { schoolId } = useAuth();

  const { data: streams } = useQuery({
    queryKey: ['school-streams', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('streams')
        .select('name')
        .eq('school_id', schoolId!)
        .order('name');
      return (data || []).map((s: any) => s.name as string);
    },
    enabled: !!schoolId,
  });

  return streams || [];
}

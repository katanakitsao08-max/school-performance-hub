import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { GRADES } from '@/lib/cbc-utils';

export function useSchoolGrades() {
  const { schoolId } = useAuth();

  const { data: grades } = useQuery({
    queryKey: ['school-grades', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('school_settings')
        .select('value')
        .eq('key', 'available_grades')
        .eq('school_id', schoolId!)
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value) as string[];
          return parsed.length > 0 ? parsed : GRADES;
        } catch { return GRADES; }
      }
      return GRADES;
    },
    enabled: !!schoolId,
  });

  return grades || GRADES;
}

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AcademicYear {
  id: string;
  year: number;
  status: 'active' | 'closed' | 'archived';
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

let ensured = false;

/**
 * Fetches the list of academic years (descending). Also ensures the current
 * calendar year (and next) exist on first call per session.
 */
export function useAcademicYears() {
  const query = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years' as any)
        .select('*')
        .order('year', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AcademicYear[];
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (ensured) return;
    ensured = true;
    supabase.rpc('ensure_current_academic_year' as any).then(() => {
      query.refetch();
    }).catch(() => { ensured = false; });
  }, []);

  return query;
}

export function useCurrentAcademicYear() {
  const { data: years = [], ...rest } = useAcademicYears();
  const current = years.find(y => y.is_current) || years.find(y => y.status === 'active') || years[0];
  return { data: current, years, ...rest };
}

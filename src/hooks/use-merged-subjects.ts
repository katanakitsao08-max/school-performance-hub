import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminMerge } from '@/lib/reporting/merges';

/**
 * Loads all active admin-defined merged subjects for the current school and
 * exposes helpers to filter by grade. Types are cast to `any` because the
 * generated types file regenerates after the migration is deployed.
 */
export function useMergedSubjects() {
  const { schoolId } = useAuth();

  const query = useQuery({
    queryKey: ['merged-subjects', schoolId],
    queryFn: async (): Promise<AdminMerge[]> => {
      if (!schoolId) return [];
      const { data: parents, error } = await (supabase as any)
        .from('merged_subjects')
        .select('id, school_id, grade, name, code, max_score, is_active')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      const ids = (parents || []).map((p: any) => p.id);
      if (!ids.length) return [];
      const { data: items } = await (supabase as any)
        .from('merged_subject_items')
        .select('merged_subject_id, learning_area_id')
        .in('merged_subject_id', ids);
      const byParent = new Map<string, string[]>();
      (items || []).forEach((it: any) => {
        const list = byParent.get(it.merged_subject_id) || [];
        list.push(it.learning_area_id);
        byParent.set(it.merged_subject_id, list);
      });
      return (parents || []).map((p: any) => ({
        id: p.id,
        school_id: p.school_id,
        grade: p.grade,
        name: p.name,
        code: p.code,
        max_score: Number(p.max_score) || 100,
        member_ids: byParent.get(p.id) || [],
      })) as AdminMerge[];
    },
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  const merges = query.data || [];
  const forGrade = (grade?: string): AdminMerge[] =>
    grade ? merges.filter(m => m.grade === grade && m.member_ids.length >= 2) : [];

  return { ...query, merges, forGrade };
}

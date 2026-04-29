import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Per-school additive feature toggles, stored in school_settings (key/value).
 * Defaults to enabled (true) so new features remain visible unless an admin disables them.
 */
export type SchoolFeatureKey =
  | 'feature_assessment_number'
  | 'feature_merged_reports'
  | 'feature_advanced_timetable_rules';

export const SCHOOL_FEATURE_KEYS: SchoolFeatureKey[] = [
  'feature_assessment_number',
  'feature_merged_reports',
  'feature_advanced_timetable_rules',
];

export const FEATURE_LABELS: Record<SchoolFeatureKey, string> = {
  feature_assessment_number: 'Assessment Number on Learners',
  feature_merged_reports: 'Merged Term Report (Opener+Mid+End)',
  feature_advanced_timetable_rules: 'Advanced Timetable Rules',
};

export function useSchoolFeatureToggles(overrideSchoolId?: string) {
  const { schoolId: ctxSchoolId, role } = useAuth();
  const schoolId = overrideSchoolId || ctxSchoolId;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['school-feature-toggles', schoolId],
    queryFn: async (): Promise<Record<SchoolFeatureKey, boolean>> => {
      const defaults = SCHOOL_FEATURE_KEYS.reduce((acc, k) => {
        acc[k] = true;
        return acc;
      }, {} as Record<SchoolFeatureKey, boolean>);
      if (!schoolId) return defaults;
      const { data, error } = await supabase
        .from('school_settings')
        .select('key, value')
        .eq('school_id', schoolId)
        .in('key', SCHOOL_FEATURE_KEYS as unknown as string[]);
      if (error) return defaults;
      (data || []).forEach((row: any) => {
        if (SCHOOL_FEATURE_KEYS.includes(row.key)) {
          defaults[row.key as SchoolFeatureKey] = row.value !== 'false';
        }
      });
      return defaults;
    },
    enabled: !!schoolId,
    staleTime: 30_000,
  });

  const isOn = (key: SchoolFeatureKey): boolean => {
    if (role === 'super_admin' && !overrideSchoolId) return true;
    return data?.[key] ?? true;
  };

  return { toggles: data, isOn, isLoading, refetch };
}

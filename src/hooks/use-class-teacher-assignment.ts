import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ClassAssignment {
  id: string;
  grade: string;
  stream: string;
  school_id: string;
}

/** Returns the rows in class_teachers for the current user (a teacher may be class teacher of multiple classes). */
export function useClassTeacherAssignment() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-class-teacher', user?.id],
    queryFn: async (): Promise<ClassAssignment[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('class_teachers')
        .select('id, grade, stream, school_id')
        .eq('teacher_id', user.id);
      if (error) return [];
      return (data || []) as ClassAssignment[];
    },
    enabled: !!user,
  });
}

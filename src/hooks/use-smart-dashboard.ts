import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export interface SmartInsight {
  mostImproved: { name: string; grade: string; delta: number }[];
  atRisk: { name: string; grade: string; stream: string; avgScore: number; id: string }[];
  subjectAverages: { name: string; avg: number }[];
  trendData: { label: string; avg: number }[];
  attendanceRate: number;
  totalStudents: number;
  totalScores: number;
  totalSubjects: number;
}

export function useSmartDashboard() {
  const { user, role, schoolId } = useAuth();
  const queryClient = useQueryClient();

  // Real-time refresh on learners changes for this school
  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`learners-dashboard-${schoolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'learners', filter: `school_id=eq.${schoolId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['smart-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['learners-adm-count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [schoolId, queryClient]);

  return useQuery<SmartInsight>({
    queryKey: ['smart-dashboard', user?.id, schoolId],
    queryFn: async () => {
      // Exact learner count (not capped at 1000)
      let countQ = supabase.from('learners').select('*', { count: 'exact', head: true }).eq('is_active', true);
      if (schoolId) countQ = countQ.eq('school_id', schoolId);
      const { count: learnerCount } = await countQ;

      // Fetch all active learners (paged to bypass the 1000-row cap)
      const learners = await fetchAllPaged<{ id: string; full_name: string; grade: string; stream: string }>(() => {
        let lq = supabase.from('learners').select('id, full_name, grade, stream').eq('is_active', true);
        if (schoolId) lq = lq.eq('school_id', schoolId);
        return lq;
      });

      // Fetch all scores (paged)
      const scores = await fetchAllPaged<any>(() => {
        let sq = supabase.from('scores').select('learner_id, learning_area_id, score, term, year, assessment_type');
        if (schoolId) sq = sq.eq('school_id', schoolId);
        return sq;
      });

      // Fetch learning areas
      let laq = supabase.from('learning_areas').select('id, name, grade');
      if (schoolId) laq = laq.eq('school_id', schoolId);
      const { data: learningAreas = [] } = await laq;

      // Fetch today's attendance (paged)
      const today = new Date().toISOString().split('T')[0];
      const attendance = await fetchAllPaged<{ status: string }>(() => {
        let aq = supabase.from('attendance').select('status').eq('date', today);
        if (schoolId) aq = aq.eq('school_id', schoolId);
        return aq;
      });

      const totalStudents = learnerCount ?? learners.length;
      const totalScores = scores.length;
      const totalSubjects = learningAreas.length;

      const presentCount = attendance.filter(a => a.status === 'present').length;
      const attendanceRate = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;

      // Calculate per-learner averages
      const learnerScoreMap: Record<string, number[]> = {};
      for (const s of scores) {
        if (!learnerScoreMap[s.learner_id]) learnerScoreMap[s.learner_id] = [];
        learnerScoreMap[s.learner_id].push(Number(s.score));
      }

      const learnerAvgs = Object.entries(learnerScoreMap).map(([lid, sc]) => ({
        id: lid,
        avg: sc.reduce((a, b) => a + b, 0) / sc.length,
      }));

      // At-risk: average below 30
      const atRisk = learnerAvgs
        .filter(l => l.avg < 30)
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 5)
        .map(l => {
          const learner = learners.find(le => le.id === l.id);
          return {
            name: learner?.full_name || 'Unknown',
            grade: learner?.grade || '',
            stream: learner?.stream || '',
            avgScore: Math.round(l.avg),
            id: l.id,
          };
        });

      // Most improved: compare latest term scores to previous
      const currentYear = new Date().getFullYear();
      const termScores: Record<string, Record<string, number[]>> = {};
      for (const s of scores) {
        const key = `${s.term}-${s.year}`;
        if (!termScores[key]) termScores[key] = {};
        if (!termScores[key][s.learner_id]) termScores[key][s.learner_id] = [];
        termScores[key][s.learner_id].push(Number(s.score));
      }

      const termKeys = Object.keys(termScores).sort();
      let mostImproved: SmartInsight['mostImproved'] = [];
      if (termKeys.length >= 2) {
        const latest = termScores[termKeys[termKeys.length - 1]];
        const prev = termScores[termKeys[termKeys.length - 2]];
        const deltas: { id: string; delta: number }[] = [];
        for (const [lid, sc] of Object.entries(latest)) {
          if (prev[lid]) {
            const latestAvg = sc.reduce((a, b) => a + b, 0) / sc.length;
            const prevAvg = prev[lid].reduce((a, b) => a + b, 0) / prev[lid].length;
            deltas.push({ id: lid, delta: latestAvg - prevAvg });
          }
        }
        mostImproved = deltas
          .sort((a, b) => b.delta - a.delta)
          .slice(0, 5)
          .filter(d => d.delta > 0)
          .map(d => {
            const learner = learners.find(l => l.id === d.id);
            return {
              name: learner?.full_name || 'Unknown',
              grade: learner?.grade || '',
              delta: Math.round(d.delta),
            };
          });
      }

      // Subject averages
      const subjectScores: Record<string, { name: string; scores: number[] }> = {};
      for (const la of learningAreas) {
        subjectScores[la.id] = { name: la.name, scores: [] };
      }
      for (const s of scores) {
        if (subjectScores[s.learning_area_id]) {
          subjectScores[s.learning_area_id].scores.push(Number(s.score));
        }
      }
      const subjectAverages = Object.values(subjectScores)
        .filter(s => s.scores.length > 0)
        .map(s => ({
          name: s.name.length > 8 ? s.name.substring(0, 8) : s.name,
          avg: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length),
        }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 8);

      // Trend data by term
      const trendData = termKeys.slice(-6).map(key => {
        const allScores = Object.values(termScores[key]).flat();
        const avg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
        const [term, year] = key.split('-');
        return { label: `T${term} ${year.slice(-2)}`, avg };
      });

      return {
        mostImproved,
        atRisk,
        subjectAverages,
        trendData,
        attendanceRate,
        totalStudents,
        totalScores,
        totalSubjects,
      };
    },
    enabled: !!user,
    staleTime: 0,
  });
}

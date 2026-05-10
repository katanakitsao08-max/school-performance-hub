import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download } from 'lucide-react';
import { useState, useMemo } from 'react';
import { getGradeForLevel, getGradePoints, isKJSEAGradeLevel, generateTeacherComment } from '@/lib/cbc-utils';
import { generatePremiumReportCard, type ReportCardData } from '@/lib/report-card-pdf';
import { toast } from '@/hooks/use-toast';

interface Props {
  child: { id: string; full_name: string; admission_number: string; grade: string; stream: string; gender: string };
}

export default function ParentReportsTab({ child }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedAssessment, setSelectedAssessment] = useState<'opener' | 'mid_term' | 'end_term'>('end_term');
  const assessmentLabel = selectedAssessment === 'opener' ? 'Opener' : selectedAssessment === 'mid_term' ? 'Mid-Term' : 'End-Term';
  const [generating, setGenerating] = useState(false);

  // Get school_id from parent_learners
  const { data: parentLink } = useQuery({
    queryKey: ['parent-link', child.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('parent_learners')
        .select('school_id')
        .eq('learner_id', child.id)
        .maybeSingle();
      return data;
    },
  });

  const schoolId = parentLink?.school_id;

  const { data: scores = [] } = useQuery({
    queryKey: ['parent-report-scores', child.id, selectedTerm, selectedYear, selectedAssessment],
    queryFn: async () => {
      const { data } = await supabase
        .from('scores')
        .select('*, learning_areas!scores_learning_area_id_fkey(name, max_score)')
        .eq('learner_id', child.id)
        .eq('term', Number(selectedTerm))
        .eq('year', Number(selectedYear))
        .eq('assessment_type', selectedAssessment);
      return data || [];
    },
  });

  const { data: schoolSettings = {} } = useQuery({
    queryKey: ['parent-school-settings', schoolId],
    queryFn: async () => {
      if (!schoolId) return {};
      const { data } = await supabase
        .from('school_settings')
        .select('key, value')
        .eq('school_id', schoolId);
      const settings: Record<string, string> = {};
      (data || []).forEach(s => { settings[s.key] = s.value; });
      return settings;
    },
    enabled: !!schoolId,
  });

  const { data: schoolRecord } = useQuery({
    queryKey: ['parent-school-record', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId!).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch teacher assignments for initials
  const { data: teacherAssignments = [] } = useQuery({
    queryKey: ['parent-teacher-assignments', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('teacher_assignments')
        .select('learning_area_id, teacher_id, grade, stream')
        .eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['parent-profiles-initials', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Fetch all learners in the same grade for ranking & class averages
  const { data: gradeLearners = [] } = useQuery({
    queryKey: ['parent-grade-learners', child.grade, schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('learners')
        .select('id, grade, stream')
        .eq('grade', child.grade)
        .eq('is_active', true)
        .eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Fetch all scores for the grade (for rankings & class averages)
  const { data: allGradeScores = [] } = useQuery({
    queryKey: ['parent-grade-scores', child.grade, selectedTerm, selectedYear, schoolId],
    queryFn: async () => {
      const ids = gradeLearners.map(l => l.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('scores')
        .select('learner_id, learning_area_id, score')
        .in('learner_id', ids)
        .eq('term', Number(selectedTerm))
        .eq('year', Number(selectedYear))
        .eq('assessment_type', 'end_term');
      return data || [];
    },
    enabled: gradeLearners.length > 0,
  });

  // Fetch learning areas for the grade
  const { data: gradeSubjects = [] } = useQuery({
    queryKey: ['parent-grade-subjects', child.grade, schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('learning_areas')
        .select('id, name, max_score')
        .eq('grade', child.grade)
        .eq('is_active', true)
        .eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const getTeacherInitials = (subjectId: string) => {
    const assignment = teacherAssignments.find(
      a => a.learning_area_id === subjectId && a.grade === child.grade && a.stream === child.stream
    );
    if (!assignment) return '';
    const profile = allProfiles.find(p => p.user_id === assignment.teacher_id);
    if (!profile) return '';
    return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getTeacherName = (subjectId: string) => {
    const assignment = teacherAssignments.find(
      a => a.learning_area_id === subjectId && a.grade === child.grade && a.stream === child.stream
    );
    if (!assignment) return '';
    const profile = allProfiles.find(p => p.user_id === assignment.teacher_id);
    return profile?.full_name || '';
  };

  // Compute rankings and class averages
  const { classAvgPerSubject, overallRank, streamRank, totalInClass, totalInStream, gradeDistribution } = useMemo(() => {
    const classAvg: Record<string, number> = {};
    gradeSubjects.forEach(sub => {
      const subScores = allGradeScores.filter(s => s.learning_area_id === sub.id);
      classAvg[sub.name] = subScores.length > 0 ? subScores.reduce((sum, s) => sum + s.score, 0) / subScores.length : 0;
    });

    // Compute totals per learner
    const learnerTotals: { id: string; stream: string; total: number }[] = [];
    const learnerIdsWithScores = new Set(allGradeScores.map(s => s.learner_id));
    
    gradeLearners.filter(l => learnerIdsWithScores.has(l.id)).forEach(l => {
      const lScores = allGradeScores.filter(s => s.learner_id === l.id);
      const total = lScores.reduce((sum, s) => sum + s.score, 0);
      learnerTotals.push({ id: l.id, stream: l.stream, total });
    });

    // Overall rank
    learnerTotals.sort((a, b) => b.total - a.total);
    let oRank = 0;
    const childTotal = learnerTotals.find(l => l.id === child.id)?.total ?? 0;
    learnerTotals.forEach((l, i) => {
      if (l.id === child.id) {
        oRank = learnerTotals.findIndex(x => x.total === l.total) + 1;
      }
    });

    // Stream rank
    const streamLearners = learnerTotals.filter(l => l.stream === child.stream).sort((a, b) => b.total - a.total);
    let sRank = 0;
    streamLearners.forEach((l) => {
      if (l.id === child.id) {
        sRank = streamLearners.findIndex(x => x.total === l.total) + 1;
      }
    });

    // Grade distribution
    const isK = isKJSEAGradeLevel(child.grade);
    const levels = isK ? ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'] : ['EE', 'ME', 'AE', 'BE'];
    const dist: Record<string, number> = {};
    levels.forEach(l => { dist[l] = 0; });
    learnerTotals.forEach(lt => {
      const lScores = allGradeScores.filter(s => s.learner_id === lt.id);
      const subCount = gradeSubjects.length || 1;
      const mean = lt.total / subCount;
      const avgMax = gradeSubjects.length > 0 ? gradeSubjects.reduce((s, sub) => s + sub.max_score, 0) / subCount : 100;
      const g = getGradeForLevel(mean, avgMax, child.grade);
      if (g && String(g) !== '-' && dist[String(g)] !== undefined) {
        dist[g as string]++;
      }
    });

    return {
      classAvgPerSubject: classAvg,
      overallRank: oRank,
      streamRank: sRank,
      totalInClass: learnerTotals.length,
      totalInStream: streamLearners.length,
      gradeDistribution: levels.map(g => ({ grade: g, count: dist[g] || 0 })),
    };
  }, [allGradeScores, gradeLearners, gradeSubjects, child]);

  // Load school logo as base64
  const loadImageAsBase64 = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!url) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const hasScores = scores.length > 0;
  const schoolLogoUrl = schoolSettings['school_logo_url'] || '';

  const handleDownload = async () => {
    if (!hasScores) return;
    setGenerating(true);
    try {
      const logoBase64 = await loadImageAsBase64(schoolLogoUrl);

      const subjectData = scores.map(s => {
        const la = (s as any).learning_areas;
        const name = la?.name || 'Unknown';
        const maxScore = la?.max_score || 100;
        const grade = getGradeForLevel(Number(s.score), maxScore, child.grade);
        return {
          name,
          score: Number(s.score),
          maxScore,
          grade: grade as string,
          teacherInitials: getTeacherInitials(s.learning_area_id),
          teacherName: getTeacherName(s.learning_area_id),
          comment: s.teacher_comment || '',
          strands: [],
        };
      });

      const total = subjectData.reduce((s, d) => s + d.score, 0);
      const maxTotal = subjectData.reduce((s, d) => s + d.maxScore, 0);
      const mean = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
      const overallGrade = getGradeForLevel(total, maxTotal, child.grade);
      const totalPoints = subjectData.reduce((s, d) => s + getGradePoints(d.grade as any), 0);

      const reportData: ReportCardData = {
        learner: {
          id: child.id,
          full_name: child.full_name,
          admission_number: child.admission_number,
          grade: child.grade,
          stream: child.stream,
          gender: child.gender,
        },
        subjectData,
        total,
        maxTotal,
        mean,
        overallGrade: overallGrade as string,
        rank: overallRank,
        streamRank,
        totalInClass,
        totalInStream,
        totalPoints,
        selectedTerm: Number(selectedTerm),
        selectedYear: Number(selectedYear),
        assessmentLabel: 'End-Term',
        classTeacherComment: generateTeacherComment(child.full_name, mean, 100, subjectData.map(s => ({ name: s.name, score: s.score, maxScore: s.maxScore }))),
        principalComment: '',
        schoolSettings: {
          ...schoolSettings,
          school_name: schoolSettings['school_name'] || schoolRecord?.school_name || 'SCHOOL',
        },
        logoBase64,
        classAvgPerSubject,
        gradeDistribution,
        appUrl: window.location.origin,
      };

      const doc = await generatePremiumReportCard(reportData);
      doc.save(`${child.full_name.replace(/\s+/g, '_')}_Term${selectedTerm}_${selectedYear}.pdf`);
      toast({ title: 'Report card downloaded!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to generate report', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Download Report Card
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Term 1</SelectItem>
                <SelectItem value="2">Term 2</SelectItem>
                <SelectItem value="3">Term 3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasScores ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {scores.length} subject(s) found for Term {selectedTerm}, {selectedYear}
              </div>
              <Button onClick={handleDownload} disabled={generating} className="w-full gap-2">
                <Download className="h-4 w-4" />
                {generating ? 'Generating...' : 'Download Report Card (PDF)'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No end-term scores found for Term {selectedTerm}, {selectedYear}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick score summary */}
      {hasScores && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display font-bold">Score Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {scores.map(s => {
              const la = (s as any).learning_areas;
              const grade = getGradeForLevel(Number(s.score), la?.max_score || 100, child.grade);
              return (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                  <span className="text-xs font-medium">{la?.name || 'Unknown'}</span>
                  <span className="text-xs font-bold">{s.score}/{la?.max_score || 100} ({grade})</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

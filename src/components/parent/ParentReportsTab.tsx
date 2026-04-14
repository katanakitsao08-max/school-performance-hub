import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download } from 'lucide-react';
import { useState, useMemo } from 'react';
import { getGradeForLevel, getGradePoints, isKJSEAGradeLevel, generateTeacherComment } from '@/lib/cbc-utils';
import { generateReportCardPDF, type ReportCardData } from '@/lib/report-card-pdf';
import { toast } from '@/hooks/use-toast';

interface Props {
  child: { id: string; full_name: string; admission_number: string; grade: string; stream: string; gender: string };
}

export default function ParentReportsTab({ child }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [generating, setGenerating] = useState(false);

  const { data: scores = [] } = useQuery({
    queryKey: ['parent-report-scores', child.id, selectedTerm, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from('scores')
        .select('*, learning_areas!scores_learning_area_id_fkey(name, max_score)')
        .eq('learner_id', child.id)
        .eq('term', Number(selectedTerm))
        .eq('year', Number(selectedYear))
        .eq('assessment_type', 'end_term');
      return data || [];
    },
  });

  const { data: schoolSettings = {} } = useQuery({
    queryKey: ['parent-school-settings', child.id],
    queryFn: async () => {
      // Get school_id from parent_learners
      const { data: links } = await supabase
        .from('parent_learners')
        .select('school_id')
        .eq('learner_id', child.id)
        .maybeSingle();
      if (!links?.school_id) return {};
      const { data } = await supabase
        .from('school_settings')
        .select('key, value')
        .eq('school_id', links.school_id);
      const settings: Record<string, string> = {};
      (data || []).forEach(s => { settings[s.key] = s.value; });
      return settings;
    },
  });

  const hasScores = scores.length > 0;

  const handleDownload = async () => {
    if (!hasScores) return;
    setGenerating(true);
    try {
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
          teacherInitials: '',
          teacherName: '',
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
        rank: 0,
        streamRank: 0,
        totalInClass: 0,
        totalInStream: 0,
        totalPoints,
        selectedTerm: Number(selectedTerm),
        selectedYear: Number(selectedYear),
        assessmentLabel: 'End-Term',
        classTeacherComment: generateTeacherComment(child.full_name, mean, 100, subjectData.map(s => ({ name: s.name, score: s.score, maxScore: s.maxScore }))),
        principalComment: '',
        schoolSettings,
        logoBase64: null,
        classAvgPerSubject: {},
        gradeDistribution: [],
        appUrl: window.location.origin,
      };

      const doc = await generateReportCardPDF(reportData);
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

import { useState, useMemo, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TERMS, ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS, type AssessmentType } from '@/lib/cbc-utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { computeGradeAnalysis, SUB_LEVELS, type GradeAnalysisReport } from '@/lib/cbc-analysis-utils';
import { generateGradeAnalysisPDF } from '@/lib/grade-analysis-pdf';
import { FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { GradeAnalysisTable } from '@/components/GradeAnalysisTable';
import { GradeAnalysisInsights } from '@/components/GradeAnalysisInsights';
import { toast } from 'sonner';

export default function GradeAnalysisPage() {
  const { user, schoolId } = useAuth();
  const dynamicGrades = useSchoolGrades();
  const currentYear = new Date().getFullYear();

  const [selectedGrade, setSelectedGrade] = useState(dynamicGrades[0] || '1');
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentType>('end_term');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [autoPdf, setAutoPdf] = useState(false);
  const lastAutoKeyRef = useRef<string>('');

  const { data: dbStreams = [] } = useQuery({
    queryKey: ['streams', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name').eq('school_id', schoolId!).order('name');
      return (data || []).map((s: any) => s.name as string);
    },
    enabled: !!schoolId,
  });

  useMemo(() => {
    if (dbStreams.length > 0 && selectedStreams.length === 0) {
      setSelectedStreams([dbStreams[0]]);
    }
  }, [dbStreams]);

  const toggleStream = (stream: string) => {
    setSelectedStreams(prev => {
      if (prev.includes(stream)) {
        const next = prev.filter(s => s !== stream);
        return next.length > 0 ? next : prev;
      }
      return [...prev, stream];
    });
  };

  const { data: learners = [] } = useQuery({
    queryKey: ['analysis-learners', selectedGrade, selectedStreams],
    queryFn: async () => {
      if (selectedStreams.length === 0) return [];
      const { data } = await supabase.from('learners').select('*')
        .eq('grade', selectedGrade)
        .in('stream', selectedStreams)
        .eq('is_active', true)
        .eq('school_id', schoolId!)
        .order('full_name');
      return data || [];
    },
    enabled: !!schoolId && selectedStreams.length > 0,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['analysis-subjects', selectedGrade, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('*')
        .eq('grade', selectedGrade).eq('is_active', true).eq('school_id', schoolId!)
        .order('name');
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['analysis-scores', selectedGrade, selectedStreams, selectedTerm, selectedAssessment, selectedYear],
    queryFn: async () => {
      const ids = learners.map(l => l.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('scores').select('*')
        .in('learner_id', ids).eq('term', selectedTerm).eq('year', selectedYear)
        .eq('assessment_type', selectedAssessment);
      return data || [];
    },
    enabled: learners.length > 0,
  });

  // Exclude learners with NO marks entered for any subject in this term/assessment
  const learnersWithScores = useMemo(() => {
    const ids = new Set(scores.map((s: any) => s.learner_id));
    return learners.filter((l: any) => ids.has(l.id));
  }, [learners, scores]);

  const analysis: GradeAnalysisReport = useMemo(
    () => computeGradeAnalysis(learnersWithScores, subjects, scores),
    [learnersWithScores, subjects, scores]
  );

  const { data: schoolSettings = {} } = useQuery({
    queryKey: ['school-settings-map', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('school_settings').select('*').eq('school_id', schoolId!);
      const map: Record<string, string> = {};
      (data || []).forEach(s => { map[s.key] = s.value; });
      return map;
    },
    enabled: !!schoolId,
  });

  const { data: schoolRecord } = useQuery({
    queryKey: ['school-record', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId!).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const schoolName = schoolSettings['school_name'] || schoolRecord?.school_name || 'SCHOOL';
  const schoolLogoUrl = schoolSettings['school_logo_url'] || '';
  const streamLabel = selectedStreams.length === 1 ? selectedStreams[0] : selectedStreams.join(' + ');
  const assessmentLabel = ASSESSMENT_TYPE_LABELS[selectedAssessment]?.toUpperCase() || selectedAssessment.toUpperCase();
  const title = `GRADE ${selectedGrade} ${assessmentLabel} TERM ${selectedTerm} ${selectedYear} RESULTS`;

  const exportPDF = async (autoSave = true) => {
    if (analysis.subjects.length === 0) {
      toast.error('No data to export. Select a grade and stream with scores entered.');
      return null;
    }
    try {
      const doc = await generateGradeAnalysisPDF(analysis, {
        schoolName,
        schoolLogoUrl,
        grade: selectedGrade,
        streamLabel,
        term: selectedTerm,
        year: selectedYear,
        assessmentLabel,
      }, { autoSave });
      if (autoSave) toast.success('Grade Analysis PDF generated');
      return doc;
    } catch (e: any) {
      toast.error(`PDF generation failed: ${e?.message || 'unknown error'}`);
      return null;
    }
  };

  // Auto-generate PDF when analysis completes (only if toggled on, and only once per data change)
  useEffect(() => {
    if (!autoPdf) return;
    if (analysis.subjects.length === 0) return;
    const key = `${selectedGrade}|${streamLabel}|${selectedTerm}|${selectedAssessment}|${selectedYear}|${analysis.totalEntries}|${analysis.subjects.length}|${analysis.overallTotalPoints}`;
    if (key === lastAutoKeyRef.current) return;
    lastAutoKeyRef.current = key;
    exportPDF(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPdf, analysis, selectedGrade, streamLabel, selectedTerm, selectedAssessment, selectedYear]);

  const exportExcel = () => {
    const subHeaders = SUB_LEVELS.flatMap(lv => [`${lv} M`, `${lv} F`]);
    const headers = ['SUBJECT', 'ENTRY M', 'ENTRY F', ...subHeaders, 'T.POINT', 'AV.POINT', 'MEAN'];
    const rows = analysis.subjects.map(sa => [
      sa.subjectName, sa.entryM, sa.entryF,
      ...SUB_LEVELS.flatMap(lv => [sa.genderDistribution[lv].M, sa.genderDistribution[lv].F]),
      sa.totalPoints, sa.meanGradePoint, sa.meanGradeLabel,
    ]);
    rows.push([
      'OVERALL', analysis.totalM, analysis.totalF,
      ...SUB_LEVELS.flatMap(lv => [analysis.overallGenderDistribution[lv].M, analysis.overallGenderDistribution[lv].F]),
      analysis.overallTotalPoints, analysis.overallMean, analysis.overallMeanLabel,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      [schoolName.toUpperCase()], [`${title} — ${streamLabel}`], [],
      headers, ...rows, [],
      [`Highest band: ${analysis.insights.highestBand}`],
      [analysis.insights.genderNote],
      [analysis.insights.overallComment],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analysis');
    XLSX.writeFile(wb, `Analysis_G${selectedGrade}_${streamLabel}_T${selectedTerm}_${selectedYear}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Grade Analysis</h1>
            <p className="text-muted-foreground text-sm">CBC sub-level distribution with gender breakdown</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={autoPdf} onCheckedChange={setAutoPdf} />
              Auto-PDF on update
            </label>
            <Button variant="outline" onClick={() => exportPDF(true)} disabled={analysis.subjects.length === 0}>
              <FileDown className="mr-2 h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={analysis.subjects.length === 0}>
              <FileDown className="mr-2 h-4 w-4" /> Excel
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap items-end">
          <div className="space-y-1">
            <Label className="text-xs">Grade</Label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{dynamicGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stream(s)</Label>
            <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-w-[200px]">
              {dbStreams.map(s => (
                <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={selectedStreams.includes(s)} onCheckedChange={() => toggleStream(s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Term</Label>
            <Select value={String(selectedTerm)} onValueChange={v => setSelectedTerm(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Assessment</Label>
            <Select value={selectedAssessment} onValueChange={v => setSelectedAssessment(v as AssessmentType)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{ASSESSMENT_TYPES.map(at => <SelectItem key={at} value={at}>{ASSESSMENT_TYPE_LABELS[at]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <Input type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-[100px]" />
          </div>
        </div>

        {/* Analysis Table */}
        <Card>
          <CardHeader className="text-center pb-2">
            <p className="text-xs font-bold uppercase tracking-wider">{schoolName.toUpperCase()}</p>
            <CardTitle className="text-sm font-display uppercase tracking-wide">{title} — {streamLabel}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Entry: {analysis.totalM} Male, {analysis.totalF} Female — {analysis.totalEntries} Total
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <GradeAnalysisTable analysis={analysis} />
          </CardContent>
        </Card>

        {/* Insights */}
        {analysis.subjects.length > 0 && <GradeAnalysisInsights analysis={analysis} />}
      </div>
    </DashboardLayout>
  );
}

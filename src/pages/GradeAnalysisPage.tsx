import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TERMS, ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS, type AssessmentType } from '@/lib/cbc-utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { computeGradeAnalysis, SUB_LEVELS, type GradeAnalysisReport } from '@/lib/cbc-analysis-utils';
import { FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function GradeAnalysisPage() {
  const { user, role, schoolId } = useAuth();
  const dynamicGrades = useSchoolGrades();
  const currentYear = new Date().getFullYear();

  const [selectedGrade, setSelectedGrade] = useState(dynamicGrades[0] || '1');
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentType>('end_term');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<'all' | 'Male' | 'Female'>('all');

  const { data: dbStreams = [] } = useQuery({
    queryKey: ['streams', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name').eq('school_id', schoolId!).order('name');
      return (data || []).map((s: any) => s.name as string);
    },
    enabled: !!schoolId,
  });

  // Auto-select first stream
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

  // Filter learners by gender and exclude those with no scores
  const filteredLearners = useMemo(() => {
    let filtered = selectedGenderFilter === 'all' ? learners : learners.filter(l => (l as any).gender === selectedGenderFilter);
    // Exclude learners with no scores
    const learnerIdsWithScores = new Set(scores.map(s => s.learner_id));
    return filtered.filter(l => learnerIdsWithScores.has(l.id));
  }, [learners, scores, selectedGenderFilter]);

  const analysis: GradeAnalysisReport = useMemo(
    () => computeGradeAnalysis(filteredLearners, subjects, scores),
    [filteredLearners, subjects, scores]
  );

  const { data: schoolSettings = {} } = useQuery({
    queryKey: ['school-settings-map'],
    queryFn: async () => {
      const { data } = await supabase.from('school_settings').select('*');
      const map: Record<string, string> = {};
      (data || []).forEach(s => { map[s.key] = s.value; });
      return map;
    },
    enabled: !!user,
  });

  const schoolName = schoolSettings['school_name'] || 'SCHOOL';
  const streamLabel = selectedStreams.length === 1 ? selectedStreams[0] : selectedStreams.join(' + ');
  const title = `GRADE ${selectedGrade} ${streamLabel} END OF TERM EXAM ${selectedTerm} ${selectedYear} ANALYSIS`;

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const cx = doc.internal.pageSize.getWidth() / 2;
    let y = 14;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(schoolName.toUpperCase(), cx, y, { align: 'center' });
    y += 8;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(title, cx, y, { align: 'center' });
    y += 8;

    const headers = ['SUBJECT', ...SUB_LEVELS, 'ENTRY', 'T. POINT', 'AVERAGE', 'MEAN'];
    const body = analysis.subjects.map(sa => [
      sa.subjectName,
      ...SUB_LEVELS.map(lv => sa.distribution[lv]),
      sa.entryCount,
      sa.totalPoints,
      sa.averageScore,
      sa.meanGradePoint,
    ]);
    // Overall row
    body.push([
      'OVERALL',
      ...SUB_LEVELS.map(lv => analysis.overallDistribution[lv]),
      analysis.totalEntries,
      analysis.overallTotalPoints,
      analysis.overallAverage,
      analysis.overallMean,
    ]);

    autoTable(doc, {
      head: [headers],
      body,
      startY: y,
      styles: { fontSize: 8, halign: 'center' },
      headStyles: { fillColor: [41, 128, 185], halign: 'center' },
      columnStyles: { 0: { halign: 'left' } },
    });

    doc.save(`Analysis_G${selectedGrade}_${streamLabel}_T${selectedTerm}_${selectedYear}.pdf`);
  };

  const exportExcel = () => {
    const headers = ['SUBJECT', ...SUB_LEVELS, 'ENTRY', 'T. POINT', 'AVERAGE', 'MEAN'];
    const rows = analysis.subjects.map(sa => [
      sa.subjectName,
      ...SUB_LEVELS.map(lv => sa.distribution[lv]),
      sa.entryCount, sa.totalPoints, sa.averageScore, sa.meanGradePoint,
    ]);
    rows.push([
      'OVERALL',
      ...SUB_LEVELS.map(lv => analysis.overallDistribution[lv]),
      analysis.totalEntries, analysis.overallTotalPoints, analysis.overallAverage, analysis.overallMean,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([[title], [], headers, ...rows]);
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
            <p className="text-muted-foreground text-sm">CBC sub-level distribution analysis per grade and stream</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportPDF} disabled={analysis.subjects.length === 0}>
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
            <Label className="text-xs">Stream(s) — select multiple to combine</Label>
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
          <div className="space-y-1">
            <Label className="text-xs">Gender</Label>
            <Select value={selectedGenderFilter} onValueChange={v => setSelectedGenderFilter(v as any)}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Analysis Table */}
        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-sm font-display uppercase tracking-wide">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{learners.length} learner(s) • {subjects.length} subject(s)</p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[140px]">SUBJECT</TableHead>
                  {SUB_LEVELS.map(lv => (
                    <TableHead key={lv} className="text-center min-w-[50px] text-xs">{lv}</TableHead>
                  ))}
                  <TableHead className="text-center min-w-[60px] text-xs">ENTRY</TableHead>
                  <TableHead className="text-center min-w-[70px] text-xs">T. POINT</TableHead>
                  <TableHead className="text-center min-w-[70px] text-xs">AVERAGE</TableHead>
                  <TableHead className="text-center min-w-[60px] text-xs">MEAN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.subjects.map(sa => (
                  <TableRow key={sa.subjectId}>
                    <TableCell className="font-medium">{sa.subjectName}</TableCell>
                    {SUB_LEVELS.map(lv => (
                      <TableCell key={lv} className="text-center">{sa.distribution[lv]}</TableCell>
                    ))}
                    <TableCell className="text-center">{sa.entryCount}</TableCell>
                    <TableCell className="text-center font-semibold">{sa.totalPoints}</TableCell>
                    <TableCell className="text-center">{sa.averageScore}</TableCell>
                    <TableCell className="text-center font-semibold">{sa.meanGradePoint}</TableCell>
                  </TableRow>
                ))}
                {analysis.subjects.length > 0 && (
                  <TableRow className="bg-muted/30 font-bold border-t-2">
                    <TableCell>OVERALL</TableCell>
                    {SUB_LEVELS.map(lv => (
                      <TableCell key={lv} className="text-center">{analysis.overallDistribution[lv]}</TableCell>
                    ))}
                    <TableCell className="text-center">{analysis.totalEntries}</TableCell>
                    <TableCell className="text-center">{analysis.overallTotalPoints}</TableCell>
                    <TableCell className="text-center">{analysis.overallAverage}</TableCell>
                    <TableCell className="text-center">{analysis.overallMean}</TableCell>
                  </TableRow>
                )}
                {analysis.subjects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                      No data available. Select a grade and stream with scores entered.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

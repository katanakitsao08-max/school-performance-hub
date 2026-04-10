import { useState, useMemo, useRef } from 'react';
import { computeAnalysis } from '@/lib/analysis-utils';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Printer, FileDown, User, School } from 'lucide-react';
import { TERMS, getGrade, getGradeColor, getGradeLabel, generateTeacherComment } from '@/lib/cbc-utils';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const { user, role, profile } = useAuth();
  const dynamicGrades = useSchoolGrades();
  const teacherGrades = profile?.assigned_grades?.length ? profile.assigned_grades : dynamicGrades;
  const availableGrades = role === 'teacher' ? teacherGrades : dynamicGrades;
  const [selectedGrades, setSelectedGrades] = useState<string[]>([availableGrades[0] || '1']);
  const [selectedStreams, setSelectedStreams] = useState<string[]>(['A']);
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'class' | 'individual' | 'school'>('class');
  const [selectedLearner, setSelectedLearner] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const reportRef = useRef<HTMLDivElement>(null);

  // For headteacher/admin: school-wide report
  const isSchoolWide = viewMode === 'school';
  const selectedGrade = selectedGrades[0] || '1';
  const selectedStream = selectedStreams[0] || '';
  const streamLabel = selectedStreams.length === 1 ? selectedStreams[0] : selectedStreams.join('+');

  const { data: dbStreams = [] } = useQuery({
    queryKey: ['streams'],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name').order('name');
      return (data || []).map((s: any) => s.name as string);
    },
  });

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

  const schoolName = schoolSettings['school_name'] || 'TAKAYE SCHOOL';
  const schoolMotto = schoolSettings['school_motto'] || '';
  const schoolAddress = schoolSettings['school_address'] || '';

  // For combined/school reports, fetch learners for multiple grades
  const { data: learners = [] } = useQuery({
    queryKey: ['learners-report', selectedGrades, selectedStreams, isSchoolWide],
    queryFn: async () => {
      let query = supabase.from('learners').select('*').eq('is_active', true).order('full_name');
      if (isSchoolWide) {
        // All grades
      } else if (selectedGrades.length === 1) {
        query = query.eq('grade', selectedGrades[0]);
        if (selectedStreams.length === 1) {
          query = query.eq('stream', selectedStreams[0]);
        } else if (selectedStreams.length > 1) {
          query = query.in('stream', selectedStreams);
        }
      } else {
        query = query.in('grade', selectedGrades);
        if (selectedStreams.length === 1) {
          query = query.eq('stream', selectedStreams[0]);
        } else if (selectedStreams.length > 1) {
          query = query.in('stream', selectedStreams);
        }
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch subjects for all selected grades
  const { data: subjects = [] } = useQuery({
    queryKey: ['learning-areas-report', selectedGrades, isSchoolWide],
    queryFn: async () => {
      let query = supabase.from('learning_areas').select('*').order('name');
      if (!isSchoolWide && selectedGrades.length === 1) {
        query = query.eq('grade', selectedGrades[0]);
      } else if (!isSchoolWide) {
        query = query.in('grade', selectedGrades);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: allScores = [] } = useQuery({
    queryKey: ['scores-report', selectedGrades, selectedStreams, selectedTerm, selectedYear, isSchoolWide],
    queryFn: async () => {
      const ids = learners.map(l => l.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('scores').select('*')
        .in('learner_id', ids).eq('term', selectedTerm).eq('year', selectedYear);
      return data || [];
    },
    enabled: learners.length > 0 && !!user,
  });

  // For class/individual view, get subjects for the single selected grade
  const gradeSubjects = useMemo(() => {
    if (isSchoolWide || selectedGrades.length > 1) return subjects;
    return subjects.filter(s => s.grade === selectedGrade);
  }, [subjects, selectedGrade, isSchoolWide, selectedGrades]);

  const reportData = useMemo(() => {
    // For combined/school reports, we rank per grade
    const relevantSubjects = isSchoolWide ? subjects : gradeSubjects;
    
    return learners.map(l => {
      const learnerGradeSubjects = relevantSubjects.filter(s => s.grade === l.grade);
      const learnerScores = allScores.filter(s => s.learner_id === l.id);
      const subjectData = learnerGradeSubjects.map(sub => {
        const sc = learnerScores.find(s => s.learning_area_id === sub.id);
        return {
          id: sub.id, name: sub.name, maxScore: sub.max_score,
          score: sc?.score || 0,
          grade: sc ? getGrade(sc.score, sub.max_score) : '-' as any,
          comment: sc?.teacher_comment || '',
        };
      });
      const total = subjectData.reduce((s, d) => s + d.score, 0);
      const maxTotal = learnerGradeSubjects.reduce((s, sub) => s + sub.max_score, 0);
      const mean = learnerGradeSubjects.length > 0 ? total / learnerGradeSubjects.length : 0;
      const avgMax = learnerGradeSubjects.length > 0 ? maxTotal / learnerGradeSubjects.length : 100;
      return {
        ...l, subjectData, total, mean,
        overallGrade: learnerGradeSubjects.length > 0 ? getGrade(mean, avgMax) : '-',
      };
    }).sort((a, b) => b.total - a.total).map((l, i, arr) => {
      let rank = i + 1;
      if (i > 0 && arr[i - 1].total === l.total) rank = arr.findIndex(x => x.total === l.total) + 1;
      return { ...l, rank };
    });
  }, [learners, allScores, subjects, gradeSubjects, isSchoolWide]);

  const subjectMeans = useMemo(() => {
    return gradeSubjects.map(sub => {
      const scores = allScores.filter(s => s.learning_area_id === sub.id);
      const avg = scores.length > 0 ? scores.reduce((s, sc) => s + sc.score, 0) / scores.length : 0;
      return { name: sub.name, mean: avg };
    });
  }, [gradeSubjects, allScores]);

  const classMean = reportData.length > 0 ? reportData.reduce((s, l) => s + l.mean, 0) / reportData.length : 0;
  const highest = reportData.length > 0 ? Math.max(...reportData.map(l => l.total)) : 0;
  const lowest = reportData.length > 0 ? Math.min(...reportData.map(l => l.total)) : 0;

  const generateComment = (learner: any) => {
    const comment = generateTeacherComment(
      learner.full_name, learner.mean,
      gradeSubjects.length > 0 ? gradeSubjects.reduce((s, sub) => s + sub.max_score, 0) / gradeSubjects.length : 100,
      learner.subjectData.map((s: any) => ({ name: s.name, score: s.score, maxScore: s.maxScore }))
    );
    setComments(prev => ({ ...prev, [learner.id]: comment }));
  };

  const handlePrint = () => window.print();

  const toggleGradeSelection = (grade: string) => {
    setSelectedGrades(prev => {
      if (prev.includes(grade)) {
        const next = prev.filter(g => g !== grade);
        return next.length > 0 ? next : prev;
      }
      return [...prev, grade];
    });
  };

  const addPdfHeader = (doc: jsPDF, y: number) => {
    const cx = doc.internal.pageSize.getWidth() / 2;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolName.toUpperCase(), cx, y, { align: 'center' });
    if (schoolMotto) { y += 7; doc.setFontSize(10); doc.setFont('helvetica', 'italic'); doc.text(schoolMotto, cx, y, { align: 'center' }); }
    if (schoolAddress) { y += 5; doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(schoolAddress, cx, y, { align: 'center' }); }
    y += 3;
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
    return y + 5;
  };

  const exportClassPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    let y = 12;
    y = addPdfHeader(doc, y);
    const cx = doc.internal.pageSize.getWidth() / 2;
    const title = isSchoolWide
      ? 'WHOLE SCHOOL REPORT'
      : selectedGrades.length > 1
        ? `COMBINED REPORT — Grades ${selectedGrades.join(', ')} ${streamLabel}`
        : `CLASS REPORT — Grade ${selectedGrade} ${streamLabel}`;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(title, cx, y, { align: 'center' });
    y += 6;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Term ${selectedTerm}, ${selectedYear}`, cx, y, { align: 'center' });

    const showGradeCol = isSchoolWide || selectedGrades.length > 1;
    const displaySubjects = isSchoolWide ? [] : gradeSubjects;
    
    const headers = ['#', 'Name', ...(showGradeCol ? ['Grade'] : []),
      ...displaySubjects.map(s => s.name), 'Total', 'Mean', 'Grade', 'Rank'];
    const body = reportData.map(l => [
      l.rank, l.full_name, ...(showGradeCol ? [`${l.grade}${l.stream}`] : []),
      ...l.subjectData.map((s: any) => `${s.score} (${s.grade})`),
      l.total, l.mean.toFixed(1), l.overallGrade, l.rank,
    ]);

    autoTable(doc, { head: [headers], body, startY: y + 4, styles: { fontSize: 7 } });

    // --- Analysis Pages (appended, existing pages untouched) ---
    const analysis = computeAnalysis(reportData, isSchoolWide ? [] : gradeSubjects, allScores);
    if (analysis.subjectAnalyses.length > 0) {
      doc.addPage('landscape');
      let ay = 12;
      ay = addPdfHeader(doc, ay);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('PERFORMANCE ANALYSIS', cx, ay, { align: 'center' });
      ay += 8;

      // Subject means table
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Subject Mean Scores', 14, ay); ay += 2;
      autoTable(doc, {
        head: [['Subject', 'Mean Score', 'Max Score', 'Grade']],
        body: analysis.subjectAnalyses.map(s => [s.name, s.mean, s.maxScore, s.grade]),
        startY: ay, styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
      });
      ay = (doc as any).lastAutoTable.finalY + 8;

      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`Class Mean: ${analysis.classMean}`, 14, ay); ay += 6;
      if (analysis.bestSubject) { doc.text(`Best Performing Subject: ${analysis.bestSubject.name} (${analysis.bestSubject.mean})`, 14, ay); ay += 6; }
      if (analysis.leastSubject) { doc.text(`Least Performing Subject: ${analysis.leastSubject.name} (${analysis.leastSubject.mean})`, 14, ay); ay += 6; }
      ay += 4;

      // Top 5 overall
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Top 5 Learners (Overall)', 14, ay); ay += 2;
      autoTable(doc, {
        head: [['Rank', 'Name', 'Total', 'Mean', 'Grade']],
        body: analysis.top5Overall.map(l => [l.rank, l.name, l.total, l.mean, l.grade]),
        startY: ay, styles: { fontSize: 8 },
        headStyles: { fillColor: [39, 174, 96] },
      });

      // Top 5 per subject page
      doc.addPage('landscape');
      let ty = 12;
      ty = addPdfHeader(doc, ty);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('TOP 5 LEARNERS PER SUBJECT', cx, ty, { align: 'center' });
      ty += 8;

      analysis.subjectAnalyses.forEach(sub => {
        if (ty > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage('landscape');
          ty = 15;
        }
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(sub.name, 14, ty); ty += 2;
        autoTable(doc, {
          head: [['#', 'Name', 'Score', 'Grade']],
          body: sub.top5.map((l, i) => [i + 1, l.name, l.score, l.grade]),
          startY: ty, styles: { fontSize: 8 }, margin: { left: 14 },
        });
        ty = (doc as any).lastAutoTable.finalY + 6;
      });
    }

    doc.save(`Report_${isSchoolWide ? 'School' : `G${selectedGrades.join('-')}`}_T${selectedTerm}_${selectedYear}.pdf`);
  };

  const exportIndividualPDF = (learnerData?: any) => {
    const ld = learnerData || selectedLearnerData;
    if (!ld) return;

    const doc = new jsPDF();
    let y = 15;
    y = addPdfHeader(doc, y);
    const cx = doc.internal.pageSize.getWidth() / 2;

    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('LEARNER REPORT CARD', cx, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${ld.full_name}`, 14, y);
    doc.text(`Adm No: ${ld.admission_number}`, 120, y);
    y += 6;
    doc.text(`Grade: ${ld.grade}${ld.stream}`, 14, y);
    doc.text(`Term: ${selectedTerm}, ${selectedYear}`, 120, y);
    y += 8;

    // Subject table with per-subject grade and remark
    const headers = ['Subject', 'Score', 'Max', 'Grade', 'Remark'];
    const body = ld.subjectData.map((s: any) => [
      s.name, s.score, s.maxScore, s.grade, s.grade !== '-' ? getGradeLabel(s.grade) : '-'
    ]);

    autoTable(doc, {
      head: [headers],
      body,
      startY: y,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Summary
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY', 14, y);
    y += 7;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Total Score: ${ld.total}`, 14, y);
    doc.text(`Mean Score: ${ld.mean.toFixed(1)}`, 80, y);
    y += 6;
    doc.text(`Overall Grade: ${ld.overallGrade}${ld.overallGrade !== '-' ? ` (${getGradeLabel(ld.overallGrade as any)})` : ''}`, 14, y);
    doc.text(`Position: ${ld.rank} out of ${reportData.length}`, 80, y);
    y += 10;

    const comment = comments[ld.id];
    if (comment) {
      doc.setFont('helvetica', 'bold');
      doc.text("Teacher's Comment:", 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(comment, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 5;
    }

    y += 10;
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(14, y, 80, y);
    doc.line(110, y, 196, y);
    y += 5;
    doc.setFontSize(9);
    doc.text("Class Teacher's Signature", 14, y);
    doc.text("Head Teacher's Signature", 110, y);
    y += 6;
    doc.line(14, y + 8, 80, y + 8);
    doc.line(110, y + 8, 196, y + 8);
    doc.text("Date", 14, y + 13);
    doc.text("Date", 110, y + 13);

    doc.save(`Report_${ld.full_name.replace(/\s+/g, '_')}_G${ld.grade}_T${selectedTerm}_${selectedYear}.pdf`);
  };

  const exportExcel = () => {
    const showGradeCol = isSchoolWide || selectedGrades.length > 1;
    const displaySubjects = isSchoolWide ? [] : gradeSubjects;
    const headers = ['Rank', 'Name', ...(showGradeCol ? ['Class'] : []), ...displaySubjects.map(s => s.name), 'Total', 'Mean', 'Grade'];
    const data = reportData.map(l => [
      l.rank, l.full_name, ...(showGradeCol ? [`${l.grade}${l.stream}`] : []),
      ...l.subjectData.map((s: any) => s.score),
      l.total, Number(l.mean.toFixed(1)), l.overallGrade,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    // --- Analysis Sheet (new, does not touch 'Report' sheet) ---
    const analysis = computeAnalysis(reportData, isSchoolWide ? [] : gradeSubjects, allScores);
    if (analysis.subjectAnalyses.length > 0) {
      const aRows: any[][] = [
        ['PERFORMANCE ANALYSIS'],
        [],
        ['Subject Mean Scores'],
        ['Subject', 'Mean Score', 'Max Score', 'Grade'],
        ...analysis.subjectAnalyses.map(s => [s.name, s.mean, s.maxScore, s.grade]),
        [],
        ['Class Mean', analysis.classMean],
        ['Best Subject', analysis.bestSubject?.name || '-', analysis.bestSubject?.mean || '-'],
        ['Least Subject', analysis.leastSubject?.name || '-', analysis.leastSubject?.mean || '-'],
        [],
        ['Top 5 Learners (Overall)'],
        ['Rank', 'Name', 'Total', 'Mean', 'Grade'],
        ...analysis.top5Overall.map(l => [l.rank, l.name, l.total, l.mean, l.grade]),
      ];
      const aws = XLSX.utils.aoa_to_sheet(aRows);
      XLSX.utils.book_append_sheet(wb, aws, 'Analysis');

      // Top Learners per subject sheet
      const tRows: any[][] = [['TOP 5 LEARNERS PER SUBJECT'], []];
      analysis.subjectAnalyses.forEach(sub => {
        tRows.push([sub.name]);
        tRows.push(['#', 'Name', 'Score', 'Grade']);
        sub.top5.forEach((l, i) => tRows.push([i + 1, l.name, l.score, l.grade]));
        tRows.push([]);
      });
      const tws = XLSX.utils.aoa_to_sheet(tRows);
      XLSX.utils.book_append_sheet(wb, tws, 'Top Learners');
    }

    XLSX.writeFile(wb, `Report_${isSchoolWide ? 'School' : `G${selectedGrades.join('-')}`}_T${selectedTerm}_${selectedYear}.xlsx`);
  };

  const selectedLearnerData = selectedLearner ? reportData.find(l => l.id === selectedLearner) : null;

  const viewModeOptions = [
    { value: 'class', label: 'Class Report' },
    { value: 'individual', label: 'Individual Report' },
  ];
  if (role === 'admin' || role === 'headteacher') {
    viewModeOptions.push({ value: 'school', label: 'Whole School Report' });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4 no-print">
          <div>
            <h1 className="text-2xl font-display font-bold">Reports</h1>
            <p className="text-muted-foreground">Class, individual & school-wide performance reports</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
            {viewMode !== 'individual' ? (
              <>
                <Button variant="outline" onClick={exportClassPDF}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                <Button variant="outline" onClick={exportExcel}><FileDown className="mr-2 h-4 w-4" /> Excel</Button>
              </>
            ) : selectedLearnerData && (
              <Button variant="outline" onClick={() => exportIndividualPDF()}>
                <User className="mr-2 h-4 w-4" /> Download Report Card
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-4 flex-wrap no-print items-end">
          <div className="space-y-1">
            <Label className="text-xs">Report Type</Label>
            <Select value={viewMode} onValueChange={v => { setViewMode(v as any); if (v === 'school') setSelectedGrades(availableGrades); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {viewModeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!isSchoolWide && (
            <>
              {(role === 'admin' || role === 'headteacher') && viewMode === 'class' ? (
                <div className="space-y-1">
                  <Label className="text-xs">Grades (select multiple to combine)</Label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-w-[200px]">
                    {availableGrades.map(g => (
                      <label key={g} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={selectedGrades.includes(g)}
                          onCheckedChange={() => toggleGradeSelection(g)}
                        />
                        G{g}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Grade</Label>
                  <Select value={selectedGrade} onValueChange={v => setSelectedGrades([v])}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{availableGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Stream(s)</Label>
                {(role === 'admin' || role === 'headteacher') ? (
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-w-[160px]">
                    {dbStreams.map(s => (
                      <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedStreams.includes(s)}
                          onCheckedChange={() => {
                            setSelectedStreams(prev => {
                              if (prev.includes(s)) {
                                const next = prev.filter(x => x !== s);
                                return next.length > 0 ? next : prev;
                              }
                              return [...prev, s];
                            });
                          }}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                ) : (
                  <Select value={selectedStream} onValueChange={v => setSelectedStreams([v])}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{dbStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Term</Label>
            <Select value={String(selectedTerm)} onValueChange={v => setSelectedTerm(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {viewMode === 'individual' && (
            <div className="space-y-1">
              <Label className="text-xs">Learner</Label>
              <Select value={selectedLearner || ''} onValueChange={setSelectedLearner}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select learner" /></SelectTrigger>
                <SelectContent>{learners.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div ref={reportRef}>
          {viewMode === 'individual' ? (
            selectedLearnerData ? (
              <Card>
                <CardHeader className="text-center">
                  <p className="text-lg font-bold uppercase">{schoolName}</p>
                  {schoolMotto && <p className="text-sm italic text-muted-foreground">{schoolMotto}</p>}
                  {schoolAddress && <p className="text-xs text-muted-foreground">{schoolAddress}</p>}
                  <CardTitle className="font-display">Report Card — {selectedLearnerData.full_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Grade {selectedLearnerData.grade}{selectedLearnerData.stream} • Term {selectedTerm}, {selectedYear} •
                    Adm No: {selectedLearnerData.admission_number}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-center">Score</TableHead>
                        <TableHead className="text-center">Max</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead>Remark</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLearnerData.subjectData.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-center">{s.score}</TableCell>
                          <TableCell className="text-center">{s.maxScore}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={s.grade !== '-' ? getGradeColor(s.grade) : ''}>{s.grade}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.grade !== '-' ? getGradeLabel(s.grade) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                    <div><span className="text-sm text-muted-foreground">Total:</span><p className="text-xl font-bold">{selectedLearnerData.total}</p></div>
                    <div><span className="text-sm text-muted-foreground">Mean:</span><p className="text-xl font-bold">{selectedLearnerData.mean.toFixed(1)}</p></div>
                    <div>
                      <span className="text-sm text-muted-foreground">Overall Grade:</span>
                      <p className="text-xl font-bold">
                        {selectedLearnerData.overallGrade}
                        {selectedLearnerData.overallGrade !== '-' && (
                          <span className="text-sm font-normal ml-1 text-muted-foreground">
                            ({getGradeLabel(selectedLearnerData.overallGrade as any)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div><span className="text-sm text-muted-foreground">Position:</span><p className="text-xl font-bold">{selectedLearnerData.rank} / {reportData.length}</p></div>
                  </div>
                  <div className="space-y-2 no-print">
                    <div className="flex items-center justify-between">
                      <Label>Teacher's Comment</Label>
                      <Button variant="outline" size="sm" onClick={() => generateComment(selectedLearnerData)}>
                        Auto-Generate
                      </Button>
                    </div>
                    <Textarea
                      value={comments[selectedLearnerData.id] || ''}
                      onChange={e => setComments(prev => ({ ...prev, [selectedLearnerData.id]: e.target.value }))}
                      placeholder="Enter teacher's comment..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Select a learner to view their report card</CardContent></Card>
            )
          ) : (
            <Card>
              <CardHeader className="text-center">
                <p className="text-lg font-bold uppercase">{schoolName}</p>
                {schoolMotto && <p className="text-sm italic text-muted-foreground">{schoolMotto}</p>}
                {schoolAddress && <p className="text-xs text-muted-foreground">{schoolAddress}</p>}
                <CardTitle className="font-display">
                  {isSchoolWide
                    ? `Whole School Report — Term ${selectedTerm}, ${selectedYear}`
                    : selectedGrades.length > 1
                      ? `Combined Report — Grades ${selectedGrades.join(', ')} ${streamLabel} — Term ${selectedTerm}, ${selectedYear}`
                      : `Grade ${selectedGrade} ${streamLabel} — Term ${selectedTerm}, ${selectedYear}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      {(isSchoolWide || selectedGrades.length > 1) && <TableHead>Class</TableHead>}
                      {!isSchoolWide && selectedGrades.length === 1 && gradeSubjects.map(s => (
                        <TableHead key={s.id} className="text-center">{s.name}</TableHead>
                      ))}
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Mean</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead className="text-center">Rank</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map(l => (
                      <TableRow key={l.id}>
                        <TableCell>{l.rank}</TableCell>
                        <TableCell className="font-medium">{l.full_name}</TableCell>
                        {(isSchoolWide || selectedGrades.length > 1) && <TableCell>{l.grade}{l.stream}</TableCell>}
                        {!isSchoolWide && selectedGrades.length === 1 && l.subjectData.map((s: any) => (
                          <TableCell key={s.id} className="text-center">
                            <div>
                              <span className={s.grade !== '-' ? getGradeColor(s.grade) : ''}>{s.score}</span>
                              {s.grade !== '-' && (
                                <span className={`block text-xs ${getGradeColor(s.grade)}`}>{s.grade}</span>
                              )}
                            </div>
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold">{l.total}</TableCell>
                        <TableCell className="text-center">{l.mean.toFixed(1)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={l.overallGrade !== '-' ? getGradeColor(l.overallGrade as any) : ''}>
                            {l.overallGrade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold">{l.rank}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Class Mean:</span> <strong>{classMean.toFixed(1)}</strong></div>
                  <div><span className="text-muted-foreground">Highest Total:</span> <strong>{highest}</strong></div>
                  <div><span className="text-muted-foreground">Lowest Total:</span> <strong>{lowest}</strong></div>
                  <div><span className="text-muted-foreground">Total Learners:</span> <strong>{reportData.length}</strong></div>
                </div>
                {!isSchoolWide && selectedGrades.length === 1 && subjectMeans.length > 0 && (
                  <div className="p-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Subject Means:</p>
                    <div className="flex flex-wrap gap-3">
                      {subjectMeans.map(s => (
                        <Badge key={s.name} variant="secondary">{s.name}: {s.mean.toFixed(1)}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

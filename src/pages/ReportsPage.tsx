import { useState, useMemo, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Printer, FileDown, User } from 'lucide-react';
import { GRADES, TERMS, getGrade, getGradeColor, getGradeLabel, generateTeacherComment } from '@/lib/cbc-utils';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const { user, role, profile } = useAuth();
  const availableGrades = role === 'teacher' ? (profile?.assigned_grades || []) : GRADES;
  const [selectedGrade, setSelectedGrade] = useState(availableGrades[0] || '1');
  const [selectedStream, setSelectedStream] = useState('A');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'class' | 'individual'>('class');
  const [selectedLearner, setSelectedLearner] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const reportRef = useRef<HTMLDivElement>(null);

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

  const { data: learners = [] } = useQuery({
    queryKey: ['learners', selectedGrade, selectedStream],
    queryFn: async () => {
      const { data } = await supabase.from('learners').select('*')
        .eq('grade', selectedGrade).eq('stream', selectedStream).eq('is_active', true).order('full_name');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['learning-areas', selectedGrade],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('*').eq('grade', selectedGrade).order('name');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: allScores = [] } = useQuery({
    queryKey: ['scores', selectedGrade, selectedStream, selectedTerm, selectedYear],
    queryFn: async () => {
      const ids = learners.map(l => l.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('scores').select('*')
        .in('learner_id', ids).eq('term', selectedTerm).eq('year', selectedYear);
      return data || [];
    },
    enabled: learners.length > 0 && !!user,
  });

  const reportData = useMemo(() => {
    return learners.map(l => {
      const learnerScores = allScores.filter(s => s.learner_id === l.id);
      const subjectData = subjects.map(sub => {
        const sc = learnerScores.find(s => s.learning_area_id === sub.id);
        return {
          id: sub.id, name: sub.name, maxScore: sub.max_score,
          score: sc?.score || 0,
          grade: sc ? getGrade(sc.score, sub.max_score) : '-',
          comment: sc?.teacher_comment || '',
        };
      });
      const total = subjectData.reduce((s, d) => s + d.score, 0);
      const maxTotal = subjects.reduce((s, sub) => s + sub.max_score, 0);
      const mean = subjects.length > 0 ? total / subjects.length : 0;
      const avgMax = subjects.length > 0 ? maxTotal / subjects.length : 100;
      return {
        ...l, subjectData, total, mean,
        overallGrade: subjects.length > 0 ? getGrade(mean, avgMax) : '-',
      };
    }).sort((a, b) => b.total - a.total).map((l, i, arr) => {
      let rank = i + 1;
      if (i > 0 && arr[i - 1].total === l.total) rank = arr.findIndex(x => x.total === l.total) + 1;
      return { ...l, rank };
    });
  }, [learners, allScores, subjects]);

  const subjectMeans = useMemo(() => {
    return subjects.map(sub => {
      const scores = allScores.filter(s => s.learning_area_id === sub.id);
      const avg = scores.length > 0 ? scores.reduce((s, sc) => s + sc.score, 0) / scores.length : 0;
      return { name: sub.name, mean: avg };
    });
  }, [subjects, allScores]);

  const classMean = reportData.length > 0 ? reportData.reduce((s, l) => s + l.mean, 0) / reportData.length : 0;
  const highest = reportData.length > 0 ? Math.max(...reportData.map(l => l.total)) : 0;
  const lowest = reportData.length > 0 ? Math.min(...reportData.map(l => l.total)) : 0;

  const generateComment = (learner: any) => {
    const comment = generateTeacherComment(
      learner.full_name, learner.mean,
      subjects.length > 0 ? subjects.reduce((s, sub) => s + sub.max_score, 0) / subjects.length : 100,
      learner.subjectData.map((s: any) => ({ name: s.name, score: s.score, maxScore: s.maxScore }))
    );
    setComments(prev => ({ ...prev, [learner.id]: comment }));
  };

  const handlePrint = () => window.print();

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
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`CLASS REPORT — Grade ${selectedGrade}${selectedStream}`, cx, y, { align: 'center' });
    y += 6;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Term ${selectedTerm}, ${selectedYear}`, cx, y, { align: 'center' });

    const headers = ['#', 'Name', ...subjects.map(s => s.name), 'Total', 'Mean', 'Grade', 'Rank'];
    const body = reportData.map(l => [
      l.rank, l.full_name,
      ...l.subjectData.map((s: any) => s.score),
      l.total, l.mean.toFixed(1), l.overallGrade, l.rank,
    ]);

    autoTable(doc, { head: [headers], body, startY: y + 4, styles: { fontSize: 8 } });
    doc.save(`ClassReport_G${selectedGrade}${selectedStream}_T${selectedTerm}_${selectedYear}.pdf`);
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

    // Learner info
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${ld.full_name}`, 14, y);
    doc.text(`Adm No: ${ld.admission_number}`, 120, y);
    y += 6;
    doc.text(`Grade: ${selectedGrade}${selectedStream}`, 14, y);
    doc.text(`Term: ${selectedTerm}, ${selectedYear}`, 120, y);
    y += 8;

    // Subject table
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
    doc.text(`Overall Grade: ${ld.overallGrade}`, 14, y);
    doc.text(`Position: ${ld.rank} out of ${reportData.length}`, 80, y);
    y += 10;

    // Comment
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

    // Signatures
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

    doc.save(`Report_${ld.full_name.replace(/\s+/g, '_')}_G${selectedGrade}_T${selectedTerm}_${selectedYear}.pdf`);
  };

  const exportExcel = () => {
    const headers = ['Rank', 'Name', ...subjects.map(s => s.name), 'Total', 'Mean', 'Grade'];
    const data = reportData.map(l => [
      l.rank, l.full_name,
      ...l.subjectData.map((s: any) => s.score),
      l.total, Number(l.mean.toFixed(1)), l.overallGrade,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `Report_G${selectedGrade}${selectedStream}_T${selectedTerm}_${selectedYear}.xlsx`);
  };

  const selectedLearnerData = selectedLearner ? reportData.find(l => l.id === selectedLearner) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4 no-print">
          <div>
            <h1 className="text-2xl font-display font-bold">Reports</h1>
            <p className="text-muted-foreground">Class & individual performance reports</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
            {viewMode === 'class' ? (
              <>
                <Button variant="outline" onClick={exportClassPDF}><FileDown className="mr-2 h-4 w-4" /> Class PDF</Button>
                <Button variant="outline" onClick={exportExcel}><FileDown className="mr-2 h-4 w-4" /> Excel</Button>
              </>
            ) : selectedLearnerData && (
              <Button variant="outline" onClick={() => exportIndividualPDF()}>
                <User className="mr-2 h-4 w-4" /> Download Report Card
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-4 flex-wrap no-print">
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{availableGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedStream} onValueChange={setSelectedStream}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{dbStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(selectedTerm)} onValueChange={v => setSelectedTerm(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={viewMode} onValueChange={v => setViewMode(v as any)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="class">Class Report</SelectItem>
              <SelectItem value="individual">Individual Report</SelectItem>
            </SelectContent>
          </Select>
          {viewMode === 'individual' && (
            <Select value={selectedLearner || ''} onValueChange={setSelectedLearner}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select learner" /></SelectTrigger>
              <SelectContent>{learners.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        <div ref={reportRef}>
          {viewMode === 'class' ? (
            <Card>
              <CardHeader className="text-center">
                <p className="text-lg font-bold uppercase">{schoolName}</p>
                {schoolMotto && <p className="text-sm italic text-muted-foreground">{schoolMotto}</p>}
                {schoolAddress && <p className="text-xs text-muted-foreground">{schoolAddress}</p>}
                <CardTitle className="font-display">
                  Grade {selectedGrade}{selectedStream} — Term {selectedTerm}, {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      {subjects.map(s => <TableHead key={s.id} className="text-center">{s.name}</TableHead>)}
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
                        {l.subjectData.map((s: any) => (
                          <TableCell key={s.id} className="text-center">
                            <span className={s.grade !== '-' ? getGradeColor(s.grade) : ''}>{s.score}</span>
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
                {subjectMeans.length > 0 && (
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
          ) : selectedLearnerData ? (
            <Card>
              <CardHeader className="text-center">
                <p className="text-lg font-bold uppercase">{schoolName}</p>
                {schoolMotto && <p className="text-sm italic text-muted-foreground">{schoolMotto}</p>}
                {schoolAddress && <p className="text-xs text-muted-foreground">{schoolAddress}</p>}
                <CardTitle className="font-display">Report Card — {selectedLearnerData.full_name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Grade {selectedGrade}{selectedStream} • Term {selectedTerm}, {selectedYear} •
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
                  <div><span className="text-sm text-muted-foreground">Overall Grade:</span><p className="text-xl font-bold">{selectedLearnerData.overallGrade}</p></div>
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
                {comments[selectedLearnerData.id] && (
                  <div className="p-3 border rounded-lg print-only hidden">
                    <p className="text-sm"><strong>Teacher's Comment:</strong> {comments[selectedLearnerData.id]}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Select a learner to view their report card</CardContent></Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

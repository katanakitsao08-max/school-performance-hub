import { Fragment, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { fetchAllPaged } from '@/lib/fetch-all';
import {
  TERMS,
  ASSESSMENT_TYPES,
  ASSESSMENT_TYPE_LABELS,
  type AssessmentType,
  computeLearnerMeanPoints,
  meanPointsToLevel,
  getPerfLevel,
} from '@/lib/cbc-utils';
import { buildSubjectTeacherMap, getSubjectTeacherName } from '@/lib/subject-teacher-map';
import { Printer, FileDown, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type ReportKind = 'best_subject' | 'best_stream' | 'school_assessment';

// Group grades into KNEC bands: ECDE/PP, Lower Primary (1-3), Upper Primary (4-6), Junior School (7-9)
function gradeBand(grade: string): { order: number; label: string } {
  const g = String(grade).trim().toUpperCase();
  if (g.startsWith('PP') || g.startsWith('ECDE') || g === 'BABY' || g === 'NURSERY') {
    return { order: 0, label: 'ECDE / Pre-Primary' };
  }
  const n = parseInt(g, 10);
  if (!isNaN(n)) {
    if (n >= 1 && n <= 3) return { order: 1, label: 'Lower Primary (Grade 1-3)' };
    if (n >= 4 && n <= 6) return { order: 2, label: 'Upper Primary (Grade 4-6)' };
    if (n >= 7 && n <= 9) return { order: 3, label: 'Junior School (Grade 7-9)' };
  }
  return { order: 9, label: 'Other' };
}
function bandSort(a: { grade: string; stream: string }, b: { grade: string; stream: string }) {
  return (
    gradeBand(a.grade).order - gradeBand(b.grade).order ||
    a.grade.localeCompare(b.grade, undefined, { numeric: true }) ||
    a.stream.localeCompare(b.stream)
  );
}
function groupByBand<T extends { grade: string }>(rows: T[]): { label: string; order: number; rows: T[] }[] {
  const map = new Map<number, { label: string; order: number; rows: T[] }>();
  rows.forEach(r => {
    const b = gradeBand(r.grade);
    const cur = map.get(b.order) || { label: b.label, order: b.order, rows: [] };
    cur.rows.push(r);
    map.set(b.order, cur);
  });
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

export default function ConsolidatedReportsPage() {
  const { schoolId } = useAuth();
  const dynamicGrades = useSchoolGrades();

  const [tab, setTab] = useState<ReportKind>('best_subject');
  const [term, setTerm] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [assessment, setAssessment] = useState<AssessmentType>('end_term');
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  // ---------------- Data ----------------
  const { data: schoolSettings = {} } = useQuery({
    queryKey: ['cr-school-settings', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('school_settings').select('*').eq('school_id', schoolId!);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
    enabled: !!schoolId,
  });
  const { data: schoolRecord } = useQuery({
    queryKey: ['cr-school-record', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId!).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });
  const schoolName = schoolSettings['school_name'] || schoolRecord?.school_name || 'SCHOOL';

  const { data: learners = [] } = useQuery({
    queryKey: ['cr-learners', schoolId],
    queryFn: () => fetchAllPaged(() => supabase.from('learners').select('id, full_name, grade, stream').eq('school_id', schoolId!).eq('is_active', true)),
    enabled: !!schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['cr-subjects', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('id, name, grade, max_score').eq('school_id', schoolId!).eq('is_active', true);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['cr-scores', schoolId, term, year, assessment],
    queryFn: () =>
      fetchAllPaged(() =>
        supabase
          .from('scores')
          .select('learner_id, learning_area_id, score')
          .eq('school_id', schoolId!)
          .eq('term', term)
          .eq('year', year)
          .eq('assessment_type', assessment),
      ),
    enabled: !!schoolId,
  });

  const { data: teacherAssignments = [] } = useQuery({
    queryKey: ['cr-assignments', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('teacher_assignments').select('teacher_id, grade, stream, learning_area_id').eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ['cr-profiles', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const teacherMap = useMemo(
    () => buildSubjectTeacherMap(teacherAssignments as any, profiles as any),
    [teacherAssignments, profiles],
  );

  // ---------------- Computations ----------------
  // Map learning_area_id -> max
  const subjectById = useMemo(() => {
    const m = new Map<string, any>();
    subjects.forEach((s: any) => m.set(s.id, s));
    return m;
  }, [subjects]);

  // Per (grade, stream, subject) aggregates
  // scores filtered to chosen filters
  const filteredLearners = useMemo(
    () => (gradeFilter === 'all' ? learners : learners.filter((l: any) => l.grade === gradeFilter)),
    [learners, gradeFilter],
  );

  const learnerById = useMemo(() => {
    const m = new Map<string, any>();
    filteredLearners.forEach((l: any) => m.set(l.id, l));
    return m;
  }, [filteredLearners]);

  // Per-learner total points (used for stream means) — built first so we can
  // restrict subject aggregates to the SAME qualified cohort that appears on
  // each learner's final report card.
  const learnerPoints = useMemo(() => {
    const byLearner = new Map<string, { score: number; maxScore: number }[]>();
    scores.forEach((s: any) => {
      if (!learnerById.has(s.learner_id)) return;
      const sub = subjectById.get(s.learning_area_id);
      if (!sub) return;
      const arr = byLearner.get(s.learner_id) || [];
      arr.push({ score: Number(s.score) || 0, maxScore: Number(sub.max_score) || 100 });
      byLearner.set(s.learner_id, arr);
    });
    const out = new Map<string, { totalPoints: number; avgPoints: number }>();
    byLearner.forEach((subjData, lid) => {
      // require all scores > 0 to be qualified (mirror ReportsPage rule)
      if (subjData.length === 0 || subjData.some(d => d.score <= 0)) return;
      const r = computeLearnerMeanPoints(subjData);
      out.set(lid, { totalPoints: r.totalPoints, avgPoints: r.avgPoints });
    });
    return out;
  }, [scores, learnerById, subjectById]);

  // groupKey: `${grade}|${stream}|${subjectId}` -> {sum, max, count}
  // Only count scores from QUALIFIED learners so the per-subject mean matches
  // what appears on the final report cards.
  const subjectStreamAgg = useMemo(() => {
    const map = new Map<string, { sum: number; maxSum: number; count: number; grade: string; stream: string; subjectId: string; subjectName: string }>();
    scores.forEach((s: any) => {
      const learner = learnerById.get(s.learner_id);
      if (!learner) return;
      if (!learnerPoints.has(s.learner_id)) return; // qualified only
      const sub = subjectById.get(s.learning_area_id);
      if (!sub) return;
      const sc = Number(s.score) || 0;
      if (sc <= 0) return;
      const key = `${learner.grade}|${learner.stream}|${s.learning_area_id}`;
      const cur = map.get(key) || { sum: 0, maxSum: 0, count: 0, grade: learner.grade, stream: learner.stream, subjectId: s.learning_area_id, subjectName: sub.name };
      cur.sum += sc;
      cur.maxSum += Number(sub.max_score) || 100;
      cur.count += 1;
      map.set(key, cur);
    });
    return map;
  }, [scores, learnerById, subjectById, learnerPoints]);

  // ---------------- Report 1: Best Performed Subject per (grade,stream) ----------------
  const bestSubjectRows = useMemo(() => {
    type Row = { grade: string; stream: string; subject: string; meanPct: number; level: string; teacher: string };
    // group keys (grade|stream)
    const buckets = new Map<string, Map<string, { sum: number; maxSum: number; count: number; subjectId: string; subjectName: string }>>();
    subjectStreamAgg.forEach((v, k) => {
      const gk = `${v.grade}|${v.stream}`;
      let inner = buckets.get(gk);
      if (!inner) { inner = new Map(); buckets.set(gk, inner); }
      inner.set(v.subjectId, { sum: v.sum, maxSum: v.maxSum, count: v.count, subjectId: v.subjectId, subjectName: v.subjectName });
    });
    const rows: Row[] = [];
    buckets.forEach((subs, gk) => {
      const [grade, stream] = gk.split('|');
      let best: { name: string; subjectId: string; mean: number } | null = null;
      subs.forEach(s => {
        if (s.count === 0) return;
        const meanPct = s.maxSum > 0 ? (s.sum / s.maxSum) * 100 : 0;
        if (!best || meanPct > best.mean) best = { name: s.subjectName, subjectId: s.subjectId, mean: meanPct };
      });
      if (best) {
        const lvl = getPerfLevel(best.mean, 100);
        rows.push({
          grade, stream,
          subject: best.name,
          meanPct: best.mean,
          level: lvl,
          teacher: getSubjectTeacherName(teacherMap, grade, stream, best.subjectId),
        });
      }
    });
    rows.sort(bandSort);
    return rows;
  }, [subjectStreamAgg, teacherMap]);

  // ---------------- Report 2: Best Stream Overall (avg points across qualified learners) ----------------
  const bestStreamRows = useMemo(() => {
    type Row = { grade: string; stream: string; learners: number; meanPoints: number; level: string; position: number };
    const groups = new Map<string, { sum: number; count: number }>();
    filteredLearners.forEach((l: any) => {
      const lp = learnerPoints.get(l.id);
      if (!lp) return;
      const k = `${l.grade}|${l.stream}`;
      const cur = groups.get(k) || { sum: 0, count: 0 };
      cur.sum += lp.avgPoints;
      cur.count += 1;
      groups.set(k, cur);
    });
    const rows: Omit<Row, 'position'>[] = [];
    groups.forEach((v, k) => {
      const [grade, stream] = k.split('|');
      const meanPoints = v.count > 0 ? v.sum / v.count : 0;
      rows.push({ grade, stream, learners: v.count, meanPoints, level: meanPointsToLevel(meanPoints) });
    });
    rows.sort((a, b) => b.meanPoints - a.meanPoints);
    const ranked = rows.map((r, i) => ({ ...r, position: i + 1 }));
    // Now re-sort by band so classes appear grouped 1-3, 4-6, 7-9 (position kept)
    ranked.sort(bandSort);
    return ranked;
  }, [filteredLearners, learnerPoints]);

  // ---------------- Report 3: School Assessment Analysis (per grade+stream, per subject) ----------------
  const schoolAssessmentBlocks = useMemo(() => {
    type SubjRow = { subject: string; meanPct: number; level: string; teacher: string };
    type Block = { grade: string; stream: string; rows: SubjRow[]; totalPoints: number; avgPoints: number; overallLevel: string; learners: number };
    const blocksMap = new Map<string, Block>();
    subjectStreamAgg.forEach((v) => {
      const gk = `${v.grade}|${v.stream}`;
      let block = blocksMap.get(gk);
      if (!block) {
        block = { grade: v.grade, stream: v.stream, rows: [], totalPoints: 0, avgPoints: 0, overallLevel: '-', learners: 0 };
        blocksMap.set(gk, block);
      }
      const meanPct = v.maxSum > 0 ? (v.sum / v.maxSum) * 100 : 0;
      block.rows.push({
        subject: v.subjectName,
        meanPct,
        level: getPerfLevel(meanPct, 100),
        teacher: getSubjectTeacherName(teacherMap, v.grade, v.stream, v.subjectId),
      });
    });
    // overall per block: avg of qualified learners' avgPoints, learner count
    blocksMap.forEach((block) => {
      const ls = filteredLearners.filter((l: any) => l.grade === block.grade && l.stream === block.stream);
      let sum = 0; let cnt = 0; let totalPts = 0;
      ls.forEach((l: any) => {
        const lp = learnerPoints.get(l.id);
        if (lp) { sum += lp.avgPoints; totalPts += lp.totalPoints; cnt += 1; }
      });
      block.learners = cnt;
      block.avgPoints = cnt ? sum / cnt : 0;
      block.totalPoints = cnt ? totalPts / cnt : 0;
      block.overallLevel = cnt ? meanPointsToLevel(block.avgPoints) : '-';
      block.rows.sort((a, b) => a.subject.localeCompare(b.subject));
    });
    return Array.from(blocksMap.values()).sort(bandSort);
  }, [subjectStreamAgg, filteredLearners, learnerPoints, teacherMap]);

  // ---------------- Export helpers ----------------
  const exportTitle = (kind: ReportKind) => {
    const base = `${schoolName.toUpperCase()} — `;
    const tail = ` — TERM ${term} ${year} (${ASSESSMENT_TYPE_LABELS[assessment]})`;
    if (kind === 'best_subject') return `${base}BEST PERFORMED SUBJECT REPORT${tail}`;
    if (kind === 'best_stream') return `${base}BEST STREAM OVERALL REPORT${tail}`;
    return `${base}SCHOOL ASSESSMENT ANALYSIS${tail}`;
  };

  const writePdf = (kind: ReportKind) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const cx = doc.internal.pageSize.getWidth() / 2;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(exportTitle(kind), cx, 14, { align: 'center' });

    if (kind === 'best_subject') {
      autoTable(doc, {
        startY: 22,
        head: [['Grade', 'Stream', 'Best Subject', 'Mean %', 'Level', 'Subject Teacher']],
        body: bestSubjectRows.map(r => [r.grade, r.stream, r.subject, r.meanPct.toFixed(1), r.level, r.teacher]),
        styles: { fontSize: 9 },
      });
    } else if (kind === 'best_stream') {
      autoTable(doc, {
        startY: 22,
        head: [['Position', 'Grade', 'Stream', 'Learners', 'Mean Points', 'Overall Level']],
        body: bestStreamRows.map(r => [r.position, r.grade, r.stream, r.learners, r.meanPoints.toFixed(2), r.level]),
        styles: { fontSize: 9 },
      });
    } else {
      let y = 22;
      schoolAssessmentBlocks.forEach((b, idx) => {
        if (idx > 0) y = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Grade ${b.grade}${b.stream}  —  Learners: ${b.learners}`, 14, y);
        autoTable(doc, {
          startY: y + 2,
          head: [['Subject', 'Mean %', 'Level', 'Teacher']],
          body: [
            ...b.rows.map(r => [r.subject, r.meanPct.toFixed(1), r.level, r.teacher]),
            [{ content: 'Overall', styles: { fontStyle: 'bold' } }, { content: b.totalPoints.toFixed(2), styles: { fontStyle: 'bold' } }, { content: b.overallLevel, styles: { fontStyle: 'bold' } }, ''],
          ],
          styles: { fontSize: 9 },
        });
      });
    }

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated ${new Date().toLocaleString()} · Page ${i}/${pages}`, 14, doc.internal.pageSize.getHeight() - 6);
    }
    doc.save(`${kind}_T${term}_${year}.pdf`);
  };

  const writeExcel = (kind: ReportKind) => {
    const wb = XLSX.utils.book_new();
    const title = [exportTitle(kind)];
    let rows: any[][] = [];
    if (kind === 'best_subject') {
      rows = [['Grade', 'Stream', 'Best Subject', 'Mean %', 'Level', 'Subject Teacher'],
        ...bestSubjectRows.map(r => [r.grade, r.stream, r.subject, Number(r.meanPct.toFixed(1)), r.level, r.teacher])];
    } else if (kind === 'best_stream') {
      rows = [['Position', 'Grade', 'Stream', 'Learners', 'Mean Points', 'Overall Level'],
        ...bestStreamRows.map(r => [r.position, r.grade, r.stream, r.learners, Number(r.meanPoints.toFixed(2)), r.level])];
    } else {
      schoolAssessmentBlocks.forEach(b => {
        rows.push([`Grade ${b.grade}${b.stream}`, `Learners: ${b.learners}`]);
        rows.push(['Subject', 'Mean %', 'Level', 'Teacher']);
        b.rows.forEach(r => rows.push([r.subject, Number(r.meanPct.toFixed(1)), r.level, r.teacher]));
        rows.push(['Overall', Number(b.totalPoints.toFixed(2)), b.overallLevel, '']);
        rows.push([]);
      });
    }
    const ws = XLSX.utils.aoa_to_sheet([title, [], ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${kind}_T${term}_${year}.xlsx`);
  };

  const writeCsv = (kind: ReportKind) => {
    let rows: any[][] = [];
    if (kind === 'best_subject') {
      rows = [['Grade', 'Stream', 'Best Subject', 'Mean %', 'Level', 'Subject Teacher'],
        ...bestSubjectRows.map(r => [r.grade, r.stream, r.subject, r.meanPct.toFixed(1), r.level, r.teacher])];
    } else if (kind === 'best_stream') {
      rows = [['Position', 'Grade', 'Stream', 'Learners', 'Mean Points', 'Overall Level'],
        ...bestStreamRows.map(r => [r.position, r.grade, r.stream, r.learners, r.meanPoints.toFixed(2), r.level])];
    } else {
      rows.push(['Grade', 'Stream', 'Subject', 'Mean %', 'Level', 'Teacher']);
      schoolAssessmentBlocks.forEach(b => {
        b.rows.forEach(r => rows.push([b.grade, b.stream, r.subject, r.meanPct.toFixed(1), r.level, r.teacher]));
        rows.push([b.grade, b.stream, 'OVERALL', b.totalPoints.toFixed(2), b.overallLevel, '']);
      });
    }
    const csv = rows.map(r => r.map(v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${kind}_T${term}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const ExportBar = ({ kind }: { kind: ReportKind }) => (
    <div className="flex flex-wrap gap-2 no-print">
      <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
      <Button variant="outline" size="sm" onClick={() => writePdf(kind)}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
      <Button variant="outline" size="sm" onClick={() => writeExcel(kind)}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
      <Button variant="outline" size="sm" onClick={() => writeCsv(kind)}><FileDown className="mr-2 h-4 w-4" /> CSV</Button>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in pb-20 md:pb-0">
        <div className="flex items-center justify-between flex-wrap gap-4 no-print">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold">Consolidated Reports</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Best subject, best stream and full school assessment analysis</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 no-print sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Term</Label>
            <Select value={String(term)} onValueChange={(v) => setTerm(Number(v))}>
              <SelectTrigger className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[year - 1, year, year + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Assessment</Label>
            <Select value={assessment} onValueChange={(v) => setAssessment(v as AssessmentType)}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSESSMENT_TYPES.map(a => <SelectItem key={a} value={a}>{ASSESSMENT_TYPE_LABELS[a]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Grade</Label>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {dynamicGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ReportKind)}>
          <div className="overflow-x-auto -mx-2 px-2 no-print">
            <TabsList className="w-max">
              <TabsTrigger value="best_subject" className="text-xs sm:text-sm">Best Subject</TabsTrigger>
              <TabsTrigger value="best_stream" className="text-xs sm:text-sm">Best Stream</TabsTrigger>
              <TabsTrigger value="school_assessment" className="text-xs sm:text-sm">School Analysis</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="best_subject">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 sm:p-6">
                <CardTitle className="text-sm sm:text-base">Best Performed Subject (Per Class)</CardTitle>
                <ExportBar kind="best_subject" />
              </CardHeader>
              <CardContent className="p-2 sm:p-6 sm:pt-0 overflow-x-auto">
                <Table>

                  <TableHeader>
                    <TableRow>
                      <TableHead>Grade</TableHead>
                      <TableHead>Stream</TableHead>
                      <TableHead>Best Subject</TableHead>
                      <TableHead>Mean %</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Subject Teacher</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bestSubjectRows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No data for this selection.</TableCell></TableRow>
                    )}
                    {groupByBand(bestSubjectRows).map(band => (
                      <Fragment key={`bsg-${band.order}`}>
                        <TableRow className="bg-primary/10">
                          <TableCell colSpan={6} className="font-bold text-primary uppercase text-xs tracking-wide">{band.label}</TableCell>
                        </TableRow>
                        {band.rows.map((r, i) => (
                          <TableRow key={`${band.order}-${i}`}>
                            <TableCell>{r.grade}</TableCell>
                            <TableCell>{r.stream}</TableCell>
                            <TableCell className="font-medium">{r.subject}</TableCell>
                            <TableCell>{r.meanPct.toFixed(1)}</TableCell>
                            <TableCell>{r.level}</TableCell>
                            <TableCell>{r.teacher}</TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="best_stream">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 sm:p-6">
                <CardTitle className="text-sm sm:text-base">Best Stream Overall (By Mean Points)</CardTitle>
                <ExportBar kind="best_stream" />
              </CardHeader>
              <CardContent className="p-2 sm:p-6 sm:pt-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Stream</TableHead>
                      <TableHead>Learners</TableHead>
                      <TableHead>Mean Points</TableHead>
                      <TableHead>Overall Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bestStreamRows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No data for this selection.</TableCell></TableRow>
                    )}
                    {groupByBand(bestStreamRows).map(band => (
                      <Fragment key={`bsg-${band.order}`}>
                        <TableRow className="bg-primary/10">
                          <TableCell colSpan={6} className="font-bold text-primary uppercase text-xs tracking-wide">{band.label}</TableCell>
                        </TableRow>
                        {band.rows.map(r => (
                          <TableRow key={`${r.grade}|${r.stream}`}>
                            <TableCell className="font-bold">{r.position}</TableCell>
                            <TableCell>{r.grade}</TableCell>
                            <TableCell>{r.stream}</TableCell>
                            <TableCell>{r.learners}</TableCell>
                            <TableCell>{r.meanPoints.toFixed(2)}</TableCell>
                            <TableCell>{r.level}</TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="school_assessment">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 sm:p-6">
                <CardTitle className="text-sm sm:text-base">School Assessment Analysis</CardTitle>
                <ExportBar kind="school_assessment" />
              </CardHeader>
              <CardContent className="space-y-6 p-2 sm:p-6 sm:pt-0">
                {schoolAssessmentBlocks.length === 0 && (
                  <div className="text-center text-muted-foreground py-6">No data for this selection.</div>
                )}
                {groupByBand(schoolAssessmentBlocks).map(band => (
                  <div key={`saband-${band.order}`} className="space-y-4">
                    <div className="bg-primary/10 px-3 py-2 rounded font-bold text-primary uppercase text-xs tracking-wide">{band.label}</div>
                    {band.rows.map(b => (
                      <div key={`${b.grade}|${b.stream}`} className="space-y-2">
                        <div className="font-semibold text-sm sm:text-base">Grade {b.grade}{b.stream} <span className="text-muted-foreground font-normal">· {b.learners} learner{b.learners === 1 ? '' : 's'}</span></div>
                        <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Subject</TableHead>
                              <TableHead>Mean %</TableHead>
                              <TableHead>Level</TableHead>
                              <TableHead>Teacher</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {b.rows.map((r, i) => (
                              <TableRow key={i}>
                                <TableCell>{r.subject}</TableCell>
                                <TableCell>{r.meanPct.toFixed(1)}</TableCell>
                                <TableCell>{r.level}</TableCell>
                                <TableCell>{r.teacher}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-semibold bg-muted/40">
                              <TableCell>Overall (Mean Pts)</TableCell>
                              <TableCell>{b.totalPoints.toFixed(2)}</TableCell>
                              <TableCell>{b.overallLevel}</TableCell>
                              <TableCell />
                            </TableRow>
                          </TableBody>
                        </Table>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPaged } from '@/lib/fetch-all';
import { TERMS, ASSESSMENT_TYPE_LABELS, getPerfLevel } from '@/lib/cbc-utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { Navigate } from 'react-router-dom';

export default function TeacherDashboardPage() {
  const { user, role, schoolId } = useAuth();
  const [term, setTerm] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedAssignment, setSelectedAssignment] = useState<string>(''); // `${grade}|${stream}|${learning_area_id}`

  // RBAC: teachers only
  if (role && role !== 'teacher') return <Navigate to="/" replace />;

  // Assigned subjects (teacher_assignments) and class teacher rows
  const { data: assignments = [] } = useQuery({
    queryKey: ['td-assignments', user?.id, schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('teacher_assignments')
        .select('grade, stream, learning_area_id')
        .eq('teacher_id', user!.id)
        .eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!user?.id && !!schoolId,
  });

  const { data: classTeacherRows = [] } = useQuery({
    queryKey: ['td-class-teacher', user?.id, schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('class_teachers')
        .select('grade, stream')
        .eq('teacher_id', user!.id)
        .eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!user?.id && !!schoolId,
  });

  const { data: allSubjects = [] } = useQuery({
    queryKey: ['td-subjects', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('learning_areas')
        .select('id, name, grade, max_score')
        .eq('school_id', schoolId!)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!schoolId,
  });
  const subjectById = useMemo(() => new Map(allSubjects.map((s: any) => [s.id, s])), [allSubjects]);

  // Default-select first assignment
  useMemo(() => {
    if (!selectedAssignment && assignments.length) {
      const a: any = assignments[0];
      setSelectedAssignment(`${a.grade}|${a.stream}|${a.learning_area_id}`);
    }
  }, [assignments, selectedAssignment]);

  const [aGrade, aStream, aSubjectId] = selectedAssignment.split('|');
  const aSubject: any = aSubjectId ? subjectById.get(aSubjectId) : null;

  // Learners in selected (grade, stream)
  const { data: learners = [] } = useQuery({
    queryKey: ['td-learners', aGrade, aStream, schoolId],
    queryFn: () =>
      fetchAllPaged(() =>
        supabase.from('learners').select('id, full_name, grade, stream')
          .eq('school_id', schoolId!).eq('is_active', true)
          .eq('grade', aGrade).eq('stream', aStream)),
    enabled: !!aGrade && !!aStream && !!schoolId,
  });

  // All scores for this subject + grade/stream learners across opener/mid/end of selected term/year
  const learnerIds = learners.map((l: any) => l.id);
  const { data: scores = [] } = useQuery({
    queryKey: ['td-scores', aSubjectId, learnerIds, term, year],
    queryFn: async () => {
      if (!aSubjectId || !learnerIds.length) return [];
      const CHUNK = 200;
      const all: any[] = [];
      for (let i = 0; i < learnerIds.length; i += CHUNK) {
        const slice = learnerIds.slice(i, i + CHUNK);
        const rows = await fetchAllPaged(() =>
          supabase.from('scores')
            .select('learner_id, score, assessment_type, term, year')
            .in('learner_id', slice)
            .eq('learning_area_id', aSubjectId!)
            .eq('term', term).eq('year', year)
            .in('assessment_type', ['opener', 'mid_term', 'end_term']));
        all.push(...rows);
      }
      return all;
    },
    enabled: !!aSubjectId && learnerIds.length > 0,
  });

  // Per-learner snapshot for end_term (used for top/bottom)
  const learnerEndTerm = useMemo(() => {
    return learners
      .map((l: any) => {
        const sc = scores.find((s: any) => s.learner_id === l.id && s.assessment_type === 'end_term');
        const score = sc ? Number(sc.score) || 0 : 0;
        const max = aSubject?.max_score || 100;
        const pct = max ? (score / max) * 100 : 0;
        return { id: l.id, full_name: l.full_name, score, max, pct, level: sc ? getPerfLevel(score, max) : '-' };
      })
      .filter(l => l.score > 0)
      .sort((a, b) => b.pct - a.pct);
  }, [learners, scores, aSubject]);

  const top5 = learnerEndTerm.slice(0, 5);
  const bottom5 = [...learnerEndTerm].reverse().slice(0, 5);

  // Term progression: mean % per assessment for the chosen subject
  const trendData = useMemo(() => {
    const max = aSubject?.max_score || 100;
    const groups: Record<string, number[]> = { opener: [], mid_term: [], end_term: [] };
    scores.forEach((s: any) => {
      const score = Number(s.score) || 0;
      if (score > 0) groups[s.assessment_type]?.push((score / max) * 100);
    });
    return (['opener', 'mid_term', 'end_term'] as const).map(at => ({
      name: ASSESSMENT_TYPE_LABELS[at],
      mean: groups[at].length ? groups[at].reduce((a, b) => a + b, 0) / groups[at].length : 0,
    }));
  }, [scores, aSubject]);

  const subjectMean = useMemo(() => {
    const vals = learnerEndTerm.map(l => l.pct);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [learnerEndTerm]);

  // Distribution of levels (end_term)
  const levelDist = useMemo(() => {
    const levels = ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'];
    const counts: Record<string, number> = Object.fromEntries(levels.map(l => [l, 0]));
    learnerEndTerm.forEach(l => { if (l.level !== '-') counts[l.level] = (counts[l.level] || 0) + 1; });
    return levels.map(l => ({ level: l, count: counts[l] }));
  }, [learnerEndTerm]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">My Teaching Dashboard</h1>
          <p className="text-muted-foreground">Performance for the classes and subjects you teach</p>
        </div>

        {/* Assigned classes summary */}
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Subject Assignments</CardTitle></CardHeader>
            <CardContent>
              {assignments.length === 0 && <div className="text-sm text-muted-foreground">No subject assignments yet.</div>}
              <div className="flex flex-wrap gap-2">
                {assignments.map((a: any, i) => {
                  const s: any = subjectById.get(a.learning_area_id);
                  return <Badge key={i} variant="secondary">G{a.grade}{a.stream} · {s?.name || '—'}</Badge>;
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Class Teacher Of</CardTitle></CardHeader>
            <CardContent>
              {classTeacherRows.length === 0 && <div className="text-sm text-muted-foreground">Not a class teacher yet.</div>}
              <div className="flex flex-wrap gap-2">
                {classTeacherRows.map((c: any, i) => (
                  <Badge key={i} variant="outline">G{c.grade}{c.stream}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <Label className="text-xs">Assignment</Label>
            <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="Pick an assignment" /></SelectTrigger>
              <SelectContent>
                {assignments.map((a: any, i) => {
                  const s: any = subjectById.get(a.learning_area_id);
                  const v = `${a.grade}|${a.stream}|${a.learning_area_id}`;
                  return <SelectItem key={i} value={v}>G{a.grade}{a.stream} · {s?.name || '—'}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Term</Label>
            <Select value={String(term)} onValueChange={v => setTerm(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{[year - 1, year, year + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {selectedAssignment && (
          <>
            {/* KPI cards */}
            <div className="grid gap-3 md:grid-cols-3">
              <Card><CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Subject</div>
                <div className="text-lg font-semibold">{aSubject?.name || '—'}</div>
                <div className="text-xs text-muted-foreground">G{aGrade}{aStream}</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Subject Mean (End-Term %)</div>
                <div className="text-2xl font-bold">{subjectMean.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">{learnerEndTerm.length} learners scored</div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Class Size</div>
                <div className="text-2xl font-bold">{learners.length}</div>
              </CardContent></Card>
            </div>

            {/* Trend chart */}
            <Card>
              <CardHeader><CardTitle className="text-base">Term Progression — {aSubject?.name}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="mean" name="Mean %" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribution */}
            <Card>
              <CardHeader><CardTitle className="text-base">Performance Level Distribution (End-Term)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={levelDist}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="level" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top / Bottom */}
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Top 5 Learners</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Learner</TableHead><TableHead>Score</TableHead><TableHead>Level</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {top5.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No scores yet</TableCell></TableRow>}
                      {top5.map((l, i) => (
                        <TableRow key={l.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{l.full_name}</TableCell>
                          <TableCell>{l.score}/{l.max} ({l.pct.toFixed(1)}%)</TableCell>
                          <TableCell>{l.level}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Bottom 5 Learners</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Learner</TableHead><TableHead>Score</TableHead><TableHead>Level</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {bottom5.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No scores yet</TableCell></TableRow>}
                      {bottom5.map((l, i) => (
                        <TableRow key={l.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{l.full_name}</TableCell>
                          <TableCell>{l.score}/{l.max} ({l.pct.toFixed(1)}%)</TableCell>
                          <TableCell>{l.level}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

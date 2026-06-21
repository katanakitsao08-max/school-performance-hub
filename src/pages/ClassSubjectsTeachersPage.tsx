import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ArrowLeft, BookOpen, Wand2 } from 'lucide-react';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useSchoolStreams } from '@/hooks/use-school-streams';

interface AssignmentRow {
  teacher_id: string;
  grade: string;
  stream: string;
  learning_area_id: string;
}
interface LARow { id: string; name: string; grade: string }
interface ProfileRow { user_id: string; full_name: string }
interface CTRow { teacher_id: string; grade: string; stream: string }

interface SubjectLine {
  learning_area_id: string;
  subject: string;
  teachers: string[];
  lessonsPerWeek?: number;
}

export default function ClassSubjectsTeachersPage() {
  const { schoolId } = useAuth();
  const grades = useSchoolGrades();
  const streams = useSchoolStreams();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [areas, setAreas] = useState<LARow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [classTeachers, setClassTeachers] = useState<CTRow[]>([]);
  const [allocs, setAllocs] = useState<Array<{ grade: string; learning_area_id: string; lessons_per_week: number }>>([]);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const issueGrade = searchParams.get('grade') || '';
  const issueStream = searchParams.get('stream') || '';
  const issueSubject = searchParams.get('subject') || '';
  const hasIssueContext = !!(issueGrade || issueStream || issueSubject);

  useEffect(() => {
    if (hasIssueContext && !search) {
      const term = [issueGrade, issueStream, issueSubject].filter(Boolean).join(' ');
      setSearch(term);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasIssueContext]);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const [{ data: ta }, { data: la }, { data: ct }, { data: gsl }] = await Promise.all([
        supabase.from('teacher_assignments').select('teacher_id, grade, stream, learning_area_id').eq('school_id', schoolId),
        supabase.from('learning_areas').select('id, name, grade').eq('school_id', schoolId).eq('is_active', true),
        supabase.from('class_teachers').select('teacher_id, grade, stream').eq('school_id', schoolId),
        supabase.from('grade_subject_lessons').select('grade, learning_area_id, lessons_per_week').eq('school_id', schoolId),
      ]);
      const rows = ((ta as any) || []) as AssignmentRow[];
      setAssignments(rows);
      setAreas(((la as any) || []) as LARow[]);
      setClassTeachers(((ct as any) || []) as CTRow[]);
      setAllocs(((gsl as any) || []));
      const ids = Array.from(new Set([
        ...rows.map(r => r.teacher_id),
        ...(((ct as any) || []) as CTRow[]).map(r => r.teacher_id),
      ]));
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
        setProfiles(((profs as any) || []) as ProfileRow[]);
      }
      setLoading(false);
    })();
  }, [schoolId]);

  const nameOf = (uid: string) => profiles.find(p => p.user_id === uid)?.full_name || 'Teacher';
  const areaName = (id: string) => areas.find(a => a.id === id)?.name || '—';

  // Build classes from assignments + streams
  const classes = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach(a => set.add(`${a.grade}|${a.stream || ''}`));
    classTeachers.forEach(c => set.add(`${c.grade}|${c.stream || ''}`));
    return Array.from(set)
      .map(k => { const [g, s] = k.split('|'); return { grade: g, stream: s }; })
      .sort((a, b) => (a.grade + a.stream).localeCompare(b.grade + b.stream));
  }, [assignments, classTeachers]);

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(c => {
      if (`${c.grade} ${c.stream}`.toLowerCase().includes(q)) return true;
      const subs = assignments.filter(a => a.grade === c.grade && a.stream === c.stream);
      return subs.some(a => areaName(a.learning_area_id).toLowerCase().includes(q)
        || nameOf(a.teacher_id).toLowerCase().includes(q));
    });
  }, [classes, search, assignments, areas, profiles]);

  const subjectsForClass = (grade: string, stream: string): SubjectLine[] => {
    const rows = assignments.filter(a => a.grade === grade && a.stream === stream);
    const byArea = new Map<string, Set<string>>();
    rows.forEach(r => {
      if (!byArea.has(r.learning_area_id)) byArea.set(r.learning_area_id, new Set());
      byArea.get(r.learning_area_id)!.add(r.teacher_id);
    });
    return Array.from(byArea.entries()).map(([laId, tIds]) => {
      const lpw = allocs.find(x => x.grade === grade && x.learning_area_id === laId)?.lessons_per_week;
      return {
        learning_area_id: laId,
        subject: areaName(laId),
        teachers: Array.from(tIds).map(nameOf).sort(),
        lessonsPerWeek: lpw,
      };
    }).sort((a, b) => a.subject.localeCompare(b.subject));
  };

  const classTeacherFor = (grade: string, stream: string) => {
    const ct = classTeachers.find(c => c.grade === grade && c.stream === stream);
    return ct ? nameOf(ct.teacher_id) : null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" /> Subjects & Teachers per Class
            </h1>
            <p className="text-sm text-muted-foreground">Read-only view of every class's subjects, assigned teachers and weekly lessons.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/timetable"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Timetable</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-3">
            <div className="relative max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by class, subject, or teacher…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Loading…</p>
        ) : filteredClasses.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            No classes with assignments yet. Add subjects under <Link to="/teacher-assignments" className="underline text-primary">Teacher Assignments</Link>.
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredClasses.map(c => {
              const subs = subjectsForClass(c.grade, c.stream);
              const ct = classTeacherFor(c.grade, c.stream);
              const totalLpw = subs.reduce((sum, s) => sum + (s.lessonsPerWeek || 0), 0);
              return (
                <Card key={`${c.grade}|${c.stream}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">Grade {c.grade} {c.stream}</CardTitle>
                        <CardDescription>
                          {ct ? <>Class Teacher: <span className="font-medium text-foreground">{ct}</span></> : 'No class teacher assigned'}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="secondary">{subs.length} subjects</Badge>
                        {totalLpw > 0 && <Badge variant="outline">{totalLpw} lessons/wk</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {subs.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No subject teachers assigned.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8">Subject</TableHead>
                            <TableHead className="h-8">Teacher(s)</TableHead>
                            <TableHead className="h-8 text-center w-16">Lessons/wk</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subs.map(s => (
                            <TableRow key={s.learning_area_id}>
                              <TableCell className="py-2 font-medium">{s.subject}</TableCell>
                              <TableCell className="py-2 text-sm">
                                {s.teachers.length === 0 ? <span className="text-muted-foreground italic">Unassigned</span>
                                  : s.teachers.map(t => <div key={t}>{t}</div>)}
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                {s.lessonsPerWeek ?? <span className="text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

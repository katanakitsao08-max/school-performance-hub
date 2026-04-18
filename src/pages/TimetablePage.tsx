import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Lock, Unlock, Sparkles, Download, AlertTriangle, Layers } from 'lucide-react';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useSchoolStreams } from '@/hooks/use-school-streams';
import {
  generateTimetable, type SubjectRequirement, type TeacherAssignmentRow, type TimetableSlot,
} from '@/lib/timetable-engine';
import { exportTimetablePdf } from '@/lib/timetable-pdf';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function TimetablePage() {
  const { schoolId, user } = useAuth();
  const grades = useSchoolGrades();
  const streams = useSchoolStreams();

  const [activated, setActivated] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [schoolName, setSchoolName] = useState('');

  // generator state
  const [grade, setGrade] = useState('');
  const [stream, setStream] = useState('');
  const [periodsPerDay, setPeriodsPerDay] = useState(8);
  const [breakPeriod, setBreakPeriod] = useState<number>(4);
  const [requirements, setRequirements] = useState<SubjectRequirement[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignmentRow[]>([]);
  const [result, setResult] = useState<ReturnType<typeof generateTimetable> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchClasses, setBatchClasses] = useState<{ grade: string; stream: string }[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);

  // Check activation status
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const [{ data: keyRow }, { data: school }] = await Promise.all([
        supabase
          .from('timetable_activation_keys')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_revoked', false)
          .not('activated_at', 'is', null)
          .order('activated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('schools').select('school_name').eq('id', schoolId).maybeSingle(),
      ]);
      const valid = keyRow && (!keyRow.expires_at || new Date(keyRow.expires_at) > new Date());
      setActivated(!!valid);
      setSchoolName(school?.school_name || 'School');
    })();
  }, [schoolId]);

  // Load assignments + learning areas when class chosen
  useEffect(() => {
    if (!schoolId || !grade) return;
    (async () => {
      const [{ data: la }, { data: ta }] = await Promise.all([
        supabase.from('learning_areas').select('id, name').eq('school_id', schoolId).eq('grade', grade).eq('is_active', true),
        supabase
          .from('teacher_assignments')
          .select('teacher_id, learning_area_id, grade, stream, profiles!inner(full_name)')
          .eq('school_id', schoolId)
          .eq('grade', grade),
      ]);
      const las = (la || []) as { id: string; name: string }[];
      setRequirements(las.map(l => ({ learningAreaId: l.id, learningAreaName: l.name, lessonsPerWeek: 5 })));
      const rows: TeacherAssignmentRow[] = ((ta as any) || []).map((r: any) => ({
        teacher_id: r.teacher_id,
        teacher_name: r.profiles?.full_name || 'Teacher',
        learning_area_id: r.learning_area_id,
        grade: r.grade,
        stream: r.stream,
      }));
      setAssignments(rows);
    })();
  }, [schoolId, grade]);

  const activate = async () => {
    if (!keyInput.trim() || !schoolId || !user) return;
    setActivating(true);
    const { data: row, error } = await supabase
      .from('timetable_activation_keys')
      .select('*')
      .eq('activation_key', keyInput.trim())
      .eq('school_id', schoolId)
      .eq('is_revoked', false)
      .maybeSingle();
    if (error || !row) {
      setActivating(false);
      return toast({ title: 'Invalid key', description: 'Key not found or not assigned to this school.', variant: 'destructive' });
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      setActivating(false);
      return toast({ title: 'Expired key', variant: 'destructive' });
    }
    const { error: upErr } = await supabase
      .from('timetable_activation_keys')
      .update({ activated_at: new Date().toISOString(), activated_by: user.id })
      .eq('id', row.id);
    setActivating(false);
    if (upErr) return toast({ title: 'Failed', description: upErr.message, variant: 'destructive' });
    toast({ title: 'Timetable Generator activated!' });
    setActivated(true);
  };

  const updateReq = (i: number, val: number) => {
    setRequirements(prev => prev.map((r, idx) => idx === i ? { ...r, lessonsPerWeek: val } : r));
  };

  const generate = () => {
    if (!grade || !stream) return toast({ title: 'Select grade and stream' });
    if (assignments.length === 0) return toast({ title: 'No teacher assignments found', description: 'Assign teachers to subjects first.', variant: 'destructive' });
    setGenerating(true);
    setBatchMode(false);
    const reqMap: Record<string, SubjectRequirement[]> = {};
    reqMap[`${grade}|${stream}`] = requirements.filter(r => r.lessonsPerWeek > 0);
    const r = generateTimetable({
      classes: [{ grade, stream }],
      days: DAYS,
      periodsPerDay,
      breakPeriod,
      requirementsByClass: reqMap,
      assignments: assignments.filter(a => a.stream === stream),
    });
    setResult(r);
    setGenerating(false);
    if (r.unfilled.length === 0 && r.conflicts.length === 0) {
      toast({ title: 'Timetable generated', description: 'No conflicts detected.' });
    } else {
      toast({ title: 'Generated with warnings', description: `${r.conflicts.length} conflicts, ${r.unfilled.length} unfilled.` });
    }
  };

  const generateAllClasses = async () => {
    if (!schoolId) return;
    setGenerating(true);
    setBatchMode(true);
    setResult(null);
    try {
      // 1. Discover every (grade, stream) that has at least one teacher assignment
      const { data: ta, error: taErr } = await supabase
        .from('teacher_assignments')
        .select('teacher_id, learning_area_id, grade, stream, profiles!inner(full_name)')
        .eq('school_id', schoolId);
      if (taErr) throw taErr;
      const allAssignments: TeacherAssignmentRow[] = ((ta as any) || []).map((r: any) => ({
        teacher_id: r.teacher_id,
        teacher_name: r.profiles?.full_name || 'Teacher',
        learning_area_id: r.learning_area_id,
        grade: r.grade,
        stream: r.stream,
      }));
      if (allAssignments.length === 0) {
        toast({ title: 'No teacher assignments', description: 'Assign teachers to subjects first.', variant: 'destructive' });
        return;
      }
      const classSet = new Map<string, { grade: string; stream: string }>();
      allAssignments.forEach(a => classSet.set(`${a.grade}|${a.stream}`, { grade: a.grade, stream: a.stream }));
      const classList = Array.from(classSet.values());

      // 2. Load learning areas for every grade involved
      const grades = Array.from(new Set(classList.map(c => c.grade)));
      const { data: la, error: laErr } = await supabase
        .from('learning_areas')
        .select('id, name, grade')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .in('grade', grades);
      if (laErr) throw laErr;
      const areasByGrade: Record<string, { id: string; name: string }[]> = {};
      ((la as any) || []).forEach((l: any) => {
        if (!areasByGrade[l.grade]) areasByGrade[l.grade] = [];
        areasByGrade[l.grade].push({ id: l.id, name: l.name });
      });

      // 3. Build per-class requirements (default 5 lessons/week per subject)
      const reqMap: Record<string, SubjectRequirement[]> = {};
      classList.forEach(c => {
        const areas = areasByGrade[c.grade] || [];
        reqMap[`${c.grade}|${c.stream}`] = areas.map(a => ({
          learningAreaId: a.id, learningAreaName: a.name, lessonsPerWeek: 5,
        }));
      });

      // 4. Single engine run — shared teacherBusy prevents cross-class double-booking
      const r = generateTimetable({
        classes: classList,
        days: DAYS,
        periodsPerDay,
        breakPeriod,
        requirementsByClass: reqMap,
        assignments: allAssignments,
      });
      setResult(r);
      setBatchClasses(classList);
      toast({
        title: `Batch complete: ${classList.length} classes`,
        description: `${r.conflicts.length} conflicts, ${r.unfilled.length} unfilled.`,
      });
    } catch (e: any) {
      toast({ title: 'Batch failed', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const saveBatch = async () => {
    if (!result || !schoolId || !user || !batchMode) return;
    setSavingBatch(true);
    const rows = batchClasses.map(c => ({
      school_id: schoolId,
      name: `${c.grade} ${c.stream} Timetable`,
      grade: c.grade, stream: c.stream,
      days: DAYS,
      periods_per_day: periodsPerDay,
      break_period: breakPeriod,
      data: result.grids[`${c.grade}|${c.stream}`] as any,
      generated_by: user.id,
    }));
    const { error } = await supabase.from('timetables').insert(rows);
    setSavingBatch(false);
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    toast({ title: `Saved ${rows.length} timetables` });
  };

  const save = async () => {
    if (!result || !schoolId || !user) return;
    const ck = `${grade}|${stream}`;
    const { error } = await supabase.from('timetables').insert({
      school_id: schoolId,
      name: `${grade} ${stream} Timetable`,
      grade, stream,
      days: DAYS,
      periods_per_day: periodsPerDay,
      break_period: breakPeriod,
      data: result.grids[ck] as any,
      generated_by: user.id,
    });
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Timetable saved' });
  };

  const downloadClass = () => {
    if (!result) return;
    exportTimetablePdf({
      schoolName,
      title: `Class Timetable — ${grade} ${stream}`,
      days: DAYS, periodsPerDay, breakPeriod,
      grid: result.grids[`${grade}|${stream}`],
      showTeacher: true,
    });
  };

  const downloadTeacher = (teacherId: string) => {
    if (!result) return;
    const t = result.teacherGrids[teacherId];
    exportTimetablePdf({
      schoolName,
      title: `Teacher Timetable — ${t.teacherName}`,
      days: DAYS, periodsPerDay, breakPeriod,
      grid: t.grid,
    });
  };

  const classGrid = result?.grids[`${grade}|${stream}`];

  // ---- LOCKED VIEW ----
  if (activated === false) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Timetable Generator Locked</CardTitle>
              <CardDescription>Enter your school activation key to unlock automatic timetable generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Activation required</AlertTitle>
                <AlertDescription>Contact your platform administrator to receive your school's activation key.</AlertDescription>
              </Alert>
              <Label>Activation Key</Label>
              <Input value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="TT-XXXX-XXXX-XXXX" className="font-mono" />
              <Button onClick={activate} disabled={activating || !keyInput.trim()} className="w-full">
                <Unlock className="h-4 w-4 mr-2" />
                {activating ? 'Activating…' : 'Activate'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (activated === null) {
    return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Loading…</div></DashboardLayout>;
  }

  // ---- UNLOCKED ----
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Timetable Generator</h1>
            <p className="text-muted-foreground">ASC-style auto scheduling. Teachers are auto-selected from subject assignments.</p>
          </div>
          <Badge className="bg-primary"><Unlock className="h-3 w-3 mr-1" /> Activated</Badge>
        </div>

        <Card>
          <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
                <SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stream</Label>
              <Select value={stream} onValueChange={setStream}>
                <SelectTrigger><SelectValue placeholder="Stream" /></SelectTrigger>
                <SelectContent>{streams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Periods / day</Label>
              <Input type="number" min={4} max={12} value={periodsPerDay} onChange={e => setPeriodsPerDay(Math.max(4, Math.min(12, Number(e.target.value) || 8)))} />
            </div>
            <div>
              <Label>Break period</Label>
              <Input type="number" min={1} max={periodsPerDay} value={breakPeriod} onChange={e => setBreakPeriod(Math.max(1, Math.min(periodsPerDay, Number(e.target.value) || 4)))} />
            </div>
          </CardContent>
        </Card>

        {requirements.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Lessons per week</CardTitle><CardDescription>Set how many periods each subject needs.</CardDescription></CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {requirements.map((r, i) => (
                  <div key={r.learningAreaId} className="flex items-center gap-2">
                    <Label className="flex-1 text-sm">{r.learningAreaName}</Label>
                    <Input type="number" min={0} max={20} value={r.lessonsPerWeek} onChange={e => updateReq(i, Number(e.target.value) || 0)} className="w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={generating || !grade || !stream}>
            <Sparkles className="h-4 w-4 mr-2" />
            {generating && !batchMode ? 'Generating…' : 'Generate (Single Class)'}
          </Button>
          <Button variant="secondary" onClick={generateAllClasses} disabled={generating}>
            <Layers className="h-4 w-4 mr-2" />
            {generating && batchMode ? 'Generating all…' : 'Generate ALL Classes'}
          </Button>
          {result && !batchMode && (
            <>
              <Button variant="outline" onClick={save}>Save</Button>
              <Button variant="outline" onClick={downloadClass}><Download className="h-4 w-4 mr-2" />Class PDF</Button>
            </>
          )}
          {result && batchMode && (
            <Button variant="outline" onClick={saveBatch} disabled={savingBatch}>
              {savingBatch ? 'Saving…' : `Save All (${batchClasses.length})`}
            </Button>
          )}
        </div>

        {result && (result.conflicts.length > 0 || result.unfilled.length > 0) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scheduling warnings</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 text-xs space-y-0.5">
                {result.conflicts.map((c, i) => <li key={`c${i}`}>{c}</li>)}
                {result.unfilled.map((u, i) => <li key={`u${i}`}>{u}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {classGrid && (
          <Tabs defaultValue="class">
            <TabsList>
              <TabsTrigger value="class">Class View</TabsTrigger>
              <TabsTrigger value="teachers">Teacher Views</TabsTrigger>
            </TabsList>
            <TabsContent value="class">
              <Card><CardContent className="p-0 overflow-x-auto">
                <GridTable grid={classGrid} days={DAYS} periodsPerDay={periodsPerDay} breakPeriod={breakPeriod} showTeacher />
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="teachers" className="space-y-4">
              {Object.entries(result!.teacherGrids).map(([tid, t]) => (
                <Card key={tid}>
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-base">{t.teacherName}</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => downloadTeacher(tid)}>
                      <Download className="h-3 w-3 mr-1" /> PDF
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <GridTable grid={t.grid} days={DAYS} periodsPerDay={periodsPerDay} breakPeriod={breakPeriod} />
                  </CardContent>
                </Card>
              ))}
              {Object.keys(result!.teacherGrids).length === 0 && (
                <p className="text-sm text-muted-foreground p-4">No teacher schedules yet.</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

function GridTable({ grid, days, periodsPerDay, breakPeriod, showTeacher }: {
  grid: TimetableSlot[][]; days: string[]; periodsPerDay: number; breakPeriod?: number; showTeacher?: boolean;
}) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-muted">
          <th className="border p-2 text-left">Day</th>
          {Array.from({ length: periodsPerDay }, (_, i) => (
            <th key={i} className={`border p-2 ${breakPeriod === i + 1 ? 'bg-muted-foreground/20' : ''}`}>
              {breakPeriod === i + 1 ? 'BREAK' : `P${i + 1}`}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {days.map((d, di) => (
          <tr key={d}>
            <td className="border p-2 font-semibold bg-muted/50">{d}</td>
            {Array.from({ length: periodsPerDay }, (_, p) => {
              const cell = grid[di]?.[p];
              if (cell?.isBreak) return <td key={p} className="border p-2 text-center bg-muted/40 text-muted-foreground">BREAK</td>;
              if (cell?.learningAreaName) {
                return (
                  <td key={p} className="border p-2 text-center">
                    <div className="font-medium">{cell.learningAreaName}</div>
                    {showTeacher && cell.teacherName && <div className="text-[10px] text-muted-foreground">{cell.teacherName}</div>}
                  </td>
                );
              }
              return <td key={p} className="border p-2 text-center text-muted-foreground">—</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

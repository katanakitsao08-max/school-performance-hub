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
import { Lock, Unlock, Sparkles, Download, AlertTriangle, Layers, FileSpreadsheet, Search, Plus, X } from 'lucide-react';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useSchoolStreams } from '@/hooks/use-school-streams';
import { getGradeLevel, type SchoolLevel } from '@/lib/grade-levels';
import {
  generateTimetable, type SubjectRequirement, type TeacherAssignmentRow, type TimetableSlot, type LockedSlot,
} from '@/lib/timetable-engine';
import { exportTimetablePdf } from '@/lib/timetable-pdf';
import { exportTimetableExcel, exportTimetableExcelMulti } from '@/lib/timetable-excel';
import { exportTimetableSummaryPdf } from '@/lib/timetable-summary-pdf';
import { SummaryAllClassesView } from '@/components/SummaryAllClassesView';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Block filters: maps a "block" to grade-level filter
const BLOCKS = [
  { id: 'all', label: 'All Levels', match: (_g: string) => true },
  { id: 'lower', label: 'Lower Primary (1-3)', match: (g: string) => { const n = parseInt(g, 10); return !isNaN(n) && n >= 1 && n <= 3; } },
  { id: 'upper', label: 'Upper Primary (4-6)', match: (g: string) => { const n = parseInt(g, 10); return !isNaN(n) && n >= 4 && n <= 6; } },
  { id: 'junior', label: 'Junior School (7-9)', match: (g: string) => { const n = parseInt(g, 10); return !isNaN(n) && n >= 7 && n <= 9; } },
] as const;

export default function TimetablePage() {
  const { schoolId, user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'super_admin';
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
  const [breakInput, setBreakInput] = useState('3,6'); // comma-separated period numbers (two breaks)
  const [requirements, setRequirements] = useState<SubjectRequirement[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignmentRow[]>([]);
  const [result, setResult] = useState<ReturnType<typeof generateTimetable> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchClasses, setBatchClasses] = useState<{ grade: string; stream: string }[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [blockFilter, setBlockFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lockedSlots, setLockedSlots] = useState<LockedSlot[]>([]);
  const [newLock, setNewLock] = useState({ day: 'Monday', period: 1, label: 'Assembly' });

  const breakPeriods = useMemo(() => {
    return breakInput
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= periodsPerDay);
  }, [breakInput, periodsPerDay]);

  // Check activation
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

  // Load assignments + learning areas
  useEffect(() => {
    if (!schoolId || !grade) return;
    (async () => {
      const [{ data: la }, { data: ta }] = await Promise.all([
        supabase.from('learning_areas').select('id, name').eq('school_id', schoolId).eq('grade', grade).eq('is_active', true),
        supabase
          .from('teacher_assignments')
          .select('teacher_id, learning_area_id, grade, stream')
          .eq('school_id', schoolId)
          .eq('grade', grade),
      ]);
      const las = (la || []) as { id: string; name: string }[];
      setRequirements(las.map(l => ({ learningAreaId: l.id, learningAreaName: l.name, lessonsPerWeek: 5 })));
      const taRows = ((ta as any) || []) as any[];
      const teacherIds = Array.from(new Set(taRows.map(r => r.teacher_id)));
      const nameMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', teacherIds);
        (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
      }
      const rows: TeacherAssignmentRow[] = taRows.map((r: any) => ({
        teacher_id: r.teacher_id,
        teacher_name: nameMap[r.teacher_id] || 'Teacher',
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

  const addLock = () => {
    setLockedSlots(prev => [...prev, { classKey: '*', day: newLock.day, period: newLock.period, label: newLock.label || 'Locked' }]);
  };
  const removeLock = (i: number) => setLockedSlots(prev => prev.filter((_, idx) => idx !== i));

  const generate = () => {
    if (!grade) return toast({ title: 'Select a grade', variant: 'destructive' });
    if (!stream) return toast({ title: 'Select a stream', variant: 'destructive' });
    if (assignments.length === 0) {
      return toast({
        title: 'No teacher assignments for this grade',
        description: `Go to Teacher Assignments and assign teachers to subjects in Grade ${grade}.`,
        variant: 'destructive',
      });
    }
    const streamAssignments = assignments.filter(a => a.stream === stream);
    if (streamAssignments.length === 0) {
      const availableStreams = Array.from(new Set(assignments.map(a => a.stream))).join(', ');
      return toast({
        title: `No teachers assigned to Grade ${grade} ${stream}`,
        description: `Available streams with assignments: ${availableStreams || 'none'}.`,
        variant: 'destructive',
      });
    }
    setGenerating(true);
    setBatchMode(false);
    const reqMap: Record<string, SubjectRequirement[]> = {};
    reqMap[`${grade}|${stream}`] = requirements.filter(r => r.lessonsPerWeek > 0);
    const r = generateTimetable({
      classes: [{ grade, stream }],
      days: DAYS,
      periodsPerDay,
      breakPeriods,
      lockedSlots,
      requirementsByClass: reqMap,
      assignments: streamAssignments,
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
      const { data: ta, error: taErr } = await supabase
        .from('teacher_assignments')
        .select('teacher_id, learning_area_id, grade, stream')
        .eq('school_id', schoolId);
      if (taErr) throw taErr;
      const taRows = ((ta as any) || []) as any[];
      const teacherIds = Array.from(new Set(taRows.map(r => r.teacher_id)));
      const nameMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', teacherIds);
        (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
      }
      const blockMatcher = BLOCKS.find(b => b.id === blockFilter)!.match;
      const allAssignments: TeacherAssignmentRow[] = taRows
        .filter((r: any) => blockMatcher(r.grade))
        .map((r: any) => ({
          teacher_id: r.teacher_id,
          teacher_name: nameMap[r.teacher_id] || 'Teacher',
          learning_area_id: r.learning_area_id,
          grade: r.grade,
          stream: r.stream,
        }));
      if (allAssignments.length === 0) {
        toast({ title: 'No teacher assignments in this block', description: 'Try a different block or assign teachers first.', variant: 'destructive' });
        setGenerating(false);
        return;
      }
      const classSet = new Map<string, { grade: string; stream: string }>();
      allAssignments.forEach(a => classSet.set(`${a.grade}|${a.stream}`, { grade: a.grade, stream: a.stream }));
      const classList = Array.from(classSet.values());

      const gradesIn = Array.from(new Set(classList.map(c => c.grade)));
      const { data: la, error: laErr } = await supabase
        .from('learning_areas')
        .select('id, name, grade')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .in('grade', gradesIn);
      if (laErr) throw laErr;
      const areasByGrade: Record<string, { id: string; name: string }[]> = {};
      ((la as any) || []).forEach((l: any) => {
        if (!areasByGrade[l.grade]) areasByGrade[l.grade] = [];
        areasByGrade[l.grade].push({ id: l.id, name: l.name });
      });

      const reqMap: Record<string, SubjectRequirement[]> = {};
      classList.forEach(c => {
        const areas = areasByGrade[c.grade] || [];
        reqMap[`${c.grade}|${c.stream}`] = areas.map(a => ({
          learningAreaId: a.id, learningAreaName: a.name, lessonsPerWeek: 5,
        }));
      });

      const r = generateTimetable({
        classes: classList,
        days: DAYS,
        periodsPerDay,
        breakPeriods,
        lockedSlots,
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
      break_period: breakPeriods[0] ?? null,
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
      break_period: breakPeriods[0] ?? null,
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
      days: DAYS, periodsPerDay, breakPeriods,
      grid: result.grids[`${grade}|${stream}`],
      showTeacher: true,
    });
  };

  const downloadClassExcel = () => {
    if (!result) return;
    exportTimetableExcel({
      schoolName,
      title: `Class Timetable — ${grade} ${stream}`,
      days: DAYS, periodsPerDay, breakPeriods,
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
      days: DAYS, periodsPerDay, breakPeriods,
      grid: t.grid,
    });
  };

  const downloadAllExcel = () => {
    if (!result) return;
    exportTimetableExcelMulti(schoolName, `Master Timetable — ${schoolName}`, batchClasses.map(c => ({
      name: `${c.grade}-${c.stream}`,
      opts: {
        title: `${c.grade} ${c.stream}`,
        days: DAYS, periodsPerDay, breakPeriods,
        grid: result.grids[`${c.grade}|${c.stream}`],
        showTeacher: true,
      },
    })));
  };

  const downloadSummaryAllClasses = () => {
    if (!result) return;
    exportTimetableSummaryPdf({
      schoolName,
      days: DAYS,
      periodsPerDay,
      breakPeriods,
      classes: visibleBatchClasses.map(c => ({
        grade: c.grade,
        stream: c.stream,
        grid: result.grids[`${c.grade}|${c.stream}`],
      })),
    });
  };

  // Search filter (teacher / subject / class)
  const matchesSearch = (cell: TimetableSlot) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (cell.teacherName?.toLowerCase().includes(q) ||
            cell.learningAreaName?.toLowerCase().includes(q) ||
            cell.lockedLabel?.toLowerCase().includes(q));
  };

  const classGrid = result?.grids[`${grade}|${stream}`];

  // Filter batchClasses by block (display only)
  const visibleBatchClasses = useMemo(() => {
    const m = BLOCKS.find(b => b.id === blockFilter)!.match;
    return batchClasses.filter(c => m(c.grade));
  }, [batchClasses, blockFilter]);

  // ---- LOCKED VIEW ----
  if (activated === false) {
    if (!isAdmin) {
      return (
        <DashboardLayout>
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Timetable Not Yet Activated</CardTitle>
                <CardDescription>Your school administrator has not activated the Timetable module yet.</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Waiting for activation</AlertTitle>
                  <AlertDescription>Once the school admin enters the activation key, your personal timetable will appear here automatically.</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      );
    }
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
                <AlertDescription>Contact your platform administrator to receive your school's activation key. Once activated, all teachers in this school will automatically see their personal timetables.</AlertDescription>
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

  // ---- TEACHER / HEADTEACHER READ-ONLY VIEW ----
  if (!isAdmin) {
    return <TeacherTimetableView schoolId={schoolId!} userId={user!.id} schoolName={schoolName} role={role!} />;
  }

  // ---- UNLOCKED ----
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Block Timetable Generator</h1>
            <p className="text-muted-foreground text-sm">Auto-scheduling with collision detection. Lower / Upper Primary & Junior School support.</p>
          </div>
          <Badge className="bg-primary"><Unlock className="h-3 w-3 mr-1" /> Activated</Badge>
        </div>

        <Card>
          <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <div>
              <Label>Block</Label>
              <Select value={blockFilter} onValueChange={setBlockFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOCKS.map(b => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
                <SelectContent>
                  {grades.filter(g => BLOCKS.find(b => b.id === blockFilter)!.match(g)).map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
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
              <Label>Break periods</Label>
              <Input value={breakInput} onChange={e => setBreakInput(e.target.value)} placeholder="e.g. 3,5" />
              <p className="text-[10px] text-muted-foreground mt-1">Comma-separated period #s</p>
            </div>
          </CardContent>
        </Card>

        {/* Locked / Fixed periods */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Fixed periods (locked)</CardTitle>
            <CardDescription>e.g. Assembly, Pastoral. Applied to ALL classes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-4">
              <Select value={newLock.day} onValueChange={v => setNewLock(s => ({ ...s, day: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">Every day</SelectItem>
                  {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min={1} max={periodsPerDay} value={newLock.period} onChange={e => setNewLock(s => ({ ...s, period: Number(e.target.value) || 1 }))} placeholder="Period" />
              <Input value={newLock.label} onChange={e => setNewLock(s => ({ ...s, label: e.target.value }))} placeholder="Label (e.g. Assembly)" />
              <Button onClick={addLock} variant="outline"><Plus className="h-4 w-4 mr-1" /> Add lock</Button>
            </div>
            {lockedSlots.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {lockedSlots.map((l, i) => (
                  <Badge key={i} variant="secondary" className="gap-1.5">
                    {l.label} — {l.day === '*' ? 'Daily' : l.day} P{l.period}
                    <button onClick={() => removeLock(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
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
            {generating && batchMode ? 'Generating all…' : `Generate ${BLOCKS.find(b => b.id === blockFilter)!.label}`}
          </Button>
          {result && !batchMode && (
            <>
              <Button variant="outline" onClick={save}>Save</Button>
              <Button variant="outline" onClick={downloadClass}><Download className="h-4 w-4 mr-2" />Class PDF</Button>
              <Button variant="outline" onClick={downloadClassExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            </>
          )}
          {result && batchMode && (
            <>
              <Button variant="outline" onClick={saveBatch} disabled={savingBatch}>
                {savingBatch ? 'Saving…' : `Save All (${visibleBatchClasses.length})`}
              </Button>
              <Button variant="outline" onClick={downloadSummaryAllClasses}>
                <Download className="h-4 w-4 mr-2" />Summary PDF (All Classes)
              </Button>
              <Button variant="outline" onClick={downloadAllExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Master Excel</Button>
            </>
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

        {result && (
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teacher, subject, or class…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="max-w-sm h-9"
            />
            {searchQuery && <Badge variant="secondary" className="text-[10px]">filtering</Badge>}
          </div>
        )}

        {result && batchMode && (
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Summary (All Classes)</TabsTrigger>
              <TabsTrigger value="classes">Per Class ({visibleBatchClasses.length})</TabsTrigger>
              <TabsTrigger value="teachers">Teacher Views ({Object.keys(result.teacherGrids).length})</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              <SummaryAllClassesView
                schoolName={schoolName}
                days={DAYS}
                periodsPerDay={periodsPerDay}
                breakPeriods={breakPeriods}
                classes={visibleBatchClasses.map(c => ({
                  grade: c.grade,
                  stream: c.stream,
                  grid: result.grids[`${c.grade}|${c.stream}`],
                }))}
              />
            </TabsContent>
            <TabsContent value="classes" className="space-y-4">
              {visibleBatchClasses.map(c => {
                const ck = `${c.grade}|${c.stream}`;
                const g = result.grids[ck];
                if (!g) return null;
                return (
                  <Card key={ck}>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                      <CardTitle className="text-base">{c.grade} — {c.stream}</CardTitle>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => exportTimetablePdf({
                          schoolName,
                          title: `Class Timetable — ${c.grade} ${c.stream}`,
                          days: DAYS, periodsPerDay, breakPeriods,
                          grid: g, showTeacher: true,
                        })}>
                          <Download className="h-3 w-3 mr-1" /> PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => exportTimetableExcel({
                          schoolName,
                          title: `Class Timetable — ${c.grade} ${c.stream}`,
                          days: DAYS, periodsPerDay, breakPeriods,
                          grid: g, showTeacher: true,
                        })}>
                          <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <GridTable grid={g} days={DAYS} periodsPerDay={periodsPerDay} breakPeriods={breakPeriods} showTeacher matchesSearch={matchesSearch} />
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
            <TabsContent value="teachers" className="space-y-4">
              {Object.entries(result.teacherGrids)
                .filter(([_, t]) => !searchQuery || t.teacherName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(([tid, t]) => (
                <Card key={tid}>
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{t.teacherName}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">{t.lessonCount} lessons/wk</Badge>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadTeacher(tid)}>
                      <Download className="h-3 w-3 mr-1" /> PDF
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <GridTable grid={t.grid} days={DAYS} periodsPerDay={periodsPerDay} breakPeriods={breakPeriods} matchesSearch={matchesSearch} />
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}

        {classGrid && !batchMode && (
          <Tabs defaultValue="class">
            <TabsList>
              <TabsTrigger value="class">Class View</TabsTrigger>
              <TabsTrigger value="teachers">Teacher Views</TabsTrigger>
            </TabsList>
            <TabsContent value="class">
              <Card><CardContent className="p-0 overflow-x-auto">
                <GridTable grid={classGrid} days={DAYS} periodsPerDay={periodsPerDay} breakPeriods={breakPeriods} showTeacher matchesSearch={matchesSearch} />
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="teachers" className="space-y-4">
              {Object.entries(result!.teacherGrids)
                .filter(([_, t]) => !searchQuery || t.teacherName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(([tid, t]) => (
                <Card key={tid}>
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{t.teacherName}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">{t.lessonCount} lessons/wk</Badge>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadTeacher(tid)}>
                      <Download className="h-3 w-3 mr-1" /> PDF
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <GridTable grid={t.grid} days={DAYS} periodsPerDay={periodsPerDay} breakPeriods={breakPeriods} matchesSearch={matchesSearch} />
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

function GridTable({ grid, days, periodsPerDay, breakPeriods, showTeacher, matchesSearch }: {
  grid: TimetableSlot[][]; days: string[]; periodsPerDay: number; breakPeriods?: number[]; showTeacher?: boolean; matchesSearch?: (c: TimetableSlot) => boolean;
}) {
  const breaks = new Set(breakPeriods || []);
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-muted">
          <th className="border p-2 text-left">Day</th>
          {Array.from({ length: periodsPerDay }, (_, i) => (
            <th key={i} className={`border p-2 ${breaks.has(i + 1) ? 'bg-muted-foreground/20' : ''}`}>
              {breaks.has(i + 1) ? 'BREAK' : `P${i + 1}`}
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
              if (cell?.isLocked) return <td key={p} className="border p-2 text-center bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-medium text-[11px]">{cell.lockedLabel}</td>;
              if (cell?.learningAreaName) {
                const dim = matchesSearch && !matchesSearch(cell);
                return (
                  <td key={p} className={`border p-2 text-center transition-opacity ${dim ? 'opacity-25' : ''}`}>
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

// ===== Read-only view shown to teachers / headteachers once school is activated =====
function TeacherTimetableView({ schoolId, userId, schoolName, role }: {
  schoolId: string; userId: string; schoolName: string; role: string;
}) {
  const [loading, setLoading] = useState(true);
  const [timetables, setTimetables] = useState<any[]>([]);
  const [personalGrid, setPersonalGrid] = useState<TimetableSlot[][] | null>(null);
  const [periodsPerDay, setPeriodsPerDay] = useState(8);
  const [breakPeriods, setBreakPeriods] = useState<number[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: tts } = await supabase
        .from('timetables')
        .select('*')
        .eq('school_id', schoolId)
        .order('grade', { ascending: true });
      const list = (tts as any[]) || [];
      setTimetables(list);
      if (list.length > 0) {
        setPeriodsPerDay(list[0].periods_per_day || 8);
        setBreakPeriods(list[0].break_period ? [list[0].break_period] : []);
      }

      if (role === 'teacher' && list.length > 0) {
        const ppd = list[0].periods_per_day || 8;
        const empty: TimetableSlot[][] = DAYS.map(() =>
          Array.from({ length: ppd }, () => ({} as TimetableSlot))
        );
        list.forEach(tt => {
          const grid = (tt.data as TimetableSlot[][]) || [];
          grid.forEach((row, di) => {
            row.forEach((cell, pi) => {
              if (cell?.teacherId === userId && !empty[di][pi]?.learningAreaName) {
                empty[di][pi] = { ...cell };
              }
            });
          });
        });
        setPersonalGrid(empty);
      }
      setLoading(false);
    })();
  }, [schoolId, userId, role]);

  if (loading) return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Loading timetables…</div></DashboardLayout>;

  if (timetables.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No timetables yet</AlertTitle>
            <AlertDescription>The school admin has activated the timetable module but hasn't generated any timetables yet. Please check back later.</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Timetable</h1>
          <p className="text-muted-foreground text-sm">{schoolName} — read only</p>
        </div>

        {role === 'teacher' && personalGrid && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Personal Schedule</CardTitle>
                <CardDescription>Only periods where you are assigned</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportTimetablePdf({
                schoolName,
                title: 'My Personal Timetable',
                days: DAYS, periodsPerDay, breakPeriods,
                grid: personalGrid,
              })}>
                <Download className="h-3 w-3 mr-1" /> PDF
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <GridTable grid={personalGrid} days={DAYS} periodsPerDay={periodsPerDay} breakPeriods={breakPeriods} />
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">All Class Timetables</h2>
          {timetables.map(tt => (
            <Card key={tt.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">{tt.grade} — {tt.stream}</CardTitle>
                <Button size="sm" variant="outline" onClick={() => exportTimetablePdf({
                  schoolName,
                  title: `Class Timetable — ${tt.grade} ${tt.stream}`,
                  days: tt.days || DAYS,
                  periodsPerDay: tt.periods_per_day || 8,
                  breakPeriods: tt.break_period ? [tt.break_period] : [],
                  grid: tt.data as TimetableSlot[][],
                  showTeacher: true,
                })}>
                  <Download className="h-3 w-3 mr-1" /> PDF
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <GridTable
                  grid={tt.data as TimetableSlot[][]}
                  days={tt.days || DAYS}
                  periodsPerDay={tt.periods_per_day || 8}
                  breakPeriods={tt.break_period ? [tt.break_period] : []}
                  showTeacher
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

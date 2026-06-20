import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Lock, Unlock, Sparkles, Download, AlertTriangle, Layers, FileSpreadsheet, Search, Plus, X, BookOpen, Settings as SettingsIcon, ChevronDown } from 'lucide-react';
import { LessonsForClassDialog } from '@/components/timetable/LessonsForClassDialog';
import { VisualBreakBuilder } from '@/components/timetable/VisualBreakBuilder';
import { TimeBasedScheduling } from '@/components/timetable/TimeBasedScheduling';
import { SchedulingRulesPanel } from '@/components/timetable/SchedulingRulesPanel';
import { TimetableTemplates } from '@/components/timetable/TimetableTemplates';
import { LiveTimetablePreview } from '@/components/timetable/LiveTimetablePreview';
import { CollisionDashboard } from '@/components/timetable/CollisionDashboard';
import { TimetableAnalytics } from '@/components/timetable/TimetableAnalytics';
import {
  TIMETABLE_TEMPLATES, DEFAULT_RULES, computePeriodTimes,
  type BreakSlot, type SchedulingRules, type TimetableTemplate,
} from '@/lib/timetable-templates';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useSchoolStreams } from '@/hooks/use-school-streams';
import { getGradeLevel, type SchoolLevel } from '@/lib/grade-levels';
import {
  generateTimetable, type SubjectRequirement, type TeacherAssignmentRow, type TimetableSlot, type LockedSlot,
  type TeacherUnavailable,
} from '@/lib/timetable-engine';
import { exportTimetablePdf } from '@/lib/timetable-pdf';
import { exportTimetableExcel, exportTimetableExcelMulti } from '@/lib/timetable-excel';
import { exportTimetableSummaryPdf } from '@/lib/timetable-summary-pdf';
import { SummaryAllClassesView } from '@/components/SummaryAllClassesView';
import { useSchoolFeatureToggles } from '@/hooks/use-school-feature-toggles';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Block filters: maps a "block" to grade-level filter
const BLOCKS = [
  { id: 'all', label: 'All Levels', match: (_g: string) => true },
  { id: 'lower', label: 'Lower Primary (1-3)', match: (g: string) => { const n = parseInt(g, 10); return !isNaN(n) && n >= 1 && n <= 3; } },
  { id: 'upper', label: 'Upper Primary (4-6)', match: (g: string) => { const n = parseInt(g, 10); return !isNaN(n) && n >= 4 && n <= 6; } },
  { id: 'junior', label: 'Junior School (7-9)', match: (g: string) => { const n = parseInt(g, 10); return !isNaN(n) && n >= 7 && n <= 9; } },
  { id: 'block49', label: 'Block: Grades 4-9 (Combined)', match: (g: string) => { const n = parseInt(g, 10); return !isNaN(n) && n >= 4 && n <= 9; } },
] as const;

// Default 11-slot day with three breaks giving 8 teaching periods + Games:
// Slot:  1  2  3      4  5  6      7  8  9      10 11
// Show:  P1 P2 SHORT  P3 P4 LONG   P5 P6 LUNCH  P7 P8(GAMES)
const DEFAULT_PERIODS_PER_DAY = 11;
const DEFAULT_BREAK_INPUT = '3,6,9';
const DEFAULT_BREAK_LABELS = ['SHORT BREAK', 'LONG BREAK', 'LUNCH'];

interface PeriodTime { start: string; end: string; }
function defaultPeriodTimes(): PeriodTime[] {
  return [
    { start: '08:00', end: '08:35' }, // P1
    { start: '08:35', end: '09:10' }, // P2
    { start: '09:10', end: '09:30' }, // SHORT BREAK
    { start: '09:30', end: '10:05' }, // P3
    { start: '10:05', end: '10:40' }, // P4
    { start: '10:40', end: '11:00' }, // LONG BREAK
    { start: '11:00', end: '11:35' }, // P5
    { start: '11:35', end: '12:10' }, // P6
    { start: '12:10', end: '13:00' }, // LUNCH
    { start: '13:00', end: '13:35' }, // P7
    { start: '13:35', end: '14:10' }, // P8 (Games)
  ];
}

export default function TimetablePage() {
  const { schoolId, user, role, profile } = useAuth();
  const adminName = profile?.full_name || '';
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
  const [periodsPerDay, setPeriodsPerDay] = useState(DEFAULT_PERIODS_PER_DAY);
  const [breakInput, setBreakInput] = useState(DEFAULT_BREAK_INPUT);
  const [breakLabelsInput, setBreakLabelsInput] = useState(DEFAULT_BREAK_LABELS.join(','));
  const [periodTimes, setPeriodTimes] = useState<PeriodTime[]>(defaultPeriodTimes());
  const [gamesEnabled, setGamesEnabled] = useState(true);
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

  // Per-school day/period settings (loaded from timetable_settings)
  const [daysList, setDaysList] = useState<string[]>(DAYS);
  const [weekendDays, setWeekendDays] = useState<string[]>(['Saturday', 'Sunday']);
  // Days actually used for scheduling — weekends excluded
  const scheduleDays = useMemo(
    () => daysList.filter(d => !weekendDays.includes(d)),
    [daysList, weekendDays],
  );
  const [zeroPeriod, setZeroPeriod] = useState<boolean>(false);
  const [showDayNumbers, setShowDayNumbers] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Per-class lessons dialog
  const [lessonsDialogOpen, setLessonsDialogOpen] = useState(false);
  const [savedLessons, setSavedLessons] = useState<Array<{
    learning_area_id: string; teacher_id?: string | null; count: number; length: number; classroom?: string | null;
  }>>([]);

  // Merged subject groups (e.g. IRE/CRE share one slot). Local-only (per session).
  type MergeGroup = { id: string; label: string; learningAreaIds: string[] };
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([]);
  const [newMergeIds, setNewMergeIds] = useState<string[]>([]);
  const [newMergeLabel, setNewMergeLabel] = useState('');

  // Advanced timetable rules (gated by school feature toggle)
  const { isOn: isFeatureOn } = useSchoolFeatureToggles();
  const advancedRulesOn = isFeatureOn('feature_advanced_timetable_rules');
  const [maxLessonsPerDay, setMaxLessonsPerDay] = useState<number>(0); // 0 = no cap
  const [allowDoubleLessons, setAllowDoubleLessons] = useState<boolean>(true);
  const [teacherUnavailable, setTeacherUnavailable] = useState<TeacherUnavailable[]>([]);
  const [newUnavail, setNewUnavail] = useState<{ teacher_id: string; day: string; period: number }>({
    teacher_id: '', day: 'Monday', period: 1,
  });

  // ===== New visual setup state =====
  const [visualBreaks, setVisualBreaks] = useState<BreakSlot[]>([
    { slot: 3, type: 'short', label: 'SHORT BREAK' },
    { slot: 6, type: 'long',  label: 'LONG BREAK' },
    { slot: 9, type: 'lunch', label: 'LUNCH' },
  ]);
  const [startTime, setStartTime] = useState('07:30');
  const [lessonDurationMin, setLessonDurationMin] = useState(35);
  const [shortBreakMin, setShortBreakMin] = useState(20);
  const [longBreakMin, setLongBreakMin] = useState(20);
  const [lunchMin, setLunchMin] = useState(40);
  const [schedulingRules, setSchedulingRules] = useState<SchedulingRules>(DEFAULT_RULES);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Sync legacy break inputs (used by engine + GridTable) from visual builder
  useEffect(() => {
    setBreakInput(visualBreaks.map(b => b.slot).join(','));
    setBreakLabelsInput(visualBreaks.map(b => b.label).join(','));
  }, [visualBreaks]);

  // Auto-compute period times from durations
  useEffect(() => {
    const times = computePeriodTimes({
      startTime, periodsPerDay, lessonDurationMin,
      shortBreakMin, longBreakMin, lunchMin, breaks: visualBreaks,
    });
    setPeriodTimes(times);
  }, [startTime, periodsPerDay, lessonDurationMin, shortBreakMin, longBreakMin, lunchMin, visualBreaks]);

  // Reflect "reserveGames" rule into existing gamesEnabled flag
  useEffect(() => {
    setGamesEnabled(schedulingRules.reserveGames);
  }, [schedulingRules.reserveGames]);

  const applyTemplate = (t: TimetableTemplate) => {
    setActiveTemplateId(t.id);
    setStartTime(t.startTime);
    setLessonDurationMin(t.lessonDurationMin);
    setShortBreakMin(t.shortBreakMin);
    setLongBreakMin(t.longBreakMin);
    setLunchMin(t.lunchMin);
    setPeriodsPerDay(t.periodsPerDay);
    setVisualBreaks(t.breaks);
    setSchedulingRules(t.rules);
    toast({ title: `Applied: ${t.name}`, description: 'Settings updated. Click Save settings to persist.' });
  };

  const breakPeriods = useMemo(() => {
    return breakInput
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= periodsPerDay);
  }, [breakInput, periodsPerDay]);

  const breakLabels = useMemo(
    () => breakLabelsInput.split(',').map(s => s.trim()).filter(Boolean),
    [breakLabelsInput],
  );

  /**
   * Cap last allowed slot per band:
   *  - Lower Primary (1-3): cannot go past LUNCH break (the latest break)
   *  - Upper Primary (4-6): up to 7th teaching lesson
   *  - Junior School (7-9): up to 8th teaching lesson
   * Returns the 1-indexed slot number (inclusive) the lesson must end at or before.
   */
  const maxSlotForGrade = (grade: string): number => {
    const teachingToSlot: number[] = []; // teachingToSlot[t-1] = slot number for teaching lesson t
    for (let s = 1; s <= periodsPerDay; s++) {
      if (!breakPeriods.includes(s)) teachingToSlot.push(s);
    }
    const n = parseInt(grade, 10);
    if (!isNaN(n) && n >= 1 && n <= 3) {
      // Lower primary: lessons must end before the LUNCH (latest) break
      const lunchSlot = breakPeriods.length ? Math.max(...breakPeriods) : periodsPerDay + 1;
      return lunchSlot - 1;
    }
    if (!isNaN(n) && n >= 4 && n <= 6) {
      return teachingToSlot[6] ?? periodsPerDay; // 7th teaching lesson
    }
    if (!isNaN(n) && n >= 7 && n <= 9) {
      return teachingToSlot[7] ?? periodsPerDay; // 8th teaching lesson
    }
    return periodsPerDay;
  };

  // Resize period times array when periodsPerDay changes
  useEffect(() => {
    setPeriodTimes(prev => {
      if (prev.length === periodsPerDay) return prev;
      const next: PeriodTime[] = [];
      for (let i = 0; i < periodsPerDay; i++) {
        next.push(prev[i] || { start: '', end: '' });
      }
      return next;
    });
  }, [periodsPerDay]);

  // Auto-lock Games for P10 & P11 (last two periods) on every day when enabled
  const effectiveLockedSlots = useMemo<LockedSlot[]>(() => {
    const base = [...lockedSlots];
    if (gamesEnabled && periodsPerDay >= 11) {
      daysList.forEach(d => {
        base.push({ classKey: '*', day: d, period: 10, label: 'GAMES' });
        base.push({ classKey: '*', day: d, period: 11, label: 'GAMES' });
      });
    }
    return base;
  }, [lockedSlots, gamesEnabled, periodsPerDay]);


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
      const [{ data: la }, { data: ta }, { data: gsl }] = await Promise.all([
        supabase.from('learning_areas').select('id, name').eq('school_id', schoolId).eq('grade', grade).eq('is_active', true),
        supabase
          .from('teacher_assignments')
          .select('teacher_id, learning_area_id, grade, stream')
          .eq('school_id', schoolId)
          .eq('grade', grade),
        supabase
          .from('grade_subject_lessons')
          .select('learning_area_id, lessons_per_week')
          .eq('school_id', schoolId)
          .eq('grade', grade),
      ]);
      const las = (la || []) as { id: string; name: string }[];
      const allocMap: Record<string, number> = {};
      ((gsl as any) || []).forEach((r: any) => { allocMap[r.learning_area_id] = r.lessons_per_week; });
      setRequirements(las.map(l => ({
        learningAreaId: l.id,
        learningAreaName: l.name,
        lessonsPerWeek: allocMap[l.id] ?? 5,
      })));
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

  // Load timetable_settings (per school)
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data } = await supabase.from('timetable_settings').select('*').eq('school_id', schoolId).maybeSingle();
      if (data) {
        const d: any = data;
        const dl = Array.isArray(d.day_labels) ? d.day_labels : DAYS;
        setDaysList(dl.slice(0, d.num_days || dl.length));
        setWeekendDays(Array.isArray(d.weekend) ? d.weekend : ['Saturday', 'Sunday']);
        setPeriodsPerDay(d.periods_per_day || DEFAULT_PERIODS_PER_DAY);
        setZeroPeriod(!!d.zero_period);
        // Prefer new break_slots; fall back to legacy break_periods+labels
        if (Array.isArray(d.break_slots) && d.break_slots.length) {
          setVisualBreaks(d.break_slots as BreakSlot[]);
        } else if (Array.isArray(d.break_periods) && d.break_periods.length) {
          const labels = Array.isArray(d.break_labels) ? d.break_labels : [];
          setVisualBreaks(d.break_periods.map((slot: number, i: number) => {
            const lbl = labels[i] || 'BREAK';
            const type: BreakSlot['type'] = /lunch/i.test(lbl) ? 'lunch' : /long/i.test(lbl) ? 'long' : 'short';
            return { slot, type, label: lbl };
          }));
        }
        if (d.start_time) setStartTime(String(d.start_time).slice(0, 5));
        if (d.lesson_duration_min) setLessonDurationMin(d.lesson_duration_min);
        if (d.short_break_min != null) setShortBreakMin(d.short_break_min);
        if (d.long_break_min != null) setLongBreakMin(d.long_break_min);
        if (d.lunch_min != null) setLunchMin(d.lunch_min);
        if (d.scheduling_rules) setSchedulingRules({ ...DEFAULT_RULES, ...d.scheduling_rules });
        if (d.template_name) {
          const t = TIMETABLE_TEMPLATES.find(t => t.name === d.template_name);
          if (t) setActiveTemplateId(t.id);
        }
      }
    })();
  }, [schoolId]);

  // Load saved per-class lessons when grade/stream changes; merge into requirements
  const loadClassLessons = async () => {
    if (!schoolId || !grade || !stream) { setSavedLessons([]); return; }
    const { data } = await supabase.from('timetable_class_lessons').select('*')
      .eq('school_id', schoolId).eq('grade', grade).eq('stream', stream);
    const list = ((data as any) || []) as any[];
    setSavedLessons(list.map(r => ({
      learning_area_id: r.learning_area_id,
      teacher_id: r.teacher_id, count: r.count, length: r.length, classroom: r.classroom,
    })));
  };
  useEffect(() => { loadClassLessons(); }, [schoolId, grade, stream]);

  const saveSettings = async () => {
    if (!schoolId) return;
    setSavingSettings(true);
    const payload = {
      school_id: schoolId,
      num_days: scheduleDays.length,
      day_labels: daysList,
      weekend: weekendDays,
      periods_per_day: periodsPerDay,
      zero_period: zeroPeriod,
      break_periods: breakPeriods,
      break_labels: breakLabels,
    };
    const { error } = await supabase.from('timetable_settings').upsert(payload, { onConflict: 'school_id' });
    setSavingSettings(false);
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Timetable settings saved' });
  };

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

  const addMergeGroup = () => {
    if (newMergeIds.length < 2) {
      return toast({ title: 'Pick at least 2 subjects to merge', variant: 'destructive' });
    }
    const names = requirements.filter(r => newMergeIds.includes(r.learningAreaId)).map(r => r.learningAreaName);
    const label = (newMergeLabel || names.join('/')).trim() || 'Merged';
    setMergeGroups(prev => [
      ...prev,
      { id: `merge-${Date.now()}`, label, learningAreaIds: [...newMergeIds] },
    ]);
    setNewMergeIds([]);
    setNewMergeLabel('');
    toast({ title: 'Merged group added', description: `${label} will share one slot.` });
  };
  const removeMergeGroup = (id: string) =>
    setMergeGroups(prev => prev.filter(g => g.id !== id));

  /**
   * Collapse merged subjects into single synthetic requirements.
   * - The merged requirement uses the FIRST member's learningAreaId (so the
   *   teacher pool lookup works); the engine matches by id+grade+stream.
   * - Teacher assignments for OTHER members are remapped to the primary id so
   *   any of those teachers can take the combined slot.
   * - The merged requirement's name becomes the configured label (e.g. "IRE/CRE").
   * - LessonsPerWeek = MAX of members (so we don't double-count).
   */
  const applyMerges = (
    reqs: SubjectRequirement[],
    assigns: TeacherAssignmentRow[],
  ): { reqs: SubjectRequirement[]; assigns: TeacherAssignmentRow[] } => {
    if (mergeGroups.length === 0) return { reqs, assigns };
    let outReqs = [...reqs];
    let outAssigns = [...assigns];
    for (const g of mergeGroups) {
      const members = outReqs.filter(r => g.learningAreaIds.includes(r.learningAreaId));
      if (members.length < 2) continue;
      const primaryId = members[0].learningAreaId;
      const otherIds = members.slice(1).map(m => m.learningAreaId);
      const lpw = Math.max(...members.map(m => m.lessonsPerWeek));
      // Replace requirements
      outReqs = outReqs.filter(r => !g.learningAreaIds.includes(r.learningAreaId));
      outReqs.push({
        learningAreaId: primaryId,
        learningAreaName: g.label,
        lessonsPerWeek: lpw,
      });
      // Remap assignments of other members → primary
      outAssigns = outAssigns.map(a =>
        otherIds.includes(a.learning_area_id)
          ? { ...a, learning_area_id: primaryId }
          : a,
      );
    }
    return { reqs: outReqs, assigns: outAssigns };
  };

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
    // Prefer saved per-class lessons (with length/teacher overrides) when present
    const baseReqs: SubjectRequirement[] = savedLessons.length > 0
      ? savedLessons.map(s => {
          const area = requirements.find(r => r.learningAreaId === s.learning_area_id);
          return {
            learningAreaId: s.learning_area_id,
            learningAreaName: area?.learningAreaName || 'Subject',
            lessonsPerWeek: s.count,
            length: s.length,
            preferredTeacherId: s.teacher_id || undefined,
            classroom: s.classroom || undefined,
          };
        })
      : requirements.filter(r => r.lessonsPerWeek > 0);
    const merged = applyMerges(baseReqs, streamAssignments);
    const reqMap: Record<string, SubjectRequirement[]> = {};
    reqMap[`${grade}|${stream}`] = merged.reqs;
    const r = generateTimetable({
      classes: [{ grade, stream }],
      days: scheduleDays,
      periodsPerDay,
      breakPeriods,
      lockedSlots: effectiveLockedSlots,
      requirementsByClass: reqMap,
      assignments: merged.assigns,
      maxPeriodByClass: { [`${grade}|${stream}`]: maxSlotForGrade(grade) },
      ...(advancedRulesOn ? {
        maxLessonsPerDayPerSubject: maxLessonsPerDay > 0 ? maxLessonsPerDay : undefined,
        allowDoubleLessons,
        teacherUnavailable,
      } : {}),
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
      const { data: gslAll } = await supabase
        .from('grade_subject_lessons')
        .select('grade, learning_area_id, lessons_per_week')
        .eq('school_id', schoolId)
        .in('grade', gradesIn);
      const allocByGrade: Record<string, Record<string, number>> = {};
      ((gslAll as any) || []).forEach((r: any) => {
        if (!allocByGrade[r.grade]) allocByGrade[r.grade] = {};
        allocByGrade[r.grade][r.learning_area_id] = r.lessons_per_week;
      });
      const areasByGrade: Record<string, { id: string; name: string }[]> = {};
      ((la as any) || []).forEach((l: any) => {
        if (!areasByGrade[l.grade]) areasByGrade[l.grade] = [];
        areasByGrade[l.grade].push({ id: l.id, name: l.name });
      });

      const reqMap: Record<string, SubjectRequirement[]> = {};
      let mergedAssignments = allAssignments;
      classList.forEach(c => {
        const areas = areasByGrade[c.grade] || [];
        const allocs = allocByGrade[c.grade] || {};
        const baseReqs: SubjectRequirement[] = areas.map(a => ({
          learningAreaId: a.id, learningAreaName: a.name, lessonsPerWeek: allocs[a.id] ?? 5,
        }));
        const m = applyMerges(baseReqs, mergedAssignments);
        reqMap[`${c.grade}|${c.stream}`] = m.reqs;
        mergedAssignments = m.assigns;
      });

      const r = generateTimetable({
        classes: classList,
        days: scheduleDays,
        periodsPerDay,
        breakPeriods,
        lockedSlots: effectiveLockedSlots,
        requirementsByClass: reqMap,
        assignments: mergedAssignments,
        maxPeriodByClass: Object.fromEntries(classList.map(c => [`${c.grade}|${c.stream}`, maxSlotForGrade(c.grade)])),
        ...(advancedRulesOn ? {
          maxLessonsPerDayPerSubject: maxLessonsPerDay > 0 ? maxLessonsPerDay : undefined,
          allowDoubleLessons,
          teacherUnavailable,
        } : {}),
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
      days: scheduleDays,
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
      days: scheduleDays,
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
      days: scheduleDays, periodsPerDay, breakPeriods,
      grid: result.grids[`${grade}|${stream}`],
      showTeacher: true, preparedBy: adminName,
    });
  };

  const downloadClassExcel = () => {
    if (!result) return;
    exportTimetableExcel({
      schoolName,
      title: `Class Timetable — ${grade} ${stream}`,
      days: scheduleDays, periodsPerDay, breakPeriods,
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
      days: scheduleDays, periodsPerDay, breakPeriods,
      grid: t.grid,
      preparedBy: adminName,
    });
  };

  const downloadAllExcel = () => {
    if (!result) return;
    exportTimetableExcelMulti(schoolName, `Master Timetable — ${schoolName}`, batchClasses.map(c => ({
      name: `${c.grade}-${c.stream}`,
      opts: {
        title: `${c.grade} ${c.stream}`,
        days: scheduleDays, periodsPerDay, breakPeriods,
        grid: result.grids[`${c.grade}|${c.stream}`],
        showTeacher: true, preparedBy: adminName,
      },
    })));
  };

  const downloadSummaryAllClasses = () => {
    if (!result) return;
    exportTimetableSummaryPdf({
      schoolName,
      days: scheduleDays,
      periodsPerDay,
      breakPeriods,
      breakLabels,
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
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/class-subjects-teachers"><BookOpen className="h-4 w-4 mr-1" /> Subjects & Teachers</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/lesson-allocations"><SettingsIcon className="h-4 w-4 mr-1" /> Lesson Allocations</Link>
            </Button>
            <Badge className="bg-primary"><Unlock className="h-3 w-3 mr-1" /> Activated</Badge>
          </div>
        </div>

        {/* School-wide day & period settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><SettingsIcon className="h-4 w-4" /> Day & period settings</CardTitle>
            <CardDescription>School-wide. Saved per school.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div>
              <Label className="text-xs">Periods per day</Label>
              <Input type="number" min={4} max={14} value={periodsPerDay}
                onChange={e => setPeriodsPerDay(Math.max(4, Math.min(14, Number(e.target.value) || 11)))} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={zeroPeriod} onChange={e => setZeroPeriod(e.target.checked)} className="h-4 w-4" />
                <span>Work with zero period</span>
              </label>
            </div>
            <div>
              <Label className="text-xs">Number of days</Label>
              <Input type="number" min={1} max={7} value={daysList.length}
                onChange={e => {
                  const n = Math.max(1, Math.min(7, Number(e.target.value) || 5));
                  setDaysList(prev => {
                    const base = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
                    const next = [...prev];
                    while (next.length < n) next.push(base[next.length] || `Day ${next.length+1}`);
                    return next.slice(0, n);
                  });
                }} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Day labels (comma-separated, in order)</Label>
              <Input value={daysList.join(', ')}
                onChange={e => setDaysList(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </div>
            <div>
              <Label className="text-xs">Weekend</Label>
              <Select value={weekendDays.length ? weekendDays.join('|') : '__none__'} onValueChange={v => setWeekendDays(v === '__none__' ? [] : v.split('|').filter(Boolean))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Saturday|Sunday">Saturday – Sunday</SelectItem>
                  <SelectItem value="Friday|Saturday">Friday – Saturday</SelectItem>
                  <SelectItem value="Sunday">Sunday only</SelectItem>
                  <SelectItem value="__none__">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4">
              <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
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
              <Label>Slots / day</Label>
              <Input type="number" min={4} max={14} value={periodsPerDay} onChange={e => setPeriodsPerDay(Math.max(4, Math.min(14, Number(e.target.value) || 11)))} />
              <p className="text-[10px] text-muted-foreground mt-1">Total slots incl. breaks</p>
            </div>
            <div>
              <Label>Break slot #s</Label>
              <Input value={breakInput} onChange={e => setBreakInput(e.target.value)} placeholder="e.g. 3,6,9" />
              <p className="text-[10px] text-muted-foreground mt-1">Comma-separated</p>
            </div>
            <div className="md:col-span-3">
              <Label>Break labels (in order)</Label>
              <Input value={breakLabelsInput} onChange={e => setBreakLabelsInput(e.target.value)} placeholder="SHORT BREAK, LONG BREAK, LUNCH" />
            </div>
            <div className="md:col-span-2 flex items-end gap-2 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={gamesEnabled}
                  onChange={e => setGamesEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Auto-lock last 2 slots as <strong>GAMES</strong> (P7 & P8)</span>
              </label>
              <Button
                size="sm" variant="outline"
                disabled={!grade || !stream}
                onClick={() => setLessonsDialogOpen(true)}
              >
                <BookOpen className="h-4 w-4 mr-1" /> Lessons for class
                {savedLessons.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{savedLessons.length}</Badge>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {schoolId && grade && stream && (
          <LessonsForClassDialog
            open={lessonsDialogOpen}
            onOpenChange={setLessonsDialogOpen}
            schoolId={schoolId}
            grade={grade}
            stream={stream}
            allClasses={grades.flatMap(g => streams.map(s => ({ grade: g, stream: s })))}
            onSaved={loadClassLessons}
          />
        )}

        {/* Session times editor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session times</CardTitle>
            <CardDescription>Enter start/end time for every slot (including breaks). Times print in PDFs.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {periodTimes.map((t, i) => {
                const isBreak = breakPeriods.includes(i + 1);
                const breakIdx = breakPeriods.indexOf(i + 1);
                const slotLabel = isBreak
                  ? (breakLabels[breakIdx] || 'BREAK')
                  : (() => {
                      const teaching = i + 1 - breakPeriods.filter(b => b <= i + 1).length;
                      const isGames = gamesEnabled && periodsPerDay >= 11 && (i + 1 === 10 || i + 1 === 11);
                      return isGames ? `P${teaching} (GAMES)` : `P${teaching}`;
                    })();
                return (
                  <div key={i} className={`flex items-center gap-1.5 p-2 rounded border ${isBreak ? 'bg-muted/50' : ''}`}>
                    <span className="text-[10px] font-semibold w-16 shrink-0">{slotLabel}</span>
                    <Input
                      type="time"
                      value={t.start}
                      onChange={e => setPeriodTimes(prev => prev.map((p, idx) => idx === i ? { ...p, start: e.target.value } : p))}
                      className="h-8 text-xs"
                    />
                    <span className="text-xs">–</span>
                    <Input
                      type="time"
                      value={t.end}
                      onChange={e => setPeriodTimes(prev => prev.map((p, idx) => idx === i ? { ...p, end: e.target.value } : p))}
                      className="h-8 text-xs"
                    />
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setPeriodTimes(defaultPeriodTimes())}
            >
              Reset to defaults
            </Button>
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
                  {daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
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

        {advancedRulesOn && isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Advanced timetable rules</CardTitle>
              <CardDescription>Optional constraints applied during generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Max lessons per day per subject (per class)</Label>
                  <Input
                    type="number" min={0} max={periodsPerDay}
                    value={maxLessonsPerDay}
                    onChange={e => setMaxLessonsPerDay(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0 = no cap"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Allow back-to-back same subject (double lessons)</Label>
                  <Select value={allowDoubleLessons ? 'yes' : 'no'} onValueChange={v => setAllowDoubleLessons(v === 'yes')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes — allow doubles</SelectItem>
                      <SelectItem value="no">No — block consecutive same subject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Teacher unavailable slots</Label>
                <div className="grid gap-2 md:grid-cols-4">
                  <Select value={newUnavail.teacher_id} onValueChange={v => setNewUnavail(s => ({ ...s, teacher_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      {Array.from(new Map(assignments.map(a => [a.teacher_id, a.teacher_name])).entries()).map(([id, name]) => (
                        <SelectItem key={id} value={id}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newUnavail.day} onValueChange={v => setNewUnavail(s => ({ ...s, day: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="*">Every day</SelectItem>
                      {daysList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} max={periodsPerDay}
                    value={newUnavail.period}
                    onChange={e => setNewUnavail(s => ({ ...s, period: Number(e.target.value) || 1 }))}
                    placeholder="Period" />
                  <Button variant="outline" onClick={() => {
                    if (!newUnavail.teacher_id) return;
                    setTeacherUnavailable(prev => [...prev, { ...newUnavail }]);
                  }}><Plus className="h-4 w-4 mr-1" /> Add</Button>
                </div>
                {teacherUnavailable.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {teacherUnavailable.map((u, i) => {
                      const tname = assignments.find(a => a.teacher_id === u.teacher_id)?.teacher_name || 'Teacher';
                      return (
                        <Badge key={i} variant="secondary" className="gap-1.5">
                          {tname} — {u.day === '*' ? 'Daily' : u.day} P{u.period}
                          <button onClick={() => setTeacherUnavailable(prev => prev.filter((_, j) => j !== i))} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">If no teachers appear, load assignments by selecting a Grade & Stream first.</p>
              </div>
            </CardContent>
          </Card>
        )}

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

        {requirements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" /> Merged subjects (combined classes)
              </CardTitle>
              <CardDescription>
                Group subjects that share one slot — e.g. <strong>IRE/CRE</strong>, <strong>French/German</strong>.
                The combined slot uses the larger lessons-per-week of its members and any
                of the merged subjects' assigned teachers can teach it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
                <div className="space-y-1">
                  <Label className="text-xs">Subjects to merge (pick 2 or more)</Label>
                  <div className="flex flex-wrap gap-1.5 rounded border p-2 max-h-32 overflow-y-auto">
                    {requirements.map(r => {
                      const checked = newMergeIds.includes(r.learningAreaId);
                      return (
                        <label
                          key={r.learningAreaId}
                          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer border ${
                            checked ? 'bg-primary/10 border-primary' : 'border-transparent hover:bg-muted'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5"
                            checked={checked}
                            onChange={e => {
                              setNewMergeIds(prev =>
                                e.target.checked
                                  ? [...prev, r.learningAreaId]
                                  : prev.filter(id => id !== r.learningAreaId),
                              );
                            }}
                          />
                          {r.learningAreaName}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Combined label</Label>
                  <Input
                    value={newMergeLabel}
                    onChange={e => setNewMergeLabel(e.target.value)}
                    placeholder="e.g. IRE/CRE"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addMergeGroup} variant="outline" disabled={newMergeIds.length < 2}>
                    <Plus className="h-4 w-4 mr-1" /> Add merge
                  </Button>
                </div>
              </div>

              {mergeGroups.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {mergeGroups.map(g => (
                    <Badge key={g.id} variant="secondary" className="gap-1.5">
                      {g.label} ({g.learningAreaIds.length} subjects)
                      <button onClick={() => removeMergeGroup(g.id)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
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
                days={scheduleDays}
                periodsPerDay={periodsPerDay}
                breakPeriods={breakPeriods}
                breakLabels={breakLabels}
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
                          days: scheduleDays, periodsPerDay, breakPeriods,
                          grid: g, showTeacher: true, preparedBy: adminName,
                        })}>
                          <Download className="h-3 w-3 mr-1" /> PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => exportTimetableExcel({
                          schoolName,
                          title: `Class Timetable — ${c.grade} ${c.stream}`,
                          days: scheduleDays, periodsPerDay, breakPeriods,
                          grid: g, showTeacher: true,
                        })}>
                          <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <GridTable grid={g} days={scheduleDays} periodsPerDay={periodsPerDay} breakPeriods={breakPeriods} breakLabels={breakLabels} periodTimes={periodTimes} showTeacher matchesSearch={matchesSearch} />
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
                    <GridTable grid={t.grid} days={scheduleDays} periodsPerDay={periodsPerDay} breakPeriods={breakPeriods} breakLabels={breakLabels} periodTimes={periodTimes} matchesSearch={matchesSearch} />
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
                <GridTable grid={classGrid} days={scheduleDays} periodsPerDay={periodsPerDay} breakPeriods={breakPeriods} breakLabels={breakLabels} periodTimes={periodTimes} showTeacher matchesSearch={matchesSearch} />
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
                    <GridTable grid={t.grid} days={scheduleDays} periodsPerDay={periodsPerDay} breakPeriods={breakPeriods} breakLabels={breakLabels} periodTimes={periodTimes} matchesSearch={matchesSearch} />
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

function GridTable({ grid, days, periodsPerDay, breakPeriods, breakLabels, periodTimes, showTeacher, matchesSearch }: {
  grid: TimetableSlot[][]; days: string[]; periodsPerDay: number; breakPeriods?: number[];
  breakLabels?: string[]; periodTimes?: { start: string; end: string }[];
  showTeacher?: boolean; matchesSearch?: (c: TimetableSlot) => boolean;
}) {
  const breaks = new Set(breakPeriods || []);
  const breakIdxOf = (slot: number) => (breakPeriods || []).indexOf(slot);
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-muted">
          <th className="border p-2 text-left" rowSpan={periodTimes ? 2 : 1}>Day</th>
          {Array.from({ length: periodsPerDay }, (_, i) => {
            const isBreak = breaks.has(i + 1);
            const label = isBreak
              ? (breakLabels?.[breakIdxOf(i + 1)] || 'BREAK')
              : (() => {
                  const teaching = i + 1 - (breakPeriods || []).filter(b => b <= i + 1).length;
                  return `P${teaching}`;
                })();
            return (
              <th key={i} className={`border p-2 ${isBreak ? 'bg-muted-foreground/20 text-[10px]' : ''}`}>
                {label}
              </th>
            );
          })}
        </tr>
        {periodTimes && (
          <tr className="bg-muted/60">
            {Array.from({ length: periodsPerDay }, (_, i) => {
              const t = periodTimes[i];
              return (
                <th key={i} className="border px-1 py-0.5 text-[9px] font-normal text-muted-foreground">
                  {t?.start && t?.end ? `${t.start}–${t.end}` : ''}
                </th>
              );
            })}
          </tr>
        )}
      </thead>
      <tbody>
        {days.map((d, di) => (
          <tr key={d}>
            <td className="border p-2 font-semibold bg-muted/50">{d}</td>
            {Array.from({ length: periodsPerDay }, (_, p) => {
              const cell = grid[di]?.[p];
              if (cell?.isBreak) {
                const lbl = breakLabels?.[breakIdxOf(p + 1)] || 'BREAK';
                return <td key={p} className="border p-1 text-center bg-muted/40 text-muted-foreground text-[10px] font-semibold">{lbl}</td>;
              }
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
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});
  const adminLabel = Object.values(adminNames)[0] || '';

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
      // Load admin (generator) names
      const ids = Array.from(new Set(list.map(t => t.generated_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', ids);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
        setAdminNames(map);
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
          {adminLabel && (
            <p className="text-xs text-muted-foreground mt-1">
              Prepared by: <span className="font-medium text-foreground">{adminLabel}</span> (Administrator)
            </p>
          )}
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
                preparedBy: adminLabel,
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
                  showTeacher: true, preparedBy: adminLabel,
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

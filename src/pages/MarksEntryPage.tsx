import { useState, useMemo, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, TrendingUp, TrendingDown, Award, AlertTriangle, BookOpen, CheckCircle2, Layers, Lock, Unlock } from 'lucide-react';
import { isScoreLocked } from '@/lib/score-lock';
import { AdminScoreOverrideDialog } from '@/components/AdminScoreOverrideDialog';
import { TERMS, ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS, type AssessmentType, getGradeForLevel, type AnyGrade, isKJSEAGradeLevel } from '@/lib/cbc-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StrandMarksEntry from '@/components/StrandMarksEntry';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useAuth } from '@/contexts/AuthContext';
import { getGradeLevel } from '@/lib/grade-levels';
import { sortSubjectsByOrder, buildSubjectColumns } from '@/lib/subject-order';
import BulkScoresUploadDialog from '@/components/BulkScoresUploadDialog';
import BulkMarksManagerDialog from '@/components/BulkMarksManagerDialog';
import { useAcademicYears } from '@/hooks/use-academic-years';
import MarksEntrySubjectWorkspace from '@/components/MarksEntrySubjectWorkspace';
import { addToOfflineQueue, isOnline } from '@/lib/offline-queue';
import { useOfflineSync } from '@/hooks/use-offline-sync';

interface AssignmentOption {
  grade: string;
  stream: string;
  learning_area_id: string;
  subject_name: string;
}

export default function MarksEntryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role, profile, schoolId, user } = useAuth();
  const currentYear = new Date().getFullYear();
  const { data: academicYears = [] } = useAcademicYears();
  const dynamicGrades = useSchoolGrades();

  const isTeacher = role === 'teacher';
  const isPrivileged = role === 'admin' || role === 'headteacher' || role === 'super_admin';

  // Fetch teacher_assignments for the current teacher
  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-teacher-assignments', user?.id, schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('teacher_assignments')
        .select('grade, stream, learning_area_id, learning_areas(name)')
        .eq('teacher_id', user!.id);
      return (data || []).map((a: any) => ({
        grade: a.grade,
        stream: a.stream,
        learning_area_id: a.learning_area_id,
        subject_name: a.learning_areas?.name || 'Unknown',
      })) as AssignmentOption[];
    },
    enabled: isTeacher && !!user,
  });

  // Check if teacher is also a class teacher (gets broader view of their class)
  const { data: myClassTeacher = [] } = useQuery({
    queryKey: ['my-class-teacher', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('class_teachers')
        .select('grade, stream')
        .eq('teacher_id', user!.id);
      return data || [];
    },
    enabled: isTeacher && !!user,
  });

  // Build unique grade+stream combos from assignments
  const assignmentCombos = useMemo(() => {
    if (!isTeacher) return [];
    const map = new Map<string, { grade: string; stream: string; subjects: AssignmentOption[] }>();
    myAssignments.forEach(a => {
      const key = `${a.grade}|${a.stream}`;
      if (!map.has(key)) map.set(key, { grade: a.grade, stream: a.stream, subjects: [] });
      map.get(key)!.subjects.push(a);
    });
    return Array.from(map.values()).sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true }) || a.stream.localeCompare(b.stream));
  }, [myAssignments, isTeacher]);

  // State
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentType>('end_term');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [learnerSearch, setLearnerSearch] = useState('');

  // For privileged users, fetch all streams (with level for filtering)
  const { data: dbStreams = [] } = useQuery({
    queryKey: ['streams-with-level', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name, level').eq('school_id', schoolId!).order('name');
      return (data || []) as { name: string; level: string }[];
    },
    enabled: isPrivileged && !!schoolId,
  });

  // Determine available grades/streams
  const availableGrades = useMemo(() => {
    if (isPrivileged) return dynamicGrades;
    return [...new Set(assignmentCombos.map(c => c.grade))];
  }, [isPrivileged, dynamicGrades, assignmentCombos]);

  const availableStreams = useMemo(() => {
    if (isPrivileged) {
      if (!selectedGrade) return [] as string[];
      const lvl = getGradeLevel(selectedGrade);
      return dbStreams.filter(s => (s.level || 'primary') === lvl).map(s => s.name);
    }
    return [...new Set(assignmentCombos.filter(c => c.grade === selectedGrade).map(c => c.stream))];
  }, [isPrivileged, dbStreams, assignmentCombos, selectedGrade]);

  // Auto-select first grade/stream
  useEffect(() => {
    if (availableGrades.length > 0 && (!selectedGrade || !availableGrades.includes(selectedGrade))) {
      setSelectedGrade(availableGrades[0]);
    }
  }, [availableGrades]);

  useEffect(() => {
    if (availableStreams.length > 0 && (!selectedStream || !availableStreams.includes(selectedStream))) {
      setSelectedStream(availableStreams[0]);
    }
  }, [availableStreams]);

  // Fetch learners
  const { data: learners = [] } = useQuery({
    queryKey: ['learners', selectedGrade, selectedStream, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('learners').select('*')
        .eq('grade', selectedGrade).eq('stream', selectedStream).eq('is_active', true)
        .order('full_name');
      return data || [];
    },
    enabled: !!selectedGrade && !!selectedStream,
  });

  // Fetch all subjects for this grade
  const { data: allSubjects = [] } = useQuery({
    queryKey: ['learning-areas', selectedGrade, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('*')
        .eq('grade', selectedGrade).eq('is_active', true).eq('school_id', schoolId!).order('name');
      return data || [];
    },
    enabled: !!selectedGrade && !!schoolId,
  });

  // Filter subjects based on assignments (for teachers) and apply canonical CBC ordering
  const subjects = useMemo(() => {
    let list = allSubjects as any[];
    if (!isPrivileged) {
      const assignedIds = new Set(
        myAssignments
          .filter(a => a.grade === selectedGrade && a.stream === selectedStream)
          .map(a => a.learning_area_id)
      );
      const isClassTeacherHere = myClassTeacher.some(ct => ct.grade === selectedGrade && ct.stream === selectedStream);
      if (!isClassTeacherHere) list = list.filter(s => assignedIds.has(s.id));
    }
    return sortSubjectsByOrder(list, selectedGrade);
  }, [allSubjects, isPrivileged, myAssignments, myClassTeacher, selectedGrade, selectedStream]);

  // Marks Entry always uses individual (raw) subject columns. Merged subjects
  // are an admin-controlled *report-time* construct; teachers still enter raw
  // scores per learning area so the reporting engine can aggregate correctly.
  const mergeCombined = false;
  const subjectColumns = useMemo(
    () => buildSubjectColumns((subjects || []) as any[], selectedGrade || '', []) || [],
    [subjects, selectedGrade]
  );

  // Which subject IDs can this teacher actually edit?
  const editableSubjectIds = useMemo(() => {
    if (isPrivileged) return new Set(allSubjects.map(s => s.id));
    return new Set(
      myAssignments
        .filter(a => a.grade === selectedGrade && a.stream === selectedStream)
        .map(a => a.learning_area_id)
    );
  }, [isPrivileged, myAssignments, allSubjects, selectedGrade, selectedStream]);

  // Fetch existing scores
  const { data: existingScores = [] } = useQuery({
    queryKey: ['scores', selectedGrade, selectedStream, selectedTerm, selectedAssessment, selectedYear, schoolId],
    queryFn: async () => {
      const learnerIds = learners.map(l => l.id);
      if (learnerIds.length === 0) return [];
      const { data } = await supabase.from('scores').select('*')
        .in('learner_id', learnerIds)
        .eq('term', selectedTerm).eq('year', selectedYear)
        .eq('assessment_type', selectedAssessment);
      return data || [];
    },
    enabled: learners.length > 0,
  });

  // Lock map keyed by `${learner_id}|${learning_area_id}` -> { id, locked, row }
  const scoreMeta = useMemo(() => {
    const m = new Map<string, { id: string; locked: boolean; row: any }>();
    existingScores.forEach((s: any) => {
      m.set(`${s.learner_id}|${s.learning_area_id}`, {
        id: s.id,
        locked: isScoreLocked(s),
        row: s,
      });
    });
    return m;
  }, [existingScores]);

  const [override, setOverride] = useState<null | {
    scoreId: string; learnerName: string; subjectName: string; currentScore: any; currentComment?: string | null;
  }>(null);

  useEffect(() => {
    const scoreMap: Record<string, Record<string, string>> = {};
    existingScores.forEach(s => {
      if (!scoreMap[s.learner_id]) scoreMap[s.learner_id] = {};
      scoreMap[s.learner_id][s.learning_area_id] = String(s.score);
    });
    setScores(scoreMap);
    setHasUnsavedChanges(false);
  }, [existingScores]);

  // Auto-save infrastructure
  useOfflineSync(); // ensures online-recovery sync runs
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set()); // "learnerId|subjectId"
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);

  const handleScoreChange = useCallback((learnerId: string, subjectId: string, value: string) => {
    setScores(prev => ({
      ...prev,
      [learnerId]: { ...(prev[learnerId] || {}), [subjectId]: value },
    }));
    setHasUnsavedChanges(true);
    setDirtyCells(prev => {
      const next = new Set(prev);
      next.add(`${learnerId}|${subjectId}`);
      return next;
    });
  }, []);

  // ── Merged-column workspace adapters ──
  // When the merge toggle is ON we expose synthetic "merged" subjects to the
  // workspace (e.g. SS+CRE, Sci+Agri). Writes are fan-out to all members.
  const MERGED_PREFIX = 'merged:';
  const workspaceSubjects = useMemo(() => {
    return subjectColumns.map(col => col.kind === 'single'
      ? { id: col.subject.id, name: col.subject.name, max_score: col.subject.max_score }
      : { id: MERGED_PREFIX + col.members.map(m => m.id).join('+'), name: col.label, max_score: col.max_score });
  }, [subjectColumns]);
  const workspaceEditableIds = useMemo(() => {
    const s = new Set<string>();
    subjectColumns.forEach(col => {
      if (col.kind === 'single') {
        if (editableSubjectIds.has(col.subject.id)) s.add(col.subject.id);
      } else if (col.members.every(m => editableSubjectIds.has(m.id))) {
        s.add(MERGED_PREFIX + col.members.map(m => m.id).join('+'));
      }
    });
    return s;
  }, [subjectColumns, editableSubjectIds]);
  const workspaceScores = useMemo(() => {
    if (!mergeCombined) return scores;
    const out: Record<string, Record<string, string>> = {};
    Object.entries(scores).forEach(([lid, sm]) => { out[lid] = { ...sm }; });
    subjectColumns.forEach(col => {
      if (col.kind !== 'merged') return;
      const mid = MERGED_PREFIX + col.members.map(m => m.id).join('+');
      Object.keys(scores).forEach(lid => {
        const vals = col.members.map(m => scores[lid]?.[m.id])
          .filter(v => v !== undefined && v !== '' && !isNaN(Number(v))).map(Number);
        if (vals.length === col.members.length) {
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          out[lid] = { ...(out[lid] || {}), [mid]: String(Math.round(avg)) };
        }
      });
    });
    return out;
  }, [scores, subjectColumns, mergeCombined]);
  const workspaceExistingScores = useMemo(() => {
    if (!mergeCombined) return existingScores;
    const extras: any[] = [];
    subjectColumns.forEach(col => {
      if (col.kind !== 'merged') return;
      const mid = MERGED_PREFIX + col.members.map(m => m.id).join('+');
      const byLearner: Record<string, any[]> = {};
      (existingScores as any[]).forEach((s: any) => {
        if (col.members.some(m => m.id === s.learning_area_id)) {
          (byLearner[s.learner_id] ||= []).push(s);
        }
      });
      Object.entries(byLearner).forEach(([lid, arr]) => {
        if (arr.length === col.members.length) {
          const avg = arr.reduce((a, b) => a + Number(b.score), 0) / arr.length;
          extras.push({ ...arr[0], id: `${mid}|${lid}`, learner_id: lid, learning_area_id: mid, score: Math.round(avg) });
        }
      });
    });
    return [...(existingScores as any[]), ...extras];
  }, [existingScores, subjectColumns, mergeCombined]);
  const workspaceHandleScoreChange = useCallback((learnerId: string, subjectId: string, value: string) => {
    if (subjectId.startsWith(MERGED_PREFIX)) {
      const memberIds = subjectId.slice(MERGED_PREFIX.length).split('+');
      memberIds.forEach(mid => handleScoreChange(learnerId, mid, value));
    } else {
      handleScoreChange(learnerId, subjectId, value);
    }
  }, [handleScoreChange]);

  // Save - only save editable subjects
  const saveMutation = useMutation({
    mutationFn: async () => {
      const upserts: any[] = [];
      Object.entries(scores).forEach(([learnerId, subjectScores]) => {
        Object.entries(subjectScores).forEach(([subjectId, score]) => {
          if (score && !isNaN(Number(score)) && editableSubjectIds.has(subjectId)) {
            upserts.push({
              learner_id: learnerId,
              learning_area_id: subjectId,
              term: selectedTerm,
              year: selectedYear,
              score: Number(score),
              school_id: schoolId,
              assessment_type: selectedAssessment,
              submitted_at: new Date().toISOString(),
              status: 'submitted',
            });
          }
        });
      });
      if (upserts.length === 0) throw new Error('No scores to save');
      const { error } = await supabase.from('scores').upsert(upserts, {
        onConflict: 'learner_id,learning_area_id,term,year,assessment_type',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scores'] });
      setHasUnsavedChanges(false);
      toast({ title: 'Scores saved successfully!' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Calculations — respect merged columns: a merged column counts as ONE subject.
  // Value comes from the primary member; other members are ignored (not duplicated).
  const getColumnValue = (learnerId: string, col: typeof subjectColumns[number]) => {
    const s = scores[learnerId] || {};
    if (col.kind === 'single') return Number(s[col.subject.id]) || 0;
    return Number(s[col.members[0].id]) || 0;
  };
  const getEnteredColumns = (learnerId: string) =>
    subjectColumns.filter(col => getColumnValue(learnerId, col) > 0);
  const getTotal = (learnerId: string) =>
    getEnteredColumns(learnerId).reduce((sum, col) => sum + getColumnValue(learnerId, col), 0);
  const getMean = (learnerId: string) => {
    const entered = getEnteredColumns(learnerId);
    if (entered.length === 0) return 0;
    return getTotal(learnerId) / entered.length;
  };
  const getTotalMaxScore = () =>
    subjectColumns.reduce((sum, col) => sum + (col.kind === 'single' ? col.subject.max_score : col.max_score), 0);

  const rankings = useMemo(() => {
    const totals = learners.map(l => ({ id: l.id, total: getTotal(l.id) }));
    totals.sort((a, b) => b.total - a.total);
    let rank = 0, prevTotal = -1;
    return totals.map((t, i) => {
      if (t.total !== prevTotal) { rank = i + 1; prevTotal = t.total; }
      return { id: t.id, rank };
    });
  }, [learners, scores, subjectColumns]);

  const getRank = (id: string) => rankings.find(r => r.id === id)?.rank || '-';

  // Filtered learners by search (name or admission number) — ranks computed against full class
  const filteredLearners = useMemo(() => {
    const q = learnerSearch.trim().toLowerCase();
    if (!q) return learners;
    return learners.filter((l: any) =>
      (l.full_name || '').toLowerCase().includes(q) ||
      (l.admission_number || '').toLowerCase().includes(q)
    );
  }, [learners, learnerSearch]);

  // Class summary — only includes learners that have at least one non-zero score
  const classSummary = useMemo(() => {
    if (learners.length === 0 || subjectColumns.length === 0) return null;
    const maxPerSubject = getTotalMaxScore() / subjectColumns.length;
    const scoringLearners = learners.filter(l => getMean(l.id) > 0);
    const grades = scoringLearners.map(l => getGradeForLevel(getMean(l.id), maxPerSubject, selectedGrade));
    const isKJSEA = isKJSEAGradeLevel(selectedGrade);
    const meanVal = scoringLearners.length > 0
      ? scoringLearners.reduce((sum, l) => sum + getMean(l.id), 0) / scoringLearners.length
      : 0;
    return {
      ee: grades.filter(g => isKJSEA ? (g === 'EE1' || g === 'EE2') : g === 'EE').length,
      me: grades.filter(g => isKJSEA ? (g === 'ME1' || g === 'ME2') : g === 'ME').length,
      ae: grades.filter(g => isKJSEA ? (g === 'AE1' || g === 'AE2') : g === 'AE').length,
      be: grades.filter(g => isKJSEA ? (g === 'BE1' || g === 'BE2') : g === 'BE').length,
      classMean: meanVal.toFixed(1),
    };
  }, [learners, scores, subjectColumns]);

  // Auto-save: debounced flush of dirty cells (works online & queues offline)
  useEffect(() => {
    if (dirtyCells.size === 0) return;
    const timer = setTimeout(async () => {
      const cells = Array.from(dirtyCells);
      setDirtyCells(new Set());
      setAutoSaving(true);
      try {
        const upserts: any[] = [];
        const deletes: { learner_id: string; learning_area_id: string }[] = [];
        for (const key of cells) {
          const [learnerId, subjectId] = key.split('|');
          if (!editableSubjectIds.has(subjectId)) continue;
          const raw = scores[learnerId]?.[subjectId];
          if (raw === undefined || raw === '' || isNaN(Number(raw))) {
            deletes.push({ learner_id: learnerId, learning_area_id: subjectId });
          } else {
            upserts.push({
              learner_id: learnerId,
              learning_area_id: subjectId,
              term: selectedTerm,
              year: selectedYear,
              score: Number(raw),
              school_id: schoolId,
              assessment_type: selectedAssessment,
              submitted_at: new Date().toISOString(),
              status: 'submitted',
            });
          }
        }
        const online = isOnline();
        if (upserts.length) {
          if (online) {
            const { error } = await supabase.from('scores').upsert(upserts, {
              onConflict: 'learner_id,learning_area_id,term,year,assessment_type',
            });
            if (error) throw error;
          } else {
            upserts.forEach(u => addToOfflineQueue({ type: 'score', data: u }));
          }
        }
        for (const d of deletes) {
          if (online) {
            await supabase.from('scores').delete()
              .eq('learner_id', d.learner_id)
              .eq('learning_area_id', d.learning_area_id)
              .eq('term', selectedTerm).eq('year', selectedYear)
              .eq('assessment_type', selectedAssessment);
          } else {
            addToOfflineQueue({
              type: 'score-delete',
              data: { ...d, term: selectedTerm, year: selectedYear, assessment_type: selectedAssessment },
            });
          }
        }
        setLastAutoSaved(new Date());
        setHasUnsavedChanges(false);
        if (online) queryClient.invalidateQueries({ queryKey: ['scores'] });
      } catch (e: any) {
        console.error('Auto-save error', e);
      } finally {
        setAutoSaving(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [dirtyCells, scores, editableSubjectIds, selectedTerm, selectedYear, selectedAssessment, schoolId, queryClient]);


  const getGradeBadge = (grade: AnyGrade | '-') => {
    if (grade === '-') return null;
    const colorMap: Record<string, string> = {
      EE: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400',
      ME: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400',
      AE: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400',
      BE: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400',
      EE1: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400',
      EE2: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400',
      ME1: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400',
      ME2: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400',
      AE1: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400',
      AE2: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400',
      BE1: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400',
      BE2: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400',
    };
    return <Badge className={`${colorMap[grade] || ''} border font-semibold`} variant="outline">{grade}</Badge>;
  };

  // No assignments message for teachers
  if (isTeacher && myAssignments.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <BookOpen className="h-16 w-16 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">No Subject Assignments</h2>
          <p className="text-muted-foreground max-w-md">
            You haven't been assigned to any subjects yet. Please contact your school administrator to get your subject and class assignments configured.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold">Marks Entry</h1>
            <p className="text-muted-foreground text-xs md:text-sm">
              {isTeacher
                ? `${myAssignments.length} subject assignment(s) across ${assignmentCombos.length} class(es)`
                : 'CBC Assessment — KNEC-style score entry'}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedGrade && selectedStream && (
              <>
                <BulkScoresUploadDialog
                  schoolId={schoolId!}
                  grade={selectedGrade}
                  stream={selectedStream}
                  term={selectedTerm}
                  year={selectedYear}
                  assessment={selectedAssessment}
                  subjects={subjects.filter(s => editableSubjectIds.has(s.id)).map(s => ({ id: s.id, name: s.name, max_score: s.max_score }))}
                  learners={learners as any[]}
                />
                <BulkMarksManagerDialog
                  schoolId={schoolId!}
                  grade={selectedGrade}
                  stream={selectedStream}
                  term={selectedTerm}
                  year={selectedYear}
                  assessment={selectedAssessment}
                  learners={learners as any[]}
                  subjects={subjects as any[]}
                  existingScores={existingScores}
                  editableSubjectIds={editableSubjectIds}
                />
              </>
            )}
            <div className="flex items-center text-xs text-muted-foreground gap-1.5 mr-1">
              {autoSaving ? (
                <span className="text-amber-600">Auto-saving…</span>
              ) : lastAutoSaved ? (
                <span className="text-emerald-600">✓ Saved {lastAutoSaved.toLocaleTimeString()}</span>
              ) : null}
              {!isOnline() && <span className="text-destructive">Offline</span>}
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasUnsavedChanges}
              size="sm"
              className="gap-1.5"
            >
              {saveMutation.isPending ? (
                <>Saving...</>
              ) : hasUnsavedChanges ? (
                <><Save className="h-4 w-4" /> Save Scores</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Saved</>
              )}
            </Button>
          </div>
        </div>

        {/* Teacher assignment chips (mobile-friendly quick select) */}
        {isTeacher && assignmentCombos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {assignmentCombos.map(combo => {
              const isActive = combo.grade === selectedGrade && combo.stream === selectedStream;
              return (
                <Button
                  key={`${combo.grade}-${combo.stream}`}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => {
                    setSelectedGrade(combo.grade);
                    setSelectedStream(combo.stream);
                  }}
                >
                  Gr {combo.grade} {combo.stream}
                  <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                    {combo.subjects.length}
                  </Badge>
                </Button>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-end">
          {isPrivileged && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Grade</Label>
                <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedStream(''); }}>
                  <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{availableGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stream</Label>
                <Select value={selectedStream} onValueChange={setSelectedStream}>
                  <SelectTrigger className="w-[110px] h-9"><SelectValue placeholder="Stream" /></SelectTrigger>
                  <SelectContent>{availableStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Term</Label>
            <Select value={String(selectedTerm)} onValueChange={v => setSelectedTerm(Number(v))}>
              <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Assessment</Label>
            <Select value={selectedAssessment} onValueChange={v => setSelectedAssessment(v as AssessmentType)}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{ASSESSMENT_TYPES.map(at => <SelectItem key={at} value={at}>{ASSESSMENT_TYPE_LABELS[at]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(academicYears.length > 0
                  ? academicYears.map(a => a.year)
                  : [currentYear, currentYear - 1, currentYear - 2]
                ).map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>


        {/* Assigned subjects indicator for teachers */}
        {isTeacher && subjects.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {subjects.map(s => (
              <Badge
                key={s.id}
                variant={editableSubjectIds.has(s.id) ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {s.name}
                {!editableSubjectIds.has(s.id) && <span className="ml-1 opacity-60">(view)</span>}
              </Badge>
            ))}
          </div>
        )}

        <Tabs defaultValue="subjects" className="space-y-3">
          <TabsList>
            <TabsTrigger value="subjects">Subject Scores</TabsTrigger>
            <TabsTrigger value="strands" className="gap-1.5"><Layers className="h-3.5 w-3.5" /> Strand Scores</TabsTrigger>
          </TabsList>

          <TabsContent value="subjects" className="space-y-3">
            <MarksEntrySubjectWorkspace
              subjects={workspaceSubjects as any}
              editableSubjectIds={workspaceEditableIds}
              learners={learners as any}
              selectedGrade={selectedGrade}
              scores={workspaceScores}
              existingScores={workspaceExistingScores as any}
              onScoreChange={workspaceHandleScoreChange}
            />
          </TabsContent>

          <TabsContent value="strands">
            <StrandMarksEntry
              schoolId={schoolId!}
              selectedGrade={selectedGrade}
              selectedStream={selectedStream}
              selectedTerm={selectedTerm}
              selectedYear={selectedYear}
              selectedAssessment={selectedAssessment}
              learners={learners}
              isPrivileged={isPrivileged}
              editableSubjectIds={editableSubjectIds}
            />
          </TabsContent>
        </Tabs>
      </div>
      {override && (
        <AdminScoreOverrideDialog
          open={!!override}
          onOpenChange={(v) => !v && setOverride(null)}
          table="scores"
          scoreId={override.scoreId}
          learnerName={override.learnerName}
          subjectName={override.subjectName}
          currentScore={override.currentScore}
          currentComment={override.currentComment}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['scores'] })}
        />
      )}
    </DashboardLayout>
  );
}

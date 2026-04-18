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
import { Save, TrendingUp, TrendingDown, Award, AlertTriangle, BookOpen, CheckCircle2, Layers } from 'lucide-react';
import { TERMS, ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS, type AssessmentType, getGradeForLevel, type AnyGrade, isKJSEAGradeLevel } from '@/lib/cbc-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StrandMarksEntry from '@/components/StrandMarksEntry';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useAuth } from '@/contexts/AuthContext';
import { getGradeLevel } from '@/lib/grade-levels';

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

  // Filter subjects based on assignments (for teachers)
  const subjects = useMemo(() => {
    if (isPrivileged) return allSubjects;

    // Get subject IDs from teacher_assignments for this grade+stream
    const assignedIds = new Set(
      myAssignments
        .filter(a => a.grade === selectedGrade && a.stream === selectedStream)
        .map(a => a.learning_area_id)
    );

    // If teacher is class teacher for this grade+stream, show all subjects (read-only for unassigned)
    const isClassTeacherHere = myClassTeacher.some(ct => ct.grade === selectedGrade && ct.stream === selectedStream);
    if (isClassTeacherHere) return allSubjects;

    return allSubjects.filter(s => assignedIds.has(s.id));
  }, [allSubjects, isPrivileged, myAssignments, myClassTeacher, selectedGrade, selectedStream]);

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

  useEffect(() => {
    const scoreMap: Record<string, Record<string, string>> = {};
    existingScores.forEach(s => {
      if (!scoreMap[s.learner_id]) scoreMap[s.learner_id] = {};
      scoreMap[s.learner_id][s.learning_area_id] = String(s.score);
    });
    setScores(scoreMap);
    setHasUnsavedChanges(false);
  }, [existingScores]);

  const handleScoreChange = useCallback((learnerId: string, subjectId: string, value: string) => {
    setScores(prev => ({
      ...prev,
      [learnerId]: { ...(prev[learnerId] || {}), [subjectId]: value },
    }));
    setHasUnsavedChanges(true);
  }, []);

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

  // Calculations
  const getTotal = (learnerId: string) => {
    const s = scores[learnerId] || {};
    return subjects.reduce((sum, sub) => sum + (Number(s[sub.id]) || 0), 0);
  };
  const getMean = (learnerId: string) => subjects.length === 0 ? 0 : getTotal(learnerId) / subjects.length;
  const getTotalMaxScore = () => subjects.reduce((sum, s) => sum + s.max_score, 0);

  const rankings = useMemo(() => {
    const totals = learners.map(l => ({ id: l.id, total: getTotal(l.id) }));
    totals.sort((a, b) => b.total - a.total);
    let rank = 0, prevTotal = -1;
    return totals.map((t, i) => {
      if (t.total !== prevTotal) { rank = i + 1; prevTotal = t.total; }
      return { id: t.id, rank };
    });
  }, [learners, scores, subjects]);

  const getRank = (id: string) => rankings.find(r => r.id === id)?.rank || '-';

  // Class summary
  const classSummary = useMemo(() => {
    if (learners.length === 0 || subjects.length === 0) return null;
    const maxPerSubject = getTotalMaxScore() / subjects.length;
    const grades = learners.map(l => getGradeForLevel(getMean(l.id), maxPerSubject, selectedGrade));
    const isKJSEA = isKJSEAGradeLevel(selectedGrade);
    return {
      ee: grades.filter(g => isKJSEA ? (g === 'EE1' || g === 'EE2') : g === 'EE').length,
      me: grades.filter(g => isKJSEA ? (g === 'ME1' || g === 'ME2') : g === 'ME').length,
      ae: grades.filter(g => isKJSEA ? (g === 'AE1' || g === 'AE2') : g === 'AE').length,
      be: grades.filter(g => isKJSEA ? (g === 'BE1' || g === 'BE2') : g === 'BE').length,
      classMean: (learners.reduce((sum, l) => sum + getMean(l.id), 0) / learners.length).toFixed(1),
    };
  }, [learners, scores, subjects]);

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
            <Input type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-[90px] h-9" />
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
            {/* Grade summary cards */}
            {classSummary && (
              <div className="grid grid-cols-5 gap-2">
                <Card className="border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-2 md:p-3 text-center">
                    <p className="text-lg font-bold">{classSummary.ee}</p>
                    <p className="text-[10px] text-muted-foreground">EE</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardContent className="p-2 md:p-3 text-center">
                    <p className="text-lg font-bold">{classSummary.me}</p>
                    <p className="text-[10px] text-muted-foreground">ME</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 dark:border-amber-800">
                  <CardContent className="p-2 md:p-3 text-center">
                    <p className="text-lg font-bold">{classSummary.ae}</p>
                    <p className="text-[10px] text-muted-foreground">AE</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200 dark:border-red-800">
                  <CardContent className="p-2 md:p-3 text-center">
                    <p className="text-lg font-bold">{classSummary.be}</p>
                    <p className="text-[10px] text-muted-foreground">BE</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-2 md:p-3 text-center">
                    <p className="text-lg font-bold text-primary">{classSummary.classMean}</p>
                    <p className="text-[10px] text-muted-foreground">Mean</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Marks Grid */}
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="sticky left-0 bg-muted/50 z-10 w-[40px] text-xs">#</TableHead>
                      <TableHead className="sticky left-[40px] bg-muted/50 z-10 min-w-[140px] text-xs">Learner</TableHead>
                      {subjects.map(s => (
                        <TableHead key={s.id} className="text-center min-w-[70px] text-xs">
                          <div className="font-semibold truncate max-w-[80px]" title={s.name}>{s.name}</div>
                          <div className="text-[9px] text-muted-foreground font-normal">/{s.max_score}</div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center bg-muted font-bold text-xs">Tot</TableHead>
                      <TableHead className="text-center bg-muted font-bold text-xs">Mean</TableHead>
                      <TableHead className="text-center bg-muted font-bold text-xs">Grd</TableHead>
                      <TableHead className="text-center bg-muted font-bold text-xs">Rnk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {learners.map((learner, idx) => {
                      const total = getTotal(learner.id);
                      const mean = getMean(learner.id);
                      const maxPerSubject = subjects.length > 0 ? getTotalMaxScore() / subjects.length : 100;
                      const grade = subjects.length > 0 ? getGradeForLevel(mean, maxPerSubject, selectedGrade) : '-';
                      const rank = getRank(learner.id);
                      return (
                        <TableRow key={learner.id} className="hover:bg-muted/30">
                          <TableCell className="sticky left-0 bg-card z-10 text-xs text-muted-foreground p-1">{idx + 1}</TableCell>
                          <TableCell className="sticky left-[40px] bg-card z-10 text-xs font-medium p-1 truncate max-w-[140px]" title={learner.full_name}>
                            {learner.full_name}
                          </TableCell>
                          {subjects.map(sub => {
                            const val = scores[learner.id]?.[sub.id] || '';
                            const numVal = Number(val);
                            const pct = val && !isNaN(numVal) ? (numVal / sub.max_score) * 100 : null;
                            const canEdit = editableSubjectIds.has(sub.id);
                            let inputBorder = '';
                            if (pct !== null) {
                              if (pct >= 75) inputBorder = 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20';
                              else if (pct >= 50) inputBorder = 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20';
                              else if (pct >= 25) inputBorder = 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20';
                              else inputBorder = 'border-red-400 bg-red-50/50 dark:bg-red-950/20';
                            }
                            return (
                              <TableCell key={sub.id} className="p-0.5">
                                {canEdit ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    max={sub.max_score}
                                    value={val}
                                    onChange={e => handleScoreChange(learner.id, sub.id, e.target.value)}
                                    className={`w-[60px] text-center mx-auto h-8 text-xs ${inputBorder}`}
                                    inputMode="numeric"
                                  />
                                ) : (
                                  <div className={`w-[60px] text-center mx-auto h-8 flex items-center justify-center text-xs text-muted-foreground ${inputBorder ? inputBorder + ' rounded border' : ''}`}>
                                    {val || '-'}
                                  </div>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold text-sm p-1">{total}</TableCell>
                          <TableCell className="text-center text-xs p-1">{mean.toFixed(1)}</TableCell>
                          <TableCell className="text-center p-1">{getGradeBadge(grade as AnyGrade | '-')}</TableCell>
                          <TableCell className="text-center p-1">
                            <span className={`font-bold text-sm ${rank === 1 ? 'text-amber-600' : rank === 2 ? 'text-slate-500' : rank === 3 ? 'text-orange-600' : ''}`}>
                              {rank}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {learners.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={subjects.length + 6} className="text-center py-12 text-muted-foreground">
                          No learners in this class. Select a different grade or stream.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Sticky save button on mobile */}
            {hasUnsavedChanges && (
              <div className="fixed bottom-20 left-0 right-0 p-3 md:hidden z-50">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="w-full shadow-lg"
                  size="lg"
                >
                  <Save className="mr-2 h-4 w-4" /> Save All Scores
                </Button>
              </div>
            )}
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
    </DashboardLayout>
  );
}

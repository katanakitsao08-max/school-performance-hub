import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, TrendingUp, TrendingDown, Award, AlertTriangle } from 'lucide-react';
import { GRADES, TERMS, getGrade, getGradeColor, getGradeLabel, type CBCGrade } from '@/lib/cbc-utils';
import { useAuth } from '@/contexts/AuthContext';

export default function MarksEntryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role, profile, schoolId } = useAuth();
  const currentYear = new Date().getFullYear();

  const availableGrades = role === 'teacher' ? (profile?.assigned_grades || []) : GRADES;
  const assignedStreams = profile?.assigned_streams || [];
  const assignedLearningAreas = profile?.assigned_learning_areas || [];
  const isSubjectTeacher = role === 'teacher' && assignedLearningAreas.length > 0;

  const { data: dbStreams = [] } = useQuery({
    queryKey: ['streams'],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name').order('name');
      return (data || []).map((s: any) => s.name);
    },
  });

  const availableStreams = role === 'teacher' && assignedStreams.length > 0
    ? dbStreams.filter(s => assignedStreams.includes(s))
    : dbStreams;

  const [selectedGrade, setSelectedGrade] = useState(availableGrades[0] || '1');
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (availableStreams.length > 0 && !selectedStream) {
      setSelectedStream(availableStreams[0]);
    }
  }, [availableStreams]);

  const { data: learners = [] } = useQuery({
    queryKey: ['learners', selectedGrade, selectedStream],
    queryFn: async () => {
      const { data, error } = await supabase.from('learners').select('*')
        .eq('grade', selectedGrade).eq('stream', selectedStream).eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allSubjects = [] } = useQuery({
    queryKey: ['learning-areas', selectedGrade],
    queryFn: async () => {
      const { data, error } = await supabase.from('learning_areas').select('*')
        .eq('grade', selectedGrade).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const subjects = isSubjectTeacher
    ? allSubjects.filter(s => assignedLearningAreas.includes(s.name))
    : allSubjects;

  const { data: existingScores = [] } = useQuery({
    queryKey: ['scores', selectedGrade, selectedStream, selectedTerm, selectedYear],
    queryFn: async () => {
      const learnerIds = learners.map(l => l.id);
      if (learnerIds.length === 0) return [];
      const { data, error } = await supabase.from('scores').select('*')
        .in('learner_id', learnerIds)
        .eq('term', selectedTerm).eq('year', selectedYear);
      if (error) throw error;
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
  }, [existingScores]);

  const handleScoreChange = (learnerId: string, subjectId: string, value: string) => {
    setScores(prev => ({
      ...prev,
      [learnerId]: { ...(prev[learnerId] || {}), [subjectId]: value },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const upserts: any[] = [];
      Object.entries(scores).forEach(([learnerId, subjectScores]) => {
        Object.entries(subjectScores).forEach(([subjectId, score]) => {
          if (score && !isNaN(Number(score))) {
            upserts.push({
              learner_id: learnerId,
              learning_area_id: subjectId,
              term: selectedTerm,
              year: selectedYear,
              score: Number(score),
              school_id: schoolId,
            });
          }
        });
      });
      if (upserts.length === 0) return;
      const { error } = await supabase.from('scores').upsert(upserts, {
        onConflict: 'learner_id,learning_area_id,term,year',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scores'] });
      toast({ title: 'Scores saved successfully!' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const getTotal = (learnerId: string) => {
    const s = scores[learnerId] || {};
    return subjects.reduce((sum, sub) => sum + (Number(s[sub.id]) || 0), 0);
  };

  const getMean = (learnerId: string) => {
    if (subjects.length === 0) return 0;
    return getTotal(learnerId) / subjects.length;
  };

  const getTotalMaxScore = () => subjects.reduce((sum, s) => sum + s.max_score, 0);

  const rankings = useMemo(() => {
    const totals = learners.map(l => ({ id: l.id, total: getTotal(l.id) }));
    totals.sort((a, b) => b.total - a.total);
    let rank = 0;
    let prevTotal = -1;
    return totals.map((t, i) => {
      if (t.total !== prevTotal) { rank = i + 1; prevTotal = t.total; }
      return { id: t.id, rank };
    });
  }, [learners, scores, subjects]);

  const getRank = (id: string) => rankings.find(r => r.id === id)?.rank || '-';

  // Class summary stats
  const classSummary = useMemo(() => {
    if (learners.length === 0 || subjects.length === 0) return null;
    const maxPerSubject = getTotalMaxScore() / subjects.length;
    const grades = learners.map(l => {
      const mean = getMean(l.id);
      return getGrade(mean, maxPerSubject);
    });
    return {
      ee: grades.filter(g => g === 'EE').length,
      me: grades.filter(g => g === 'ME').length,
      ae: grades.filter(g => g === 'AE').length,
      be: grades.filter(g => g === 'BE').length,
      classMean: learners.length > 0
        ? (learners.reduce((sum, l) => sum + getMean(l.id), 0) / learners.length).toFixed(1)
        : '0',
    };
  }, [learners, scores, subjects]);

  const getGradeBadge = (grade: CBCGrade | '-') => {
    if (grade === '-') return null;
    const colorMap: Record<CBCGrade, string> = {
      EE: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400',
      ME: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400',
      AE: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400',
      BE: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <Badge className={`${colorMap[grade]} border font-semibold`} variant="outline">
        {grade}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Marks Entry</h1>
            <p className="text-muted-foreground text-sm">CBC Assessment — KNEC-style score entry with automatic grading</p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save Scores
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">Grade</Label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{availableGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stream</Label>
            <Select value={selectedStream} onValueChange={setSelectedStream}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Stream" /></SelectTrigger>
              <SelectContent>{availableStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Term</Label>
            <Select value={String(selectedTerm)} onValueChange={v => setSelectedTerm(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <Input type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-[100px]" />
          </div>
        </div>

        {/* CBC Grade Summary */}
        {classSummary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-4 flex items-center gap-3">
                <Award className="h-7 w-7 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xl font-bold">{classSummary.ee}</p>
                  <p className="text-[11px] text-muted-foreground">Exceeding (EE)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingUp className="h-7 w-7 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-xl font-bold">{classSummary.me}</p>
                  <p className="text-[11px] text-muted-foreground">Meeting (ME)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingDown className="h-7 w-7 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-xl font-bold">{classSummary.ae}</p>
                  <p className="text-[11px] text-muted-foreground">Approaching (AE)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-7 w-7 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-xl font-bold">{classSummary.be}</p>
                  <p className="text-[11px] text-muted-foreground">Below (BE)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-primary">{classSummary.classMean}</p>
                <p className="text-[11px] text-muted-foreground">Class Mean</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CBC Grade Legend */}
        <div className="flex gap-3 flex-wrap text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500" /> EE: 75–100% (Exceeding)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500" /> ME: 50–74% (Meeting)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500" /> AE: 25–49% (Approaching)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> BE: 0–24% (Below)</span>
        </div>

        {/* Marks Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[50px]">#</TableHead>
                  <TableHead className="sticky left-[50px] bg-muted/50 z-10 min-w-[180px]">Learner Name</TableHead>
                  {subjects.map(s => (
                    <TableHead key={s.id} className="text-center min-w-[80px]">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">out of {s.max_score}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center bg-muted font-bold">Total</TableHead>
                  <TableHead className="text-center bg-muted font-bold">Mean</TableHead>
                  <TableHead className="text-center bg-muted font-bold">Grade</TableHead>
                  <TableHead className="text-center bg-muted font-bold">Rank</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {learners.map((learner, idx) => {
                  const total = getTotal(learner.id);
                  const mean = getMean(learner.id);
                  const maxPerSubject = subjects.length > 0 ? getTotalMaxScore() / subjects.length : 100;
                  const grade = subjects.length > 0 ? getGrade(mean, maxPerSubject) : '-';
                  const rank = getRank(learner.id);
                  return (
                    <TableRow key={learner.id} className="hover:bg-muted/30">
                      <TableCell className="sticky left-0 bg-card z-10 font-medium text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="sticky left-[50px] bg-card z-10 font-semibold">{learner.full_name}</TableCell>
                      {subjects.map(sub => {
                        const val = scores[learner.id]?.[sub.id] || '';
                        const numVal = Number(val);
                        const pct = val && !isNaN(numVal) ? (numVal / sub.max_score) * 100 : null;
                        const subGrade = pct !== null ? getGrade(numVal, sub.max_score) : null;
                        let inputBorder = '';
                        if (pct !== null) {
                          if (pct >= 75) inputBorder = 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20';
                          else if (pct >= 50) inputBorder = 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20';
                          else if (pct >= 25) inputBorder = 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20';
                          else inputBorder = 'border-red-400 bg-red-50/50 dark:bg-red-950/20';
                        }
                        return (
                          <TableCell key={sub.id} className="p-1">
                            <div className="flex flex-col items-center gap-0.5">
                              <Input
                                type="number"
                                min={0}
                                max={sub.max_score}
                                value={val}
                                onChange={e => handleScoreChange(learner.id, sub.id, e.target.value)}
                                className={`w-[70px] text-center mx-auto h-9 ${inputBorder}`}
                              />
                              {subGrade && (
                                <span className={`text-[10px] font-bold ${
                                  subGrade === 'EE' ? 'text-emerald-600 dark:text-emerald-400' :
                                  subGrade === 'ME' ? 'text-blue-600 dark:text-blue-400' :
                                  subGrade === 'AE' ? 'text-amber-600 dark:text-amber-400' :
                                  'text-red-600 dark:text-red-400'
                                }`}>{subGrade}</span>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold text-base">{total}</TableCell>
                      <TableCell className="text-center font-medium">{mean.toFixed(1)}</TableCell>
                      <TableCell className="text-center">{getGradeBadge(grade as CBCGrade | '-')}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold text-base ${rank === 1 ? 'text-amber-600' : rank === 2 ? 'text-slate-500' : rank === 3 ? 'text-orange-600' : ''}`}>
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
      </div>
    </DashboardLayout>
  );
}

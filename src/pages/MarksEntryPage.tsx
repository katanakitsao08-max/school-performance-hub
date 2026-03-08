import { useState, useMemo, useEffect } from 'react';
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
import { Save } from 'lucide-react';
import { GRADES, TERMS, getGrade, getGradeColor } from '@/lib/cbc-utils';
import { useAuth } from '@/contexts/AuthContext';

export default function MarksEntryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role, profile } = useAuth();
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

  // Set initial stream when streams load
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

  // Subject teachers only see their assigned subjects; class teachers see all
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

  // Initialize scores from existing data
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

  // Rankings
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

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Marks Entry</h1>
            <p className="text-muted-foreground">KNEC-style score entry</p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save Scores
          </Button>
        </div>

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

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10 min-w-[50px]">#</TableHead>
                  <TableHead className="sticky left-[50px] bg-card z-10 min-w-[180px]">Name</TableHead>
                  {subjects.map(s => (
                    <TableHead key={s.id} className="text-center min-w-[80px]">
                      {s.name}<br /><span className="text-xs text-muted-foreground">/{s.max_score}</span>
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Mean</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                  <TableHead className="text-center">Rank</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {learners.map((learner, idx) => {
                  const total = getTotal(learner.id);
                  const mean = getMean(learner.id);
                  const maxPerSubject = subjects.length > 0 ? getTotalMaxScore() / subjects.length : 100;
                  const grade = subjects.length > 0 ? getGrade(mean, maxPerSubject) : '-';
                  return (
                    <TableRow key={learner.id}>
                      <TableCell className="sticky left-0 bg-card">{idx + 1}</TableCell>
                      <TableCell className="sticky left-[50px] bg-card font-medium">{learner.full_name}</TableCell>
                      {subjects.map(sub => (
                        <TableCell key={sub.id} className="p-1">
                          <Input
                            type="number"
                            min={0}
                            max={sub.max_score}
                            value={scores[learner.id]?.[sub.id] || ''}
                            onChange={e => handleScoreChange(learner.id, sub.id, e.target.value)}
                            className="w-[70px] text-center mx-auto"
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold">{total}</TableCell>
                      <TableCell className="text-center">{mean.toFixed(1)}</TableCell>
                      <TableCell className="text-center">
                        {grade !== '-' && <Badge className={`${getGradeColor(grade as any)}`} variant="outline">{grade}</Badge>}
                      </TableCell>
                      <TableCell className="text-center font-bold">{getRank(learner.id)}</TableCell>
                    </TableRow>
                  );
                })}
                {learners.length === 0 && (
                  <TableRow><TableCell colSpan={subjects.length + 6} className="text-center py-8 text-muted-foreground">No learners in this class</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

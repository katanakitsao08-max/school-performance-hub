import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TERMS, getGradeForLevel, getGradeColor } from '@/lib/cbc-utils';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const CHART_COLORS = ['hsl(142,64%,40%)', 'hsl(210,80%,52%)', 'hsl(38,92%,50%)', 'hsl(0,84%,60%)'];

export default function AnalyticsPage() {
  const dynamicGrades = useSchoolGrades();
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: learners = [] } = useQuery({
    queryKey: ['all-learners', selectedGrade],
    queryFn: async () => {
      const { data } = await supabase.from('learners').select('*').eq('grade', selectedGrade).eq('is_active', true);
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['learning-areas', selectedGrade],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('*').eq('grade', selectedGrade).order('name');
      return data || [];
    },
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['scores-analytics', selectedGrade, selectedTerm, selectedYear],
    queryFn: async () => {
      const ids = learners.map(l => l.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('scores').select('*')
        .in('learner_id', ids).eq('term', selectedTerm).eq('year', selectedYear);
      return data || [];
    },
    enabled: learners.length > 0,
  });

  const subjectMeanData = useMemo(() => {
    return subjects.map(sub => {
      const subScores = scores.filter(s => s.learning_area_id === sub.id);
      const mean = subScores.length > 0 ? subScores.reduce((s, sc) => s + sc.score, 0) / subScores.length : 0;
      return { name: sub.name, mean: Number(mean.toFixed(1)), maxScore: sub.max_score };
    });
  }, [subjects, scores]);

  const gradeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    learners.forEach(l => {
      const learnerScores = scores.filter(s => s.learner_id === l.id);
      if (learnerScores.length === 0) return;
      const mean = learnerScores.reduce((s, sc) => s + sc.score, 0) / learnerScores.length;
      const avgMax = subjects.length > 0 ? subjects.reduce((s, sub) => s + sub.max_score, 0) / subjects.length : 100;
      const grade = getGradeForLevel(mean, avgMax, selectedGrade || l.grade || '1');
      dist[grade] = (dist[grade] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [learners, scores, subjects, selectedGrade]);

  const rankedLearners = useMemo(() => {
    return learners.map(l => {
      const ls = scores.filter(s => s.learner_id === l.id);
      const total = ls.reduce((s, sc) => s + sc.score, 0);
      const mean = ls.length > 0 ? total / ls.length : 0;
      const avgMax = subjects.length > 0 ? subjects.reduce((s, sub) => s + sub.max_score, 0) / subjects.length : 100;
      return { ...l, total, mean, grade: ls.length > 0 ? getGradeForLevel(mean, avgMax, selectedGrade || l.grade || '1') : '-' };
    }).sort((a, b) => b.total - a.total);
  }, [learners, scores, subjects]);

  const top10 = rankedLearners.slice(0, 10);
  const atRisk = rankedLearners.filter(l => l.grade === 'BE');

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">School-wide performance insights</p>
        </div>

        <div className="flex gap-4 flex-wrap">
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Grade" /></SelectTrigger>
            <SelectContent>{dynamicGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(selectedTerm)} onValueChange={v => setSelectedTerm(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Subject Mean Scores</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectMeanData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="mean" fill="hsl(142,64%,40%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">CBC Grade Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={gradeDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                    {gradeDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Top 10 Learners</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Mean</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top10.map((l, i) => (
                    <TableRow key={l.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{l.full_name}</TableCell>
                      <TableCell className="text-center">{l.total}</TableCell>
                      <TableCell className="text-center">{l.mean.toFixed(1)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={l.grade !== '-' ? getGradeColor(l.grade as any) : ''}>{l.grade}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">At-Risk Learners (BE)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Stream</TableHead>
                    <TableHead className="text-center">Mean</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atRisk.length > 0 ? atRisk.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.full_name}</TableCell>
                      <TableCell>{l.stream}</TableCell>
                      <TableCell className="text-center text-destructive font-bold">{l.mean.toFixed(1)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No at-risk learners</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

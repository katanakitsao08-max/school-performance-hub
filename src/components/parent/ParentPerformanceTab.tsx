import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getGradeForLevel } from '@/lib/cbc-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';

interface Props {
  child: { id: string; full_name: string; grade: string; stream: string; gender: string };
}

const gradeColor = (grade: string) => {
  if (grade.startsWith('EE')) return 'bg-success/10 text-success border-success/20';
  if (grade.startsWith('ME')) return 'bg-info/10 text-info border-info/20';
  if (grade.startsWith('AE')) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-destructive/10 text-destructive border-destructive/20';
};

export default function ParentPerformanceTab({ child }: Props) {
  const currentYear = new Date().getFullYear();
  const [term, setTerm] = useState<'all' | '1' | '2' | '3'>('all');
  const [assessment, setAssessment] = useState<'all' | 'opener' | 'mid_term' | 'end_term'>('all');
  const [year, setYear] = useState<string>(String(currentYear));

  const { data: scores = [] } = useQuery({
    queryKey: ['parent-scores', child.id, term, assessment, year],
    queryFn: async () => {
      let q = supabase
        .from('scores')
        .select('*, learning_areas!scores_learning_area_id_fkey(name, max_score)')
        .eq('learner_id', child.id)
        .eq('year', Number(year));
      if (term !== 'all') q = q.eq('term', Number(term));
      if (assessment !== 'all') q = q.eq('assessment_type', assessment);
      const { data } = await q;
      return data || [];
    },
  });

  const { subjectAvgs, subjectMap, overallAvg, overallGrade } = useMemo(() => {
    const map: Record<string, { name: string; scores: number[]; maxScores: number[] }> = {};
    for (const s of scores) {
      const name = (s as any).learning_areas?.name || 'Unknown';
      const maxScore = (s as any).learning_areas?.max_score || 100;
      if (!map[name]) map[name] = { name, scores: [], maxScores: [] };
      map[name].scores.push(Number(s.score));
      map[name].maxScores.push(maxScore);
    }
    const avgs = Object.values(map).map(s => ({
      name: s.name.length > 12 ? s.name.substring(0, 12) : s.name,
      fullName: s.name,
      avg: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length),
    }));
    const total = scores.reduce((a, s) => a + Number(s.score), 0);
    const count = scores.length || 1;
    const avg = Math.round(total / count);
    const grade = getGradeForLevel(avg, 100, child.grade);
    return { subjectAvgs: avgs, subjectMap: map, overallAvg: avg, overallGrade: grade };
  }, [scores, child.grade]);

  return (
    <div className="space-y-4">
      {/* Child info card */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-foreground">{child.full_name}</h3>
              <p className="text-xs text-muted-foreground">Grade {child.grade} · {child.stream} · {child.gender}</p>
            </div>
            <Badge className={cn("text-xs", gradeColor(overallGrade))}>{overallGrade}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-2">
            <Select value={term} onValueChange={(v) => setTerm(v as any)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                <SelectItem value="1">Term 1</SelectItem>
                <SelectItem value="2">Term 2</SelectItem>
                <SelectItem value="3">Term 3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assessment} onValueChange={(v) => setAssessment(v as any)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assessments</SelectItem>
                <SelectItem value="opener">Opener</SelectItem>
                <SelectItem value="mid_term">Mid-Term</SelectItem>
                <SelectItem value="end_term">End-Term</SelectItem>
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-display font-bold text-foreground">{overallAvg}%</p>
            <p className="text-[10px] text-muted-foreground">Average</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-display font-bold text-foreground">{scores.length}</p>
            <p className="text-[10px] text-muted-foreground">Assessments</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-display font-bold text-foreground">{subjectAvgs.length}</p>
            <p className="text-[10px] text-muted-foreground">Subjects</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {subjectAvgs.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-info" /> Subject Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectAvgs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1.5">
              {Object.values(subjectMap).map(s => {
                const avg = Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length);
                const grade = getGradeForLevel(avg, 100, child.grade);
                return (
                  <div key={s.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                    <span className="text-xs font-medium">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{avg}%</span>
                      <Badge variant="outline" className={cn("text-[10px] h-5", gradeColor(grade))}>{grade}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

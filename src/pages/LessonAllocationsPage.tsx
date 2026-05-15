import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { Save } from 'lucide-react';

export default function LessonAllocationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { schoolId } = useAuth();
  const grades = useSchoolGrades();
  const [grade, setGrade] = useState<string>('');
  const [edits, setEdits] = useState<Record<string, number>>({});

  const effectiveGrade = grade || grades[0] || '';

  const { data: areas = [] } = useQuery({
    queryKey: ['la-for-grade', schoolId, effectiveGrade],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('learning_areas')
        .select('id, name')
        .eq('school_id', schoolId!)
        .eq('grade', effectiveGrade)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!effectiveGrade,
  });

  const { data: existing = [] } = useQuery({
    queryKey: ['gsl', schoolId, effectiveGrade],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grade_subject_lessons')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('grade', effectiveGrade);
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!effectiveGrade,
  });

  const lookup = useMemo(() => {
    const m: Record<string, number> = {};
    existing.forEach((r: any) => { m[r.learning_area_id] = r.lessons_per_week; });
    return m;
  }, [existing]);

  const valueFor = (laId: string) => edits[laId] ?? lookup[laId] ?? 5;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = areas.map((a: any) => ({
        school_id: schoolId,
        grade: effectiveGrade,
        learning_area_id: a.id,
        lessons_per_week: Math.max(0, Math.min(40, Number(valueFor(a.id)) || 0)),
      }));
      if (!rows.length) return;
      const { error } = await supabase
        .from('grade_subject_lessons')
        .upsert(rows, { onConflict: 'school_id,grade,learning_area_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Saved', description: 'Weekly lesson allocations updated.' });
      setEdits({});
      qc.invalidateQueries({ queryKey: ['gsl', schoolId, effectiveGrade] });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Weekly Lesson Allocations</h1>
          <p className="text-sm text-muted-foreground">
            Configure how many lessons per week each subject gets for each grade. Used by the Timetable generator instead of the default 5.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">Grade</Label>
                <Select value={effectiveGrade} onValueChange={setGrade}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Choose grade" /></SelectTrigger>
                  <SelectContent>
                    {grades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !areas.length}>
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save All'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            {areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active learning areas for this grade. Add subjects in Learning Areas first.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-48">Lessons / Week</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areas.map((a: any) => {
                    const saved = lookup[a.id];
                    const v = valueFor(a.id);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={40}
                            value={v}
                            onChange={(e) => setEdits(prev => ({ ...prev, [a.id]: Number(e.target.value) }))}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {saved == null ? 'Default (5)' : 'Configured'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

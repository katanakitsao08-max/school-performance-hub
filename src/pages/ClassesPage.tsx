import { useState, useMemo } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { Plus, Users } from 'lucide-react';
import { LEVEL_ORDER, LEVEL_LABELS, type SchoolLevel } from '@/lib/grade-levels';

/**
 * Unified Academic › Classes page.
 * Lets admins create a class (grade + stream) in one place. If the stream name does
 * not exist for the school it is created; existing data is respected and never
 * duplicated. Optionally moves un-streamed learners in that grade into the new stream.
 */
export default function ClassesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useAuth();
  const grades = useSchoolGrades();

  const [grade, setGrade] = useState<string>('');
  const [streamName, setStreamName] = useState('');
  const [level, setLevel] = useState<SchoolLevel>('primary');
  const [assignUnstreamed, setAssignUnstreamed] = useState(false);

  const { data: streams = [] } = useQuery({
    queryKey: ['streams', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('*').eq('school_id', schoolId!).order('name');
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Count learners per (grade, stream) so we can render the "classes in use" table.
  const { data: learnerCounts = [] } = useQuery({
    queryKey: ['class-counts', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('learners')
        .select('grade, stream')
        .eq('school_id', schoolId!)
        .eq('is_active', true);
      const map = new Map<string, { grade: string; stream: string; count: number }>();
      (data || []).forEach((l: any) => {
        const g = l.grade || '-';
        const s = l.stream || '-';
        const k = `${g}::${s}`;
        const ex = map.get(k);
        if (ex) ex.count++;
        else map.set(k, { grade: g, stream: s, count: 1 });
      });
      return Array.from(map.values()).sort((a, b) =>
        a.grade.localeCompare(b.grade, undefined, { numeric: true }) || a.stream.localeCompare(b.stream),
      );
    },
    enabled: !!schoolId,
  });

  const streamNames = useMemo(() => new Set(streams.map((s: any) => s.name)), [streams]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!grade) throw new Error('Pick a grade');
      const cleaned = streamName.trim();
      if (!cleaned) throw new Error('Enter a stream name');

      // 1) Ensure the stream exists (idempotent — works with current shared-streams model).
      if (!streamNames.has(cleaned)) {
        const { error } = await supabase
          .from('streams')
          .insert({ name: cleaned, school_id: schoolId, level } as any);
        if (error && (error as any).code !== '23505') throw error;
      }

      // 2) Optionally pull un-streamed active learners in this grade into the new stream.
      let moved = 0;
      if (assignUnstreamed) {
        const { data: targets, error: selErr } = await supabase
          .from('learners')
          .select('id')
          .eq('school_id', schoolId!)
          .eq('grade', grade)
          .eq('is_active', true)
          .or('stream.is.null,stream.eq.');
        if (selErr) throw selErr;
        const ids = (targets || []).map((t: any) => t.id);
        if (ids.length > 0) {
          const { error: updErr } = await supabase
            .from('learners')
            .update({ stream: cleaned })
            .in('id', ids);
          if (updErr) throw updErr;
          moved = ids.length;
        }
      }
      return { moved, cleaned };
    },
    onSuccess: ({ moved, cleaned }) => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['class-counts'] });
      queryClient.invalidateQueries({ queryKey: ['school-streams'] });
      toast({
        title: `Class Grade ${grade} ${cleaned} ready`,
        description: moved > 0 ? `${moved} un-streamed learner(s) assigned.` : 'Stream is now available across the system.',
      });
      setStreamName('');
      setAssignUnstreamed(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!schoolId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="p-8 text-center max-w-md">
            <CardContent>
              <p className="text-destructive font-semibold">No school assigned to your account.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Classes</h1>
          <p className="text-muted-foreground">
            Create a class (grade + stream) in one place — e.g. <span className="font-semibold">Grade 1 B</span> or <span className="font-semibold">Grade 8 East</span>.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Add a class</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
            >
              <div className="space-y-1">
                <Label>Grade</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                  <SelectContent>{grades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Stream name</Label>
                <Input value={streamName} onChange={e => setStreamName(e.target.value)} placeholder="e.g. B, East, Blue" />
              </div>
              <div className="space-y-1">
                <Label>School section</Label>
                <Select value={level} onValueChange={(v) => setLevel(v as SchoolLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVEL_ORDER.map(l => <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving…' : 'Create class'}
              </Button>
              <label className="md:col-span-4 flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={assignUnstreamed}
                  onChange={e => setAssignUnstreamed(e.target.checked)}
                />
                Also move active learners in this grade with no stream into this class
              </label>
            </form>
            <p className="text-xs text-muted-foreground mt-3">
              Streams are shared across grades. Creating a class here adds the stream (if new) and immediately
              makes it selectable on Learners, Marks Entry, Attendance and Reports.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Classes in use</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Stream</TableHead>
                  <TableHead className="text-right">Active learners</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {learnerCounts.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No classes in use yet.</TableCell></TableRow>
                )}
                {learnerCounts.map((c) => (
                  <TableRow key={`${c.grade}-${c.stream}`}>
                    <TableCell className="font-medium">Grade {c.grade} {c.stream}</TableCell>
                    <TableCell>{c.grade}</TableCell>
                    <TableCell>{c.stream}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">{c.count}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

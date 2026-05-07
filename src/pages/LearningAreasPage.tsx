import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { formatGradeLabel, getGradeLevel } from '@/lib/grade-levels';

// CBC default learning areas per grade group
// Note: Religious Education is split — learners take EITHER CRE (Christian) OR IRE (Islamic)
const CBC_DEFAULTS: Record<string, string[]> = {
  'ecde': ['LANGUAGE ACTIVITIES', 'MATHEMATICAL ACTIVITIES', 'ENVIRONMENTAL ACTIVITIES', 'PSYCHOMOTOR & CREATIVE ACTIVITIES', 'CRE ACTIVITIES', 'IRE ACTIVITIES'],
  'lower': ['ENGLISH', 'KISWAHILI', 'MATHEMATICS', 'ENVIRONMENTAL ACTIVITIES', 'CREATIVE ARTS', 'CRE', 'IRE'],
  'upper': ['ENGLISH', 'KISWAHILI', 'MATHEMATICS', 'INTEGRATED SCIENCE', 'AGRICULTURE', 'CRE', 'IRE', 'SOCIAL STUDIES', 'CREATIVE ARTS'],
  'jss': ['ENGLISH', 'KISWAHILI', 'MATHEMATICS', 'INTEGRATED SCIENCE', 'AGRICULTURE', 'CRE', 'IRE', 'SOCIAL STUDIES', 'CREATIVE ARTS', 'PRE-TECHNICAL STUDIES'],
};

function getGradeGroup(grade: string): 'ecde' | 'lower' | 'upper' | 'jss' {
  if (getGradeLevel(grade) === 'ecde') return 'ecde';
  const num = parseInt(grade, 10);
  if (num >= 7) return 'jss';
  if (num >= 4) return 'upper';
  return 'lower';
}

export default function LearningAreasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useAuth();
  const schoolGrades = useSchoolGrades();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [form, setForm] = useState({ name: '', grade: '', max_score: 100 });
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  const { data: areas = [] } = useQuery({
    queryKey: ['learning-areas', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('learning_areas')
        .select('*')
        .eq('school_id', schoolId!)
        .order('grade')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  const filteredAreas = filterGrade === 'all'
    ? areas
    : areas.filter((a: any) => a.grade === filterGrade);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from('learning_areas').update(form).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('learning_areas').insert({ ...form, school_id: schoolId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-areas'] });
      toast({ title: editing ? 'Updated' : 'Created' });
      setOpen(false);
      setEditing(null);
      setForm({ name: '', grade: '', max_score: 100 });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('learning_areas').update({ is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-areas'] });
      toast({ title: 'Status updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('learning_areas').delete().eq('id', id);
      if (error) {
        if (error.message.includes('violates foreign key')) {
          throw new Error('Cannot delete: scores exist for this learning area. Deactivate it instead.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-areas'] });
      toast({ title: 'Deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleEdit = (area: any) => {
    setEditing(area);
    setForm({ name: area.name, grade: area.grade, max_score: area.max_score });
    setOpen(true);
  };

  const handleLoadDefaults = async () => {
    if (!schoolId) return;
    setLoadingDefaults(true);
    try {
      const existingNames = new Set(areas.map((a: any) => `${a.grade}::${a.name.toUpperCase()}`));
      const toInsert: { name: string; grade: string; max_score: number; school_id: string }[] = [];

      for (const grade of schoolGrades) {
        const group = getGradeGroup(grade);
        const defaults = CBC_DEFAULTS[group];
        for (const subject of defaults) {
          const key = `${grade}::${subject}`;
          if (!existingNames.has(key)) {
            toInsert.push({ name: subject, grade, max_score: 100, school_id: schoolId });
          }
        }
      }

      if (toInsert.length === 0) {
        toast({ title: 'All default subjects already exist for your grades.' });
        setLoadingDefaults(false);
        return;
      }

      const { error } = await supabase.from('learning_areas').insert(toInsert);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['learning-areas'] });
      toast({ title: `${toInsert.length} default subjects added across ${schoolGrades.length} grades.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingDefaults(false);
    }
  };

  const defaultGrade = schoolGrades.length > 0 ? schoolGrades[0] : '1';

  if (!schoolId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="p-8 text-center max-w-md">
            <CardContent>
              <p className="text-destructive font-semibold">No school assigned to your account.</p>
              <p className="text-muted-foreground mt-2">Please contact the Super Admin to assign you to a school.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Learning Areas</h1>
            <p className="text-muted-foreground">Manage subjects per grade</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter by grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {schoolGrades.map(g => (
                  <SelectItem key={g} value={g}>{formatGradeLabel(g)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={loadingDefaults}>
                  <Wand2 className="mr-2 h-4 w-4" />
                  {loadingDefaults ? 'Loading...' : 'Load CBC Defaults'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Load CBC Default Subjects?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will add the standard CBC learning areas for all your configured grades:
                    <br /><br />
                    <strong>PP1 / PP2 (ECDE):</strong> Language, Mathematical, Environmental, Psychomotor & Creative, Religious Education Activities
                    <br /><br />
                    <strong>Grade 1–3:</strong> English, Kiswahili, Mathematics, Environmental Activities, Creative Arts, Religious Education
                    <br /><br />
                    <strong>Grade 4–6:</strong> English, Kiswahili, Mathematics, Integrated Science, Agriculture, Religious Education, Social Studies, Creative Arts
                    <br /><br />
                    <strong>Grade 7–9:</strong> Same as Grade 4–6 + Pre-Technical Studies
                    <br /><br />
                    Existing subjects will not be duplicated. All subjects remain fully editable.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLoadDefaults}>Load Defaults</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({ name: '', grade: '', max_score: 100 }); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => setForm(f => ({ ...f, grade: f.grade || defaultGrade }))}>
                  <Plus className="mr-2 h-4 w-4" /> Add Subject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Learning Area</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Subject Name</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Grade</Label>
                    <Select value={form.grade} onValueChange={v => setForm(f => ({ ...f, grade: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                      <SelectContent>
                        {schoolGrades.map(g => <SelectItem key={g} value={g}>{formatGradeLabel(g)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Score</Label>
                    <Input type="number" value={form.max_score} onChange={e => setForm(f => ({ ...f, max_score: Number(e.target.value) }))} required min={1} />
                  </div>
                  <Button type="submit" className="w-full" disabled={!form.grade || !form.name}>
                    {editing ? 'Update' : 'Create'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Max Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAreas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No learning areas found. Click "Load CBC Defaults" to get started.
                    </TableCell>
                  </TableRow>
                )}
                {filteredAreas.map((area: any) => (
                  <TableRow key={area.id} className={!area.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{area.name}</TableCell>
                    <TableCell>{formatGradeLabel(area.grade)}</TableCell>
                    <TableCell>{area.max_score}</TableCell>
                    <TableCell>
                      <Badge variant={area.is_active ? 'default' : 'secondary'}>
                        {area.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={area.is_active ? 'Deactivate' : 'Activate'}
                        onClick={() => toggleActiveMutation.mutate({ id: area.id, is_active: !area.is_active })}
                      >
                        {area.is_active
                          ? <ToggleRight className="h-4 w-4 text-primary" />
                          : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        }
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(area)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {area.name}?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone. If scores exist, deactivate instead.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(area.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
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

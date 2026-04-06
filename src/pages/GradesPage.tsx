import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function GradesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useAuth();
  const [newGrade, setNewGrade] = useState('');

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['school-grades', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('school_settings')
        .select('*')
        .eq('key', 'available_grades')
        .eq('school_id', schoolId!)
        .maybeSingle();
      if (data?.value) {
        try { return JSON.parse(data.value) as string[]; } catch { return []; }
      }
      return [];
    },
    enabled: !!schoolId,
  });

  const saveMutation = useMutation({
    mutationFn: async (updatedGrades: string[]) => {
      const value = JSON.stringify(updatedGrades);
      // Upsert: try update first, insert if not exists
      const { data: existing } = await supabase
        .from('school_settings')
        .select('id')
        .eq('key', 'available_grades')
        .eq('school_id', schoolId!)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('school_settings')
          .update({ value })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('school_settings')
          .insert({ key: 'available_grades', value, school_id: schoolId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-grades'] });
      toast({ title: 'Grades updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleAdd = () => {
    const trimmed = newGrade.trim();
    if (!trimmed) return;
    if (grades.includes(trimmed)) {
      toast({ title: 'Grade already exists', variant: 'destructive' });
      return;
    }
    const updated = [...grades, trimmed].sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    saveMutation.mutate(updated);
    setNewGrade('');
  };

  const handleDelete = (grade: string) => {
    saveMutation.mutate(grades.filter(g => g !== grade));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Grades</h1>
          <p className="text-muted-foreground">Manage grade levels for your school</p>
        </div>

        <Card>
          <CardContent className="p-4">
            <form onSubmit={e => { e.preventDefault(); handleAdd(); }} className="flex gap-3 items-end">
              <div className="space-y-1 flex-1 max-w-[200px]">
                <Label className="text-xs">Grade Level</Label>
                <Input
                  value={newGrade}
                  onChange={e => setNewGrade(e.target.value)}
                  placeholder="e.g. 1, 2, PP1"
                />
              </div>
              <Button type="submit" disabled={saveMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" /> Add Grade
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade Level</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map(g => (
                  <TableRow key={g}>
                    <TableCell className="font-medium">Grade {g}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Grade {g}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This won't delete learners in this grade, just removes it from the available list.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(g)}>Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {grades.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                      {isLoading ? 'Loading...' : 'No grades configured. Add grade levels above.'}
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

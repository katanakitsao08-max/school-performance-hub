import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowUpCircle, AlertTriangle } from 'lucide-react';
import { getNextGrade } from '@/lib/cbc-utils';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function PromotionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useAuth();
  const dynamicGrades = useSchoolGrades();
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: learners = [] } = useQuery({
    queryKey: ['learners-promotion', selectedGrade],
    queryFn: async () => {
      const { data } = await supabase.from('learners').select('*')
        .eq('grade', selectedGrade).eq('is_active', true).order('full_name');
      return data || [];
    },
  });

  const nextGrade = getNextGrade(selectedGrade);

  const promoteMutation = useMutation({
    mutationFn: async () => {
      if (!nextGrade && selectedGrade !== '9') return;

      for (const learner of learners) {
        const toGrade = selectedGrade === '9' ? 'Completed' : nextGrade!;
        
        // Log promotion
        await supabase.from('promotion_log').insert({
          learner_id: learner.id,
          from_grade: selectedGrade,
          to_grade: toGrade,
          year: selectedYear,
          school_id: schoolId,
        });

        if (selectedGrade === '9') {
          // Mark as inactive (alumni)
          await supabase.from('learners').update({
            is_active: false,
            academic_year: selectedYear + 1,
          }).eq('id', learner.id);
        } else {
          // Promote to next grade
          await supabase.from('learners').update({
            grade: nextGrade!,
            academic_year: selectedYear + 1,
          }).eq('id', learner.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learners'] });
      toast({ title: 'Promotion Complete', description: `${learners.length} learners promoted successfully` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Learner Promotion</h1>
          <p className="text-muted-foreground">Promote learners to the next grade at year-end</p>
        </div>

        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="text-xs text-muted-foreground">From Grade</label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Grade" /></SelectTrigger>
              <SelectContent>{dynamicGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowUpCircle className="h-5 w-5" />
            <span className="font-medium">
              {selectedGrade === '9' ? 'Completed / Alumni' : nextGrade ? `Grade ${nextGrade}` : '-'}
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Grade {selectedGrade} Learners ({learners.length})</CardTitle>
            <CardDescription>
              {selectedGrade === '9'
                ? 'These learners will be marked as completed (Alumni)'
                : `These learners will be promoted to Grade ${nextGrade}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Adm No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Stream</TableHead>
                  <TableHead>Current Grade</TableHead>
                  <TableHead>New Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {learners.map((l, i) => (
                  <TableRow key={l.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{l.admission_number}</TableCell>
                    <TableCell className="font-medium">{l.full_name}</TableCell>
                    <TableCell>{l.stream}</TableCell>
                    <TableCell><Badge variant="secondary">Grade {selectedGrade}</Badge></TableCell>
                    <TableCell><Badge>{selectedGrade === '9' ? 'Completed' : `Grade ${nextGrade}`}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {learners.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full">
                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                    Promote All {learners.length} Learners
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-warning" /> Confirm Promotion
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will promote {learners.length} learners from Grade {selectedGrade} to{' '}
                      {selectedGrade === '9' ? 'Completed status' : `Grade ${nextGrade}`}.
                      This action cannot be easily undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => promoteMutation.mutate()}>
                      {promoteMutation.isPending ? 'Promoting...' : 'Confirm Promotion'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, CalendarDays, Archive, CheckCircle2 } from 'lucide-react';
import { useAcademicYears } from '@/hooks/use-academic-years';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function AcademicYearsPage() {
  const { data: years = [], isLoading } = useAcademicYears();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newYear, setNewYear] = useState<string>(String(new Date().getFullYear() + 1));
  const [saving, setSaving] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['academic-years'] });

  const handleAdd = async () => {
    const y = Number(newYear);
    if (!y || y < 2000 || y > 2100) {
      toast({ title: 'Enter a valid year', variant: 'destructive' });
      return;
    }
    if (years.some(x => x.year === y)) {
      toast({ title: 'Year already exists', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('academic_years' as any)
      .insert({ year: y, status: 'closed', is_current: false } as any);
    setSaving(false);
    if (error) { toast({ title: 'Failed to add', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Academic year ${y} added` });
    setOpen(false);
    refresh();
  };

  const activate = async (id: string, year: number) => {
    const { error } = await supabase
      .from('academic_years' as any)
      .update({ status: 'active', is_current: true } as any)
      .eq('id', id);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${year} is now the active academic year` });
    refresh();
  };

  const archive = async (id: string, year: number) => {
    const { error } = await supabase
      .from('academic_years' as any)
      .update({ status: 'archived', is_current: false } as any)
      .eq('id', id);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${year} archived` });
    refresh();
  };

  const close = async (id: string, year: number) => {
    const { error } = await supabase
      .from('academic_years' as any)
      .update({ status: 'closed', is_current: false } as any)
      .eq('id', id);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${year} closed` });
    refresh();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" /> Academic Years
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage academic years so PerformTrack keeps learner records year-by-year.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Year
          </Button>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">All Academic Years</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : years.length === 0 ? (
              <p className="text-sm text-muted-foreground">No academic years yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {years.map(y => (
                    <TableRow key={y.id}>
                      <TableCell className="font-semibold">{y.year}</TableCell>
                      <TableCell>
                        <Badge variant={y.status === 'active' ? 'default' : y.status === 'archived' ? 'outline' : 'secondary'}>
                          {y.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {y.is_current ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {!y.is_current && y.status !== 'archived' && (
                          <Button size="sm" variant="outline" onClick={() => activate(y.id, y.year)}>
                            Activate
                          </Button>
                        )}
                        {y.status === 'active' && !y.is_current && (
                          <Button size="sm" variant="ghost" onClick={() => close(y.id, y.year)}>
                            Close
                          </Button>
                        )}
                        {y.status !== 'archived' && !y.is_current && (
                          <Button size="sm" variant="ghost" onClick={() => archive(y.id, y.year)}>
                            <Archive className="h-3 w-3 mr-1" /> Archive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Academic Year</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">Year</label>
              <Input type="number" value={newYear} onChange={e => setNewYear(e.target.value)} placeholder="e.g. 2027" />
              <p className="text-xs text-muted-foreground">
                New years are added as <strong>Closed</strong>. Activate one to make it the current academic year — only one year can be current at a time.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>{saving ? 'Adding...' : 'Add Year'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

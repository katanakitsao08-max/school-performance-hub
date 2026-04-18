import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SchoolLevel, LEVEL_LABELS, LEVEL_ORDER } from '@/lib/grade-levels';

export default function StreamsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useAuth();
  const [activeLevel, setActiveLevel] = useState<SchoolLevel>('primary');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState('');
  const [dialogLevel, setDialogLevel] = useState<SchoolLevel>('primary');

  const { data: streams = [] } = useQuery({
    queryKey: ['streams', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('streams').select('*').eq('school_id', schoolId!).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  const grouped: Record<SchoolLevel, any[]> = { ecde: [], primary: [], junior: [] };
  streams.forEach((s: any) => {
    const lvl = (s.level as SchoolLevel) || 'primary';
    if (grouped[lvl]) grouped[lvl].push(s);
    else grouped.primary.push(s);
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from('streams').update({ name, level: dialogLevel } as any).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('streams').insert({ name, school_id: schoolId, level: dialogLevel } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      toast({ title: editing ? 'Stream updated' : 'Stream created' });
      setOpen(false);
      setEditing(null);
      setName('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('streams').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      toast({ title: 'Stream deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleEdit = (stream: any) => {
    setEditing(stream);
    setName(stream.name);
    setDialogLevel((stream.level as SchoolLevel) || 'primary');
    setOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setName('');
    setDialogLevel(activeLevel);
    setOpen(true);
  };

  if (!schoolId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="p-8 text-center max-w-md">
            <CardContent>
              <p className="text-destructive font-semibold">No school assigned to your account.</p>
              <p className="text-muted-foreground mt-2">Please contact the Super Admin to assign you to a school before managing streams.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Streams</h1>
            <p className="text-muted-foreground">Manage streams grouped by school section</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setName(''); } }}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Stream</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Stream</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>School Section</Label>
                  <div className="flex gap-2 flex-wrap">
                    {LEVEL_ORDER.map(lvl => (
                      <Button
                        key={lvl}
                        type="button"
                        variant={dialogLevel === lvl ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDialogLevel(lvl)}
                      >
                        {LEVEL_LABELS[lvl]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Stream Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. A, B, East" required />
                </div>
                <Button type="submit" className="w-full">{editing ? 'Update' : 'Create'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeLevel} onValueChange={(v) => setActiveLevel(v as SchoolLevel)}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            {LEVEL_ORDER.map(lvl => (
              <TabsTrigger key={lvl} value={lvl}>
                {LEVEL_LABELS[lvl]}
                <Badge variant="secondary" className="ml-2">{grouped[lvl].length}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {LEVEL_ORDER.map(lvl => (
            <TabsContent key={lvl} value={lvl}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stream Name</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grouped[lvl].map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete stream "{s.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>This cannot be undone. Learners using this stream won't be affected.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(s.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                      {grouped[lvl].length === 0 && (
                        <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No {LEVEL_LABELS[lvl]} streams yet. Click "Add Stream".</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

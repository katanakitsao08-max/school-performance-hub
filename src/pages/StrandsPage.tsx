import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { Plus, Edit, Trash2, ChevronRight, Layers, GitBranch } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function StrandsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useAuth();
  const schoolGrades = useSchoolGrades();

  const [filterGrade, setFilterGrade] = useState<string>(schoolGrades[0] || '');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [strandOpen, setStrandOpen] = useState(false);
  const [subStrandOpen, setSubStrandOpen] = useState(false);
  const [editingStrand, setEditingStrand] = useState<any>(null);
  const [editingSubStrand, setEditingSubStrand] = useState<any>(null);
  const [strandForm, setStrandForm] = useState({ name: '', learning_area_id: '', sort_order: 0 });
  const [subStrandForm, setSubStrandForm] = useState({ name: '', strand_id: '', sort_order: 0 });
  const [expandedStrands, setExpandedStrands] = useState<Set<string>>(new Set());

  // Fetch learning areas for this grade
  const { data: subjects = [] } = useQuery({
    queryKey: ['learning-areas', filterGrade, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('*')
        .eq('grade', filterGrade).eq('school_id', schoolId!).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!filterGrade && !!schoolId,
  });

  // Fetch strands
  const { data: strands = [] } = useQuery({
    queryKey: ['strands', schoolId, filterGrade],
    queryFn: async () => {
      const subjectIds = subjects.map(s => s.id);
      if (!subjectIds.length) return [];
      const { data } = await supabase.from('strands').select('*')
        .in('learning_area_id', subjectIds).eq('school_id', schoolId!).order('sort_order');
      return data || [];
    },
    enabled: subjects.length > 0 && !!schoolId,
  });

  // Fetch sub-strands
  const strandIds = strands.map(s => s.id);
  const { data: subStrands = [] } = useQuery({
    queryKey: ['sub-strands', strandIds],
    queryFn: async () => {
      if (!strandIds.length) return [];
      const { data } = await supabase.from('sub_strands').select('*')
        .in('strand_id', strandIds).order('sort_order');
      return data || [];
    },
    enabled: strandIds.length > 0,
  });

  const filteredStrands = useMemo(() => {
    if (filterSubject === 'all') return strands;
    return strands.filter(s => s.learning_area_id === filterSubject);
  }, [strands, filterSubject]);

  // Mutations
  const saveStrandMutation = useMutation({
    mutationFn: async () => {
      if (editingStrand) {
        const { error } = await supabase.from('strands').update({ name: strandForm.name, sort_order: strandForm.sort_order }).eq('id', editingStrand.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('strands').insert({ ...strandForm, school_id: schoolId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strands'] });
      toast({ title: editingStrand ? 'Strand updated' : 'Strand created' });
      setStrandOpen(false);
      setEditingStrand(null);
      setStrandForm({ name: '', learning_area_id: '', sort_order: 0 });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteStrandMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('strands').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strands'] });
      queryClient.invalidateQueries({ queryKey: ['sub-strands'] });
      toast({ title: 'Strand deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveSubStrandMutation = useMutation({
    mutationFn: async () => {
      if (editingSubStrand) {
        const { error } = await supabase.from('sub_strands').update({ name: subStrandForm.name, sort_order: subStrandForm.sort_order }).eq('id', editingSubStrand.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sub_strands').insert(subStrandForm);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-strands'] });
      toast({ title: editingSubStrand ? 'Sub-strand updated' : 'Sub-strand created' });
      setSubStrandOpen(false);
      setEditingSubStrand(null);
      setSubStrandForm({ name: '', strand_id: '', sort_order: 0 });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteSubStrandMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sub_strands').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-strands'] });
      toast({ title: 'Sub-strand deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || 'Unknown';
  const getStrandSubStrands = (strandId: string) => subStrands.filter(ss => ss.strand_id === strandId);

  const toggleExpand = (id: string) => {
    setExpandedStrands(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!schoolId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="p-8 text-center max-w-md">
            <CardContent><p className="text-destructive font-semibold">No school assigned.</p></CardContent>
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
            <h1 className="text-2xl font-display font-bold">Strands & Sub-Strands</h1>
            <p className="text-muted-foreground">Manage CBC strands per subject</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterGrade} onValueChange={v => { setFilterGrade(v); setFilterSubject('all'); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Grade" /></SelectTrigger>
              <SelectContent>{schoolGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Add Strand Dialog */}
            <Dialog open={strandOpen} onOpenChange={v => { setStrandOpen(v); if (!v) { setEditingStrand(null); setStrandForm({ name: '', learning_area_id: '', sort_order: 0 }); } }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Strand</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingStrand ? 'Edit' : 'Add'} Strand</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); saveStrandMutation.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={strandForm.learning_area_id} onValueChange={v => setStrandForm(f => ({ ...f, learning_area_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Strand Name</Label>
                    <Input value={strandForm.name} onChange={e => setStrandForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Numbers" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Sort Order</Label>
                    <Input type="number" value={strandForm.sort_order} onChange={e => setStrandForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
                  </div>
                  <Button type="submit" className="w-full" disabled={!strandForm.name || !strandForm.learning_area_id}>
                    {editingStrand ? 'Update' : 'Create'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Strands List */}
        <Card>
          <CardContent className="p-0">
            {filteredStrands.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No strands found. Add strands for your subjects above.</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredStrands.map(strand => {
                  const subs = getStrandSubStrands(strand.id);
                  const isExpanded = expandedStrands.has(strand.id);
                  return (
                    <Collapsible key={strand.id} open={isExpanded} onOpenChange={() => toggleExpand(strand.id)}>
                      <div className="flex items-center justify-between p-3 hover:bg-muted/30">
                        <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          <Layers className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{strand.name}</span>
                          <Badge variant="outline" className="text-[10px]">{getSubjectName(strand.learning_area_id)}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{subs.length} sub-strand{subs.length !== 1 ? 's' : ''}</Badge>
                        </CollapsibleTrigger>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditingStrand(strand);
                            setStrandForm({ name: strand.name, learning_area_id: strand.learning_area_id, sort_order: strand.sort_order });
                            setStrandOpen(true);
                          }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete strand "{strand.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>This will also delete all sub-strands and scores.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteStrandMutation.mutate(strand.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="pl-10 pr-3 pb-3 space-y-1">
                          {subs.map(ss => (
                            <div key={ss.id} className="flex items-center justify-between py-1.5 px-3 bg-muted/20 rounded text-sm">
                              <div className="flex items-center gap-2">
                                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{ss.name}</span>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                  setEditingSubStrand(ss);
                                  setSubStrandForm({ name: ss.name, strand_id: ss.strand_id, sort_order: ss.sort_order });
                                  setSubStrandOpen(true);
                                }}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubStrandMutation.mutate(ss.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 mt-1"
                            onClick={() => {
                              setSubStrandForm({ name: '', strand_id: strand.id, sort_order: subs.length });
                              setSubStrandOpen(true);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add Sub-Strand
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sub-Strand Dialog */}
        <Dialog open={subStrandOpen} onOpenChange={v => { setSubStrandOpen(v); if (!v) { setEditingSubStrand(null); setSubStrandForm({ name: '', strand_id: '', sort_order: 0 }); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingSubStrand ? 'Edit' : 'Add'} Sub-Strand</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveSubStrandMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Sub-Strand Name</Label>
                <Input value={subStrandForm.name} onChange={e => setSubStrandForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Whole Numbers" required />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={subStrandForm.sort_order} onChange={e => setSubStrandForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
              <Button type="submit" className="w-full" disabled={!subStrandForm.name}>
                {editingSubStrand ? 'Update' : 'Create'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

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
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { GRADES } from '@/lib/cbc-utils';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import BulkUploadDialog from '@/components/BulkUploadDialog';

export default function LearnersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role, profile, schoolId } = useAuth();
  const assignedGrades = profile?.assigned_grades || [];
  const assignedStreams = profile?.assigned_streams || [];
  const availableGrades = role === 'teacher' ? assignedGrades.filter(g => GRADES.includes(g)) : GRADES;
  const isAdmin = role === 'admin';

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState(role === 'teacher' ? (availableGrades[0] || 'all') : 'all');
  const [filterStream, setFilterStream] = useState(role === 'teacher' && assignedStreams.length > 0 ? assignedStreams[0] : 'all');
  const [form, setForm] = useState({
    admission_number: '', full_name: '', grade: availableGrades[0] || '1', stream: (role === 'teacher' && assignedStreams.length > 0 ? assignedStreams[0] : 'A'),
    parent_name: '', parent_phone: '', academic_year: new Date().getFullYear(),
  });

  const { data: school } = useQuery({
    queryKey: ['school-info', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: allLearnerAdms = [] } = useQuery({
    queryKey: ['learners-adm-count', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data } = await supabase.from('learners').select('admission_number').eq('school_id', schoolId);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const generateAdmNumber = () => {
    if (!school?.school_name) return '';
    const words = school.school_name.trim().split(/\s+/);
    const prefix = words.length === 1 ? words[0].substring(0, 3).toUpperCase() : words.map(w => w[0]).join('').toUpperCase().substring(0, 4);
    const existingNums = allLearnerAdms
      .map(l => { const m = l.admission_number.match(new RegExp(`^${prefix}-(\\d+)$`)); return m ? parseInt(m[1]) : 0; })
      .filter(n => n > 0);
    const next = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
    return `${prefix}-${String(next).padStart(4, '0')}`;
  };

  const { data: learners = [] } = useQuery({
    queryKey: ['learners', filterGrade, filterStream],
    queryFn: async () => {
      let q = supabase.from('learners').select('*').eq('is_active', true).order('grade').order('full_name');
      if (filterGrade !== 'all') q = q.eq('grade', filterGrade);
      if (filterStream !== 'all') q = q.eq('stream', filterStream);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allStreams = [] } = useQuery({
    queryKey: ['streams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('streams').select('name').order('name');
      if (error) throw error;
      return (data || []).map((s: any) => s.name as string);
    },
  });

  const availableStreams = role === 'teacher' && assignedStreams.length > 0 ? allStreams.filter(s => assignedStreams.includes(s)) : allStreams;

  const filtered = learners.filter(l =>
    l.full_name.toLowerCase().includes(search.toLowerCase()) ||
    l.admission_number.toLowerCase().includes(search.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from('learners').update(form).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('learners').insert({ ...form, school_id: schoolId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learners'] });
      toast({ title: editing ? 'Updated' : 'Created' });
      setOpen(false);
      setEditing(null);
      resetForm();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('learners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learners'] });
      toast({ title: 'Deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const resetForm = () => setForm({
    admission_number: '', full_name: '', grade: availableGrades[0] || '1', stream: availableStreams[0] || 'A',
    parent_name: '', parent_phone: '', academic_year: new Date().getFullYear(),
  });

  const handleEdit = (l: any) => {
    setEditing(l);
    setForm({
      admission_number: l.admission_number, full_name: l.full_name,
      grade: l.grade, stream: l.stream,
      parent_name: l.parent_name || '', parent_phone: l.parent_phone || '',
      academic_year: l.academic_year,
    });
    setOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Learners</h1>
            <p className="text-muted-foreground">Manage student records</p>
          </div>
          <div className="flex gap-2">
            <BulkUploadDialog availableGrades={availableGrades} availableStreams={availableStreams} />
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); resetForm(); } }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Add Learner</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Learner</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); if (!editing && !form.admission_number) { setForm(f => ({ ...f, admission_number: generateAdmNumber() })); } saveMutation.mutate(); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Admission No. <span className="text-xs text-muted-foreground">(auto-generated if empty)</span></Label>
                      <Input value={form.admission_number} onChange={e => setForm(f => ({ ...f, admission_number: e.target.value }))} placeholder={generateAdmNumber() || 'Auto-generated'} />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Grade</Label>
                    <Select value={form.grade} onValueChange={v => setForm(f => ({ ...f, grade: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{availableGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Stream</Label>
                    <Select value={form.stream} onValueChange={v => setForm(f => ({ ...f, stream: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{availableStreams.map((s: string) => <SelectItem key={s} value={s}>Stream {s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Parent Name</Label>
                    <Input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Parent Phone</Label>
                    <Input value={form.parent_phone} onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} placeholder="+254..." />
                  </div>
                </div>
                <Button type="submit" className="w-full">{editing ? 'Update' : 'Create'}</Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search learners..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterGrade} onValueChange={(v) => { setFilterGrade(v); setFilterStream('all'); }}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Grades" /></SelectTrigger>
            <SelectContent>
              {role !== 'teacher' && <SelectItem value="all">All Grades</SelectItem>}
              {availableGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStream} onValueChange={setFilterStream}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Streams" /></SelectTrigger>
            <SelectContent>
              {role !== 'teacher' && <SelectItem value="all">All Streams</SelectItem>}
              {availableStreams.map(s => <SelectItem key={s} value={s}>Stream {s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adm No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Stream</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{l.admission_number}</TableCell>
                    <TableCell className="font-medium">{l.full_name}</TableCell>
                    <TableCell>Grade {l.grade}</TableCell>
                    <TableCell>{l.stream}</TableCell>
                    <TableCell>{l.parent_name || '-'}</TableCell>
                    <TableCell>{l.parent_phone || '-'}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(l)}><Edit className="h-4 w-4" /></Button>
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {l.full_name}?</AlertDialogTitle>
                              <AlertDialogDescription>This will also delete all their scores.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(l.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No learners found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

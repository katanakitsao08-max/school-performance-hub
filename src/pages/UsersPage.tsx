import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, Trash2, Edit } from 'lucide-react';
import { GRADES } from '@/lib/cbc-utils';
import { Checkbox } from '@/components/ui/checkbox';

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'teacher' as 'admin' | 'teacher' | 'headteacher',
    assigned_grades: [] as string[],
    assigned_streams: [] as string[],
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-profiles'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      const { data: roles } = await supabase.from('user_roles').select('*');
      return (profiles || []).map(p => ({
        ...p,
        role: roles?.find(r => r.user_id === p.user_id)?.role || 'unknown',
      }));
    },
  });

  const { data: dbStreams = [] } = useQuery({
    queryKey: ['streams'],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name').order('name');
      return (data || []).map((s: any) => s.name);
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      // Sign up user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      // Assign role
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: form.role,
      });
      if (roleError) throw roleError;

      // Update profile with assigned grades/streams
      const { error: profileError } = await supabase.from('profiles').update({
        assigned_grades: form.assigned_grades,
        assigned_streams: form.assigned_streams,
      }).eq('user_id', authData.user.id);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-profiles'] });
      toast({ title: 'User created successfully' });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateUser = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      await supabase.from('profiles').update({
        full_name: form.full_name,
        assigned_grades: form.assigned_grades,
        assigned_streams: form.assigned_streams,
      }).eq('user_id', editingUser.user_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-profiles'] });
      toast({ title: 'User updated successfully' });
      setEditingUser(null);
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setForm({ email: '', password: '', full_name: '', role: 'teacher', assigned_grades: [], assigned_streams: [] });
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setForm({
      email: '',
      password: '',
      full_name: user.full_name,
      role: user.role,
      assigned_grades: user.assigned_grades || [],
      assigned_streams: user.assigned_streams || [],
    });
    setOpen(true);
  };

  const toggleGrade = (grade: string) => {
    setForm(f => ({
      ...f,
      assigned_grades: f.assigned_grades.includes(grade)
        ? f.assigned_grades.filter(g => g !== grade)
        : [...f.assigned_grades, grade],
    }));
  };

  const toggleStream = (stream: string) => {
    setForm(f => ({
      ...f,
      assigned_streams: f.assigned_streams.includes(stream)
        ? f.assigned_streams.filter(s => s !== stream)
        : [...f.assigned_streams, stream],
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">User Management</h1>
            <p className="text-muted-foreground">Add and manage teachers and staff</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingUser(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add User</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); editingUser ? updateUser.mutate() : createUser.mutate(); }}
                className="space-y-4"
              >
                {!editingUser && (
                  <>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
                </div>
                {!editingUser && (
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="headteacher">Headteacher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Assigned Grades</Label>
                  <div className="flex flex-wrap gap-2">
                    {GRADES.map(g => (
                      <label key={g} className="flex items-center gap-1.5 text-sm">
                        <Checkbox checked={form.assigned_grades.includes(g)} onCheckedChange={() => toggleGrade(g)} />
                        Grade {g}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assigned Streams</Label>
                  <div className="flex flex-wrap gap-2">
                    {STREAMS.map(s => (
                      <label key={s} className="flex items-center gap-1.5 text-sm">
                        <Checkbox checked={form.assigned_streams.includes(s)} onCheckedChange={() => toggleStream(s)} />
                        Stream {s}
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  {editingUser ? 'Update User' : 'Create User'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned Grades</TableHead>
                  <TableHead>Streams</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{user.role}</Badge></TableCell>
                    <TableCell>{(user.assigned_grades || []).map(g => `G${g}`).join(', ') || '-'}</TableCell>
                    <TableCell>{(user.assigned_streams || []).join(', ') || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

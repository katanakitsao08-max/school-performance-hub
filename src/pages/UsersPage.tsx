import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, KeyRound } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, schoolId } = useAuth();
  const schoolGrades = useSchoolGrades();
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'teacher' as 'admin' | 'teacher' | 'headteacher',
    assigned_grades: [] as string[],
    assigned_streams: [] as string[],
    assigned_learning_areas: [] as string[],
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
    enabled: !!user,
  });

  const { data: dbStreams = [] } = useQuery({
    queryKey: ['streams', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name').eq('school_id', schoolId!).order('name');
      return (data || []).map((s: any) => s.name as string);
    },
    enabled: !!schoolId,
  });

  const { data: allLearningAreas = [] } = useQuery({
    queryKey: ['all-learning-areas'],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('name').order('name');
      const unique = [...new Set((data || []).map((s: any) => s.name as string))];
      return unique;
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const email = form.username.includes('@')
        ? form.username
        : `${form.username.toLowerCase().replace(/\s+/g, '')}@school.local`;

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email, password: form.password, full_name: form.full_name, role: form.role },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      await supabase.from('profiles').update({
        assigned_grades: form.assigned_grades,
        assigned_streams: form.assigned_streams,
        assigned_learning_areas: form.assigned_learning_areas,
      }).eq('user_id', data.user_id);
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
        assigned_learning_areas: form.assigned_learning_areas,
      }).eq('user_id', editingUser.user_id);

      if (form.role !== editingUser.role) {
        await supabase.from('user_roles').update({
          role: form.role,
        }).eq('user_id', editingUser.user_id);
      }
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

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-profiles'] });
      toast({ title: 'User deleted successfully' });
      setDeletingUser(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setDeletingUser(null);
    },
  });

  const resetUserPassword = useMutation({
    mutationFn: async () => {
      if (!resetPasswordUser || !newPassword) return;
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { user_id: resetPasswordUser.user_id, new_password: newPassword },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: 'Password reset successfully' });
      setResetPasswordUser(null);
      setNewPassword('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setForm({ username: '', password: '', full_name: '', role: 'teacher', assigned_grades: [], assigned_streams: [], assigned_learning_areas: [] });
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setForm({
      username: '',
      password: '',
      full_name: user.full_name,
      role: user.role,
      assigned_grades: user.assigned_grades || [],
      assigned_streams: user.assigned_streams || [],
      assigned_learning_areas: user.assigned_learning_areas || [],
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

  const toggleLearningArea = (area: string) => {
    setForm(f => ({
      ...f,
      assigned_learning_areas: f.assigned_learning_areas.includes(area)
        ? f.assigned_learning_areas.filter(a => a !== area)
        : [...f.assigned_learning_areas, area],
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
                      <Label>Username or Email</Label>
                      <Input
                        value={form.username}
                        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                        placeholder="e.g. jdoe or user@email.com"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter a simple username (no email needed) or a full email address
                      </p>
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
                    {dbStreams.map(s => (
                      <label key={s} className="flex items-center gap-1.5 text-sm">
                        <Checkbox checked={form.assigned_streams.includes(s)} onCheckedChange={() => toggleStream(s)} />
                        Stream {s}
                      </label>
                    ))}
                  </div>
                </div>
                {form.role === 'teacher' && (
                  <div className="space-y-2">
                    <Label>Assigned Subjects</Label>
                    <p className="text-xs text-muted-foreground">
                      Leave empty for class teacher (all subjects). Select specific subjects for subject teacher.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {allLearningAreas.map(a => (
                        <label key={a} className="flex items-center gap-1.5 text-sm">
                          <Checkbox checked={form.assigned_learning_areas.includes(a)} onCheckedChange={() => toggleLearningArea(a)} />
                          {a}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={createUser.isPending || updateUser.isPending}>
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
                  <TableHead>Subjects</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{u.role}</Badge></TableCell>
                    <TableCell>{(u.assigned_grades || []).map((g: string) => `G${g}`).join(', ') || '-'}</TableCell>
                    <TableCell>{(u.assigned_streams || []).join(', ') || '-'}</TableCell>
                    <TableCell>
                      {(u.assigned_learning_areas || []).length > 0
                        ? (u.assigned_learning_areas || []).join(', ')
                        : u.role === 'teacher' ? <span className="text-muted-foreground italic">Class Teacher (All)</span> : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(u)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setResetPasswordUser(u); setNewPassword(''); }} title="Reset Password">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingUser(u)} className="text-destructive hover:text-destructive" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Delete User Dialog */}
        <AlertDialog open={!!deletingUser} onOpenChange={(v) => { if (!v) setDeletingUser(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deletingUser?.full_name}</strong>? This action cannot be undone and will remove all their data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingUser && deleteUser.mutate(deletingUser.user_id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteUser.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reset Password Dialog */}
        <Dialog open={!!resetPasswordUser} onOpenChange={(v) => { if (!v) { setResetPasswordUser(null); setNewPassword(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password for {resetPasswordUser?.full_name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); resetUserPassword.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter new password (min 6 chars)"
                />
              </div>
              <Button type="submit" className="w-full" disabled={resetUserPassword.isPending}>
                {resetUserPassword.isPending ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

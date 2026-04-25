import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit, Building2, Users, GraduationCap, Search, UserPlus, Shield, RefreshCw, Ban, CheckCircle, Crown } from 'lucide-react';

export default function ManageSchoolsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    school_name: '',
    county: '',
    contact_email: '',
    contact_phone: '',
    subscription_status: 'trial' as string,
  });

  const [adminForm, setAdminForm] = useState({ username: '', password: '', full_name: '' });
  const [showAdminForm, setShowAdminForm] = useState(false);

  // Dialog for assigning admin to existing school
  const [adminDialog, setAdminDialog] = useState(false);
  const [adminTarget, setAdminTarget] = useState<any>(null);
  const [assignAdminForm, setAssignAdminForm] = useState({ username: '', password: '', full_name: '' });
  const [adminMode, setAdminMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingUser, setSelectedExistingUser] = useState('');

  // Plan dialog state
  const [planDialog, setPlanDialog] = useState(false);
  const [planTarget, setPlanTarget] = useState<any>(null);
  const [planForm, setPlanForm] = useState<{ plan_id: string; plan_expires_at: string }>({ plan_id: '', plan_expires_at: '' });

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['all-schools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('*, plan:subscription_plans(id, name, features)')
        .order('school_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: schoolStats = {} } = useQuery({
    queryKey: ['school-stats'],
    queryFn: async () => {
      const stats: Record<string, { teachers: number; learners: number }> = {};
      const { data: profiles } = await supabase.from('profiles').select('school_id');
      const { data: learners } = await supabase.from('learners').select('school_id').eq('is_active', true);
      (profiles || []).forEach(p => {
        if (!p.school_id) return;
        if (!stats[p.school_id]) stats[p.school_id] = { teachers: 0, learners: 0 };
        stats[p.school_id].teachers++;
      });
      (learners || []).forEach(l => {
        if (!l.school_id) return;
        if (!stats[l.school_id]) stats[l.school_id] = { teachers: 0, learners: 0 };
        stats[l.school_id].learners++;
      });
      return stats;
    },
    enabled: !!user,
  });

  // Fetch school admins
  const { data: schoolAdmins = {} } = useQuery({
    queryKey: ['school-admins'],
    queryFn: async () => {
      const adminMap: Record<string, { full_name: string; user_id: string }[]> = {};
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').eq('role', 'admin');
      if (!roles || roles.length === 0) return adminMap;
      const adminUserIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, school_id').in('user_id', adminUserIds);
      (profiles || []).forEach(p => {
        if (!p.school_id) return;
        if (!adminMap[p.school_id]) adminMap[p.school_id] = [];
        adminMap[p.school_id].push({ full_name: p.full_name, user_id: p.user_id });
      });
      return adminMap;
    },
    enabled: !!user,
  });

  // Fetch all users (non-super_admin) for existing user assignment
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-for-assign'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, school_id');
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const roleMap: Record<string, string> = {};
      (roles || []).forEach(r => { roleMap[r.user_id] = r.role; });
      return (profiles || []).map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        school_id: p.school_id,
        role: roleMap[p.user_id] || 'unknown',
      })).filter(u => u.role !== 'super_admin');
    },
    enabled: !!user,
  });

  const filtered = schools.filter(s =>
    s.school_name.toLowerCase().includes(search.toLowerCase()) ||
    s.school_code.toLowerCase().includes(search.toLowerCase()) ||
    s.county.toLowerCase().includes(search.toLowerCase())
  );

  const createSchool = useMutation({
    mutationFn: async () => {
      let adminEmail = '';
      if (showAdminForm && adminForm.username && adminForm.password && adminForm.full_name) {
        adminEmail = adminForm.username.includes('@')
          ? adminForm.username
          : `${adminForm.username.toLowerCase().replace(/\s+/g, '')}@school.local`;
      }
      const { data: codeData, error: codeError } = await supabase.rpc('generate_school_code');
      if (codeError) throw codeError;
      const schoolData = {
        school_name: form.school_name,
        school_code: codeData as string,
        county: form.county,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        subscription_status: form.subscription_status,
      };
      const { data: school, error } = await supabase.from('schools').insert(schoolData).select().single();
      if (error) throw error;
      if (adminEmail) {
        const { data: userData, error: userError } = await supabase.functions.invoke('create-user', {
          body: { email: adminEmail, password: adminForm.password, full_name: adminForm.full_name, role: 'admin', school_id: school.id },
        });
        if (userError || !userData?.success) {
          const errMsg = userData?.error || userError?.message || 'Failed to create admin';
          await supabase.from('schools').delete().eq('id', school.id);
          throw new Error(`School admin error: ${errMsg}`);
        }
      }
      return school;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-schools'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      queryClient.invalidateQueries({ queryKey: ['school-admins'] });
      toast({ title: 'School created successfully' });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateSchool = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from('schools').update({
        school_name: form.school_name,
        county: form.county,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        subscription_status: form.subscription_status,
      }).eq('id', editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-schools'] });
      toast({ title: 'School updated successfully' });
      setOpen(false);
      setEditing(null);
      resetForm();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const assignAdmin = useMutation({
    mutationFn: async () => {
      if (!adminTarget) return;

      if (adminMode === 'existing' && selectedExistingUser) {
        // Reassign existing user to this school as admin
        const { error: profileErr } = await supabase.from('profiles')
          .update({ school_id: adminTarget.id })
          .eq('user_id', selectedExistingUser);
        if (profileErr) throw profileErr;

        // Upsert role to admin
        const { data: existingRole } = await supabase.from('user_roles')
          .select('id').eq('user_id', selectedExistingUser).maybeSingle();
        if (existingRole) {
          const { error: roleErr } = await supabase.from('user_roles')
            .update({ role: 'admin' as any }).eq('user_id', selectedExistingUser);
          if (roleErr) throw roleErr;
        } else {
          const { error: roleErr } = await supabase.from('user_roles')
            .insert({ user_id: selectedExistingUser, role: 'admin' as any });
          if (roleErr) throw roleErr;
        }
        return;
      }

      // Create new user
      const email = assignAdminForm.username.includes('@')
        ? assignAdminForm.username
        : `${assignAdminForm.username.toLowerCase().replace(/\s+/g, '')}@school.local`;

      const { data: userData, error: userError } = await supabase.functions.invoke('create-user', {
        body: { email, password: assignAdminForm.password, full_name: assignAdminForm.full_name, role: 'admin', school_id: adminTarget.id },
      });
      if (userError || !userData?.success) {
        throw new Error(userData?.error || userError?.message || 'Failed to create admin');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-admins'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      queryClient.invalidateQueries({ queryKey: ['all-users-for-assign'] });
      toast({ title: 'School admin assigned successfully' });
      setAdminDialog(false);
      setAdminTarget(null);
      setAssignAdminForm({ username: '', password: '', full_name: '' });
      setSelectedExistingUser('');
      setAdminMode('new');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Regenerate school code
  const regenerateCode = useMutation({
    mutationFn: async (schoolId: string) => {
      const { data: newCode, error: codeErr } = await supabase.rpc('generate_school_code');
      if (codeErr) throw codeErr;
      const { error } = await supabase.from('schools').update({ school_code: newCode as string }).eq('id', schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-schools'] });
      toast({ title: 'School code regenerated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Revoke / activate license
  const toggleLicense = useMutation({
    mutationFn: async ({ schoolId, newStatus }: { schoolId: string; newStatus: string }) => {
      const { error } = await supabase.from('schools').update({ subscription_status: newStatus }).eq('id', schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-schools'] });
      toast({ title: 'Subscription updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Assign / update plan + expiry (Super Admin only)
  const updatePlan = useMutation({
    mutationFn: async () => {
      if (!planTarget) return;
      const payload: any = { plan_id: planForm.plan_id || null };
      payload.plan_expires_at = planForm.plan_expires_at ? new Date(planForm.plan_expires_at).toISOString() : null;
      const { error } = await supabase.from('schools').update(payload).eq('id', planTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-schools'] });
      toast({ title: 'Plan updated' });
      setPlanDialog(false);
      setPlanTarget(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleAssignPlan = (school: any) => {
    setPlanTarget(school);
    setPlanForm({
      plan_id: school.plan?.id || school.plan_id || '',
      plan_expires_at: school.plan_expires_at ? school.plan_expires_at.slice(0, 10) : '',
    });
    setPlanDialog(true);
  };

  const resetForm = () => {
    setForm({ school_name: '', county: '', contact_email: '', contact_phone: '', subscription_status: 'trial' });
    setAdminForm({ username: '', password: '', full_name: '' });
    setShowAdminForm(false);
  };

  const handleEdit = (school: any) => {
    setEditing(school);
    setForm({
      school_name: school.school_name,
      county: school.county,
      contact_email: school.contact_email,
      contact_phone: school.contact_phone,
      subscription_status: school.subscription_status,
    });
    setOpen(true);
  };

  const handleAssignAdmin = (school: any) => {
    setAdminTarget(school);
    setAssignAdminForm({ username: '', password: '', full_name: '' });
    setSelectedExistingUser('');
    setAdminMode('new');
    setAdminDialog(true);
  };

  const statusColor = (status: string) => {
    if (status === 'active') return 'bg-success/10 text-success border-success/20';
    if (status === 'trial') return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-destructive/10 text-destructive border-destructive/20';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Manage Schools</h1>
            <p className="text-muted-foreground">Register and manage schools on the platform</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add School</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit School' : 'Register New School'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); editing ? updateSchool.mutate() : createSchool.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>School Name</Label>
                  <Input value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} required placeholder="e.g. Sunrise Academy" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>County</Label>
                    <Input value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))} placeholder="e.g. Nairobi" />
                  </div>
                  <div className="space-y-2">
                    <Label>Subscription</Label>
                    <Select value={form.subscription_status} onValueChange={v => setForm(f => ({ ...f, subscription_status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="admin@school.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+254..." />
                  </div>
                </div>

                {!editing && (
                  <div className="border-t pt-4">
                    <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
                      <input type="checkbox" checked={showAdminForm} onChange={e => setShowAdminForm(e.target.checked)} className="rounded" />
                      Assign a School Admin now
                    </label>
                    {showAdminForm && (
                      <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                        <div className="space-y-2">
                          <Label>Admin Username/Email</Label>
                          <Input value={adminForm.username} onChange={e => setAdminForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. admin1" />
                        </div>
                        <div className="space-y-2">
                          <Label>Admin Password</Label>
                          <Input type="password" value={adminForm.password} onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))} minLength={6} />
                        </div>
                        <div className="space-y-2">
                          <Label>Admin Full Name</Label>
                          <Input value={adminForm.full_name} onChange={e => setAdminForm(f => ({ ...f, full_name: e.target.value }))} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={createSchool.isPending || updateSchool.isPending}>
                  {editing ? 'Update School' : 'Register School'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Assign Plan Dialog (Super Admin only) */}
        <Dialog open={planDialog} onOpenChange={(v) => { setPlanDialog(v); if (!v) setPlanTarget(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Subscription Plan – {planTarget?.school_name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); updatePlan.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={planForm.plan_id} onValueChange={v => setPlanForm(f => ({ ...f, plan_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choose a plan..." /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.price_monthly > 0 ? `– KES ${p.price_monthly}/mo` : '(Free)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plan Expiry Date</Label>
                <Input type="date" value={planForm.plan_expires_at} onChange={e => setPlanForm(f => ({ ...f, plan_expires_at: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Leave blank for no expiry. After this date the school auto-falls back to the Free plan features.</p>
              </div>
              {planForm.plan_id && (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                  <p className="font-medium text-foreground mb-1">Included features:</p>
                  {Object.entries((plans.find((p: any) => p.id === planForm.plan_id)?.features || {}) as Record<string, any>).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="font-mono">{typeof v === 'boolean' ? (v ? '✓' : '—') : String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={updatePlan.isPending || !planForm.plan_id}>
                <Crown className="mr-2 h-4 w-4" /> Save Plan
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Assign Admin Dialog */}
        <Dialog open={adminDialog} onOpenChange={(v) => { setAdminDialog(v); if (!v) { setAdminTarget(null); setAdminMode('new'); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Admin to {adminTarget?.school_name}</DialogTitle>
            </DialogHeader>
            {/* Show existing admins */}
            {adminTarget && (schoolAdmins[adminTarget.id] || []).length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Current Admin(s)</Label>
                <div className="space-y-1">
                  {(schoolAdmins[adminTarget.id] || []).map((a: any) => (
                    <div key={a.user_id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">{a.full_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Tabs value={adminMode} onValueChange={(v) => setAdminMode(v as 'new' | 'existing')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="new">Create New User</TabsTrigger>
                <TabsTrigger value="existing">Select Existing User</TabsTrigger>
              </TabsList>

              <TabsContent value="new">
                <form onSubmit={(e) => { e.preventDefault(); assignAdmin.mutate(); }} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Username/Email</Label>
                    <Input value={assignAdminForm.username} onChange={e => setAssignAdminForm(f => ({ ...f, username: e.target.value }))} required placeholder="e.g. admin2" />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={assignAdminForm.password} onChange={e => setAssignAdminForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={assignAdminForm.full_name} onChange={e => setAssignAdminForm(f => ({ ...f, full_name: e.target.value }))} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={assignAdmin.isPending}>
                    <UserPlus className="mr-2 h-4 w-4" /> Create & Assign Admin
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="existing">
                <form onSubmit={(e) => { e.preventDefault(); assignAdmin.mutate(); }} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Select User</Label>
                    <Select value={selectedExistingUser} onValueChange={setSelectedExistingUser}>
                      <SelectTrigger><SelectValue placeholder="Choose a user..." /></SelectTrigger>
                      <SelectContent>
                        {allUsers.map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.full_name} <span className="text-muted-foreground text-xs">({u.role})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedExistingUser && (
                      <p className="text-xs text-muted-foreground">
                        This user will be reassigned to <strong>{adminTarget?.school_name}</strong> with admin role.
                      </p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={assignAdmin.isPending || !selectedExistingUser}>
                    <Shield className="mr-2 h-4 w-4" /> Assign as Admin
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search schools..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>County</TableHead>
                  <TableHead>Admin(s)</TableHead>
                  <TableHead className="text-center">Staff</TableHead>
                  <TableHead className="text-center">Learners</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(school => {
                  const stats = schoolStats[school.id] || { teachers: 0, learners: 0 };
                  const admins = schoolAdmins[school.id] || [];
                  return (
                    <TableRow key={school.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                          <div>
                            <p className="font-medium">{school.school_name}</p>
                            <p className="text-xs text-muted-foreground">{school.contact_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{school.school_code}</code></TableCell>
                      <TableCell>{school.county || '-'}</TableCell>
                      <TableCell>
                        {admins.length > 0 ? (
                          <div className="space-y-0.5">
                            {admins.map((a: any) => (
                              <p key={a.user_id} className="text-sm font-medium">{a.full_name}</p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No admin</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{stats.teachers}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{stats.learners}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${statusColor(school.subscription_status)}`}>
                          {school.subscription_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(school)} title="Edit school">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleAssignAdmin(school)} title="Assign admin">
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => regenerateCode.mutate(school.id)}
                            disabled={regenerateCode.isPending}
                            title="Regenerate school code"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          {school.subscription_status === 'expired' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleLicense.mutate({ schoolId: school.id, newStatus: 'active' })}
                              disabled={toggleLicense.isPending}
                              title="Activate license"
                            >
                              <CheckCircle className="h-4 w-4 text-success" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleLicense.mutate({ schoolId: school.id, newStatus: 'expired' })}
                              disabled={toggleLicense.isPending}
                              title="Revoke license"
                            >
                              <Ban className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No schools found
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

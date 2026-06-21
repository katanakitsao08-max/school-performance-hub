import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { Plus, Trash2, BookOpen, UserCheck, Wand2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useSearchParams, Link } from 'react-router-dom';

export default function TeacherAssignmentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useAuth();
  const schoolGrades = useSchoolGrades();

  // Subject assignment form state
  const [selTeacher, setSelTeacher] = useState('');
  const [selGrade, setSelGrade] = useState('');
  const [selStream, setSelStream] = useState('');
  const [selSubject, setSelSubject] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Class teacher form state
  const [ctTeacher, setCtTeacher] = useState('');
  const [ctGrade, setCtGrade] = useState('');
  const [ctStream, setCtStream] = useState('');
  const [deletingCtId, setDeletingCtId] = useState<string | null>(null);

  // Fetch teachers (profiles with teacher role in this school)
  const { data: teachers = [] } = useQuery({
    queryKey: ['school-teachers', schoolId],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('school_id', schoolId!);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');
      // Admins and Headteachers can also be assigned subjects/classes (they often teach too)
      const teacherIds = new Set(
        (roles || []).filter(r => r.role === 'teacher' || r.role === 'headteacher' || r.role === 'admin').map(r => r.user_id)
      );
      return (profiles || []).filter(p => teacherIds.has(p.user_id));
    },
    enabled: !!schoolId,
  });

  const { data: streams = [] } = useQuery({
    queryKey: ['streams', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name').eq('school_id', schoolId!).order('name');
      return (data || []).map((s: any) => s.name as string);
    },
    enabled: !!schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['learning-areas-by-grade', selGrade, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('id, name')
        .eq('grade', selGrade).eq('is_active', true).eq('school_id', schoolId!).order('name');
      return data || [];
    },
    enabled: !!selGrade && !!schoolId,
  });

  // Fetch all teacher assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['teacher-assignments', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('teacher_assignments')
        .select('id, teacher_id, grade, stream, learning_area_id, learning_areas(name)')
        .eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Fetch class teacher assignments
  const { data: classTeachers = [] } = useQuery({
    queryKey: ['class-teachers', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('class_teachers')
        .select('id, teacher_id, grade, stream')
        .eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const getTeacherName = (id: string) => teachers.find(t => t.user_id === id)?.full_name || 'Unknown';

  // Add subject assignment
  const addAssignment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('teacher_assignments').insert({
        teacher_id: selTeacher,
        grade: selGrade,
        stream: selStream,
        learning_area_id: selSubject,
        school_id: schoolId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      toast({ title: 'Subject assignment added' });
      setSelSubject('');
    },
    onError: (e: any) => {
      const msg = e.message?.includes('duplicate') ? 'This assignment already exists' : e.message;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teacher_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      toast({ title: 'Assignment removed' });
      setDeletingId(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Add class teacher
  const addClassTeacher = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('class_teachers').upsert({
        teacher_id: ctTeacher,
        grade: ctGrade,
        stream: ctStream,
        school_id: schoolId!,
      }, { onConflict: 'grade,stream,school_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-teachers'] });
      toast({ title: 'Class teacher assigned' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const removeClassTeacher = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('class_teachers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-teachers'] });
      toast({ title: 'Class teacher removed' });
      setDeletingCtId(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Group assignments by teacher for display
  const grouped = useMemo(() => {
    const map = new Map<string, typeof assignments>();
    assignments.forEach(a => {
      const arr = map.get(a.teacher_id) || [];
      arr.push(a);
      map.set(a.teacher_id, arr);
    });
    return Array.from(map.entries()).map(([tid, items]) => ({
      teacherId: tid,
      teacherName: getTeacherName(tid),
      assignments: items,
    }));
  }, [assignments, teachers]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Teacher Assignments</h1>
          <p className="text-muted-foreground">Assign teachers to specific subjects, classes, and class teacher roles</p>
        </div>

        <Tabs defaultValue="subjects">
          <TabsList>
            <TabsTrigger value="subjects" className="gap-2"><BookOpen className="h-4 w-4" /> Subject Assignments</TabsTrigger>
            <TabsTrigger value="class-teacher" className="gap-2"><UserCheck className="h-4 w-4" /> Class Teachers</TabsTrigger>
          </TabsList>

          {/* ---- SUBJECT ASSIGNMENTS TAB ---- */}
          <TabsContent value="subjects" className="space-y-6 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Assign Subject to Teacher</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Teacher</Label>
                    <Select value={selTeacher} onValueChange={setSelTeacher}>
                      <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                      <SelectContent>
                        {teachers.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Grade</Label>
                    <Select value={selGrade} onValueChange={v => { setSelGrade(v); setSelSubject(''); }}>
                      <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
                      <SelectContent>
                        {schoolGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stream</Label>
                    <Select value={selStream} onValueChange={setSelStream}>
                      <SelectTrigger><SelectValue placeholder="Stream" /></SelectTrigger>
                      <SelectContent>
                        {streams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Subject</Label>
                    <Select value={selSubject} onValueChange={setSelSubject} disabled={!selGrade}>
                      <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => addAssignment.mutate()}
                    disabled={!selTeacher || !selGrade || !selStream || !selSubject || addAssignment.isPending}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Assign
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Assignments list grouped by teacher */}
            {grouped.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No subject assignments yet. Use the form above to assign teachers.</CardContent></Card>
            ) : grouped.map(g => (
              <Card key={g.teacherId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{g.teacherName}</Badge>
                    <span className="text-xs text-muted-foreground">{g.assignments.length} assignment(s)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grade</TableHead>
                        <TableHead>Stream</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.assignments.map(a => (
                        <TableRow key={a.id}>
                          <TableCell>Grade {a.grade}</TableCell>
                          <TableCell>{a.stream}</TableCell>
                          <TableCell>{(a as any).learning_areas?.name || '-'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingId(a.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ---- CLASS TEACHERS TAB ---- */}
          <TabsContent value="class-teacher" className="space-y-6 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Assign Class Teacher</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Teacher</Label>
                    <Select value={ctTeacher} onValueChange={setCtTeacher}>
                      <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                      <SelectContent>
                        {teachers.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Grade</Label>
                    <Select value={ctGrade} onValueChange={setCtGrade}>
                      <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
                      <SelectContent>
                        {schoolGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stream</Label>
                    <Select value={ctStream} onValueChange={setCtStream}>
                      <SelectTrigger><SelectValue placeholder="Stream" /></SelectTrigger>
                      <SelectContent>
                        {streams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => addClassTeacher.mutate()}
                    disabled={!ctTeacher || !ctGrade || !ctStream || addClassTeacher.isPending}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Assign
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Only one class teacher per grade+stream. Assigning a new one replaces the previous.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Stream</TableHead>
                      <TableHead className="w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classTeachers.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No class teachers assigned yet</TableCell></TableRow>
                    ) : classTeachers.map(ct => (
                      <TableRow key={ct.id}>
                        <TableCell className="font-medium">{getTeacherName(ct.teacher_id)}</TableCell>
                        <TableCell>Grade {ct.grade}</TableCell>
                        <TableCell>{ct.stream}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingCtId(ct.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete subject assignment dialog */}
        <AlertDialog open={!!deletingId} onOpenChange={v => { if (!v) setDeletingId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to remove this subject assignment?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingId && removeAssignment.mutate(deletingId)} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete class teacher dialog */}
        <AlertDialog open={!!deletingCtId} onOpenChange={v => { if (!v) setDeletingCtId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Class Teacher</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to remove this class teacher assignment?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingCtId && removeClassTeacher.mutate(deletingCtId)} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

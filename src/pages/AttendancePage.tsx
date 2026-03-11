import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { GRADES } from '@/lib/cbc-utils';
import { Save, CheckCircle2, XCircle, Clock, ShieldCheck, Users, UserCheck, UserX } from 'lucide-react';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: React.ElementType; colorClass: string }> = {
  present: { label: 'Present', icon: CheckCircle2, colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' },
  absent: { label: 'Absent', icon: XCircle, colorClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
  late: { label: 'Late', icon: Clock, colorClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
  excused: { label: 'Excused', icon: ShieldCheck, colorClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' },
};

export default function AttendancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role, profile, user } = useAuth();

  const availableGrades = role === 'teacher' ? (profile?.assigned_grades || []) : GRADES;
  const assignedStreams = profile?.assigned_streams || [];

  const [selectedGrade, setSelectedGrade] = useState(availableGrades[0] || '1');
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});

  const { data: dbStreams = [] } = useQuery({
    queryKey: ['streams'],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name').order('name');
      return (data || []).map((s: any) => s.name);
    },
  });

  const availableStreams = role === 'teacher' && assignedStreams.length > 0
    ? dbStreams.filter(s => assignedStreams.includes(s))
    : dbStreams;

  useEffect(() => {
    if (availableStreams.length > 0 && !selectedStream) {
      setSelectedStream(availableStreams[0]);
    }
  }, [availableStreams]);

  const { data: learners = [] } = useQuery({
    queryKey: ['learners', selectedGrade, selectedStream],
    queryFn: async () => {
      const { data, error } = await supabase.from('learners').select('*')
        .eq('grade', selectedGrade).eq('stream', selectedStream).eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedStream,
  });

  const { data: existingAttendance = [] } = useQuery({
    queryKey: ['attendance', selectedGrade, selectedStream, selectedDate],
    queryFn: async () => {
      const learnerIds = learners.map(l => l.id);
      if (learnerIds.length === 0) return [];
      const { data, error } = await supabase.from('attendance').select('*')
        .in('learner_id', learnerIds)
        .eq('date', selectedDate);
      if (error) throw error;
      return data || [];
    },
    enabled: learners.length > 0,
  });

  useEffect(() => {
    const map: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    learners.forEach(l => {
      const existing = existingAttendance.find((a: any) => a.learner_id === l.id);
      map[l.id] = existing
        ? { status: existing.status as AttendanceStatus, remarks: existing.remarks || '' }
        : { status: 'present', remarks: '' };
    });
    setAttendance(map);
  }, [existingAttendance, learners]);

  const setStatus = (learnerId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [learnerId]: { ...prev[learnerId], status } }));
  };

  const setRemarks = (learnerId: string, remarks: string) => {
    setAttendance(prev => ({ ...prev, [learnerId]: { ...prev[learnerId], remarks } }));
  };

  const markAll = (status: AttendanceStatus) => {
    setAttendance(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => { updated[id] = { ...updated[id], status }; });
      return updated;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const upserts = Object.entries(attendance).map(([learnerId, data]) => ({
        learner_id: learnerId,
        date: selectedDate,
        status: data.status,
        remarks: data.remarks || null,
        marked_by: user?.id,
      }));
      if (upserts.length === 0) return;
      const { error } = await supabase.from('attendance').upsert(upserts as any, {
        onConflict: 'learner_id,date',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Attendance saved successfully!' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0, total: learners.length };
    Object.values(attendance).forEach(a => { counts[a.status]++; });
    return counts;
  }, [attendance, learners]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Attendance</h1>
            <p className="text-muted-foreground text-sm">Daily attendance tracking by class</p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || learners.length === 0}>
            <Save className="mr-2 h-4 w-4" /> Save Attendance
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">Grade</Label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{availableGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stream</Label>
            <Select value={selectedStream} onValueChange={setSelectedStream}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Stream" /></SelectTrigger>
              <SelectContent>{availableStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-[160px]" />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4 flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold">{summary.present}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="p-4 flex items-center gap-3">
              <UserX className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{summary.absent}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold">{summary.late}</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => markAll('present')} className="text-emerald-700">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark All Present
          </Button>
          <Button size="sm" variant="outline" onClick={() => markAll('absent')} className="text-red-700">
            <XCircle className="mr-1 h-3.5 w-3.5" /> Mark All Absent
          </Button>
        </div>

        {/* Attendance Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead className="min-w-[180px]">Learner</TableHead>
                  <TableHead>Adm No.</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="min-w-[200px]">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {learners.map((learner, idx) => {
                  const att = attendance[learner.id];
                  if (!att) return null;
                  return (
                    <TableRow key={learner.id}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{learner.full_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{learner.admission_number}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-center flex-wrap">
                          {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map(status => {
                            const cfg = STATUS_CONFIG[status];
                            const Icon = cfg.icon;
                            const isActive = att.status === status;
                            return (
                              <button
                                key={status}
                                onClick={() => setStatus(learner.id, status)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-all
                                  ${isActive ? cfg.colorClass + ' ring-2 ring-offset-1 ring-current' : 'border-border text-muted-foreground hover:bg-muted'}`}
                              >
                                <Icon className="h-3 w-3" />
                                <span className="hidden sm:inline">{cfg.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Optional remarks..."
                          value={att.remarks}
                          onChange={e => setRemarks(learner.id, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {learners.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No learners found for this class. Select a different grade or stream.
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

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClassTeacherAssignment } from '@/hooks/use-class-teacher-assignment';
import { useToast } from '@/hooks/use-toast';
import { buildWaMeLink } from '@/lib/wa-link';
import { Users, CalendarCheck, FileText, MessageSquare, MessageCircle, ArrowRight } from 'lucide-react';

export default function ClassTeacherPortal() {
  const { schoolId } = useAuth();
  const { toast } = useToast();
  const { data: assignments = [], isLoading } = useClassTeacherAssignment();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const active = assignments[selectedIdx];

  const { data: learners = [] } = useQuery({
    queryKey: ['class-teacher-learners', active?.grade, active?.stream, schoolId],
    queryFn: async () => {
      if (!active) return [];
      const { data } = await supabase.from('learners')
        .select('id, full_name, admission_number, gender, parent_name, parent_phone, parent_phone_2')
        .eq('school_id', active.school_id)
        .eq('grade', active.grade)
        .eq('stream', active.stream)
        .eq('is_active', true)
        .order('full_name');
      return data || [];
    },
    enabled: !!active,
  });

  const { data: attendance7d = [] } = useQuery({
    queryKey: ['class-teacher-att7', active?.grade, active?.stream, schoolId],
    queryFn: async () => {
      if (!active || learners.length === 0) return [];
      const since = new Date(); since.setDate(since.getDate() - 7);
      const { data } = await supabase.from('attendance')
        .select('learner_id, status, date')
        .in('learner_id', learners.map(l => l.id))
        .gte('date', since.toISOString().slice(0, 10));
      return data || [];
    },
    enabled: !!active && learners.length > 0,
  });

  const attPct = (learnerId: string) => {
    const rows = attendance7d.filter(a => a.learner_id === learnerId);
    if (rows.length === 0) return null;
    const present = rows.filter(r => r.status === 'present').length;
    return Math.round((present / rows.length) * 100);
  };

  const sendSms = async (learnerId: string, phone: string, name: string, parentName: string | null) => {
    if (!schoolId) return;
    const message = `Hello ${parentName || 'Parent'}, this is a quick note about ${name} from your class teacher. — PerformTrack`;
    const { data, error } = await supabase.functions.invoke('send-sms-v2', {
      body: { school_id: schoolId, messages: [{ phone, message, learner_id: learnerId }] },
    });
    if (error || data?.error) {
      toast({ title: 'SMS failed', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: `SMS sent (${data.sent}/${data.sent + data.failed})` });
    }
  };

  if (isLoading) {
    return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Loading…</div></DashboardLayout>;
  }

  if (assignments.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto mt-12">
          <Card><CardContent className="p-8 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold mb-1">You are not assigned as a class teacher</h2>
            <p className="text-sm text-muted-foreground">Ask your school admin to assign you to a grade & stream in <em>Teacher Assignments</em>.</p>
          </CardContent></Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 p-1">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">My Class</h1>
            <p className="text-sm text-muted-foreground">Roster, attendance, marks and parent communication for the class you are assigned to.</p>
          </div>
          {assignments.length > 1 && (
            <Select value={String(selectedIdx)} onValueChange={v => setSelectedIdx(Number(v))}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {assignments.map((a, i) => (
                  <SelectItem key={a.id} value={String(i)}>Grade {a.grade} — {a.stream}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {active && (
          <div className="flex gap-2 text-xs">
            <Badge variant="outline">Grade {active.grade}</Badge>
            <Badge variant="outline">Stream {active.stream}</Badge>
            <Badge variant="outline">{learners.length} learners</Badge>
          </div>
        )}

        <Tabs defaultValue="roster">
          <TabsList>
            <TabsTrigger value="roster"><Users className="h-4 w-4 mr-1" /> Roster & Attendance</TabsTrigger>
            <TabsTrigger value="marks"><FileText className="h-4 w-4 mr-1" /> Marks & Reports</TabsTrigger>
            <TabsTrigger value="comms"><MessageSquare className="h-4 w-4 mr-1" /> Parent Comms</TabsTrigger>
          </TabsList>

          {/* ROSTER + ATTENDANCE */}
          <TabsContent value="roster" className="space-y-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Class Roster</CardTitle>
                  <CardDescription>Quick view with last-7-day attendance.</CardDescription>
                </div>
                <Button asChild size="sm"><Link to="/attendance"><CalendarCheck className="h-4 w-4 mr-1" /> Mark Today's Attendance</Link></Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>#</TableHead><TableHead>Adm. No.</TableHead><TableHead>Name</TableHead>
                    <TableHead>Gender</TableHead><TableHead className="text-center">Att. (7d)</TableHead>
                    <TableHead>Parent Phone</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {learners.map((l, i) => {
                      const pct = attPct(l.id);
                      return (
                        <TableRow key={l.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{l.admission_number}</TableCell>
                          <TableCell className="font-medium">{l.full_name}</TableCell>
                          <TableCell>{l.gender}</TableCell>
                          <TableCell className="text-center">
                            {pct === null ? <span className="text-muted-foreground">—</span>
                              : pct < 70 ? <Badge variant="destructive">{pct}%</Badge> : <Badge variant="outline">{pct}%</Badge>}
                          </TableCell>
                          <TableCell className="text-xs">{l.parent_phone || <span className="text-muted-foreground">—</span>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MARKS + REPORTS */}
          <TabsContent value="marks" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Marks & Report Cards</CardTitle>
                <CardDescription>Open the existing tools, pre-filtered to your class.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button asChild variant="outline" className="h-auto py-4 justify-between">
                  <Link to="/marks-entry"><span className="text-left"><div className="font-semibold">Enter / Review Marks</div><div className="text-xs text-muted-foreground">Spreadsheet for the class</div></span><ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-4 justify-between">
                  <Link to="/reports"><span className="text-left"><div className="font-semibold">Individual Report Cards</div><div className="text-xs text-muted-foreground">PDF download per learner</div></span><ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-4 justify-between">
                  <Link to="/grade-analysis"><span className="text-left"><div className="font-semibold">Class Analysis</div><div className="text-xs text-muted-foreground">Mean, top 10, bottom 10</div></span><ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PARENT COMMS */}
          <TabsContent value="comms" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Message Parents</CardTitle>
                <CardDescription>
                  SMS uses your school's allocated credits. WhatsApp opens on your phone — no credits, no setup.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Learner</TableHead><TableHead>Parent</TableHead><TableHead>Phone</TableHead>
                    <TableHead className="text-right">Send</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {learners.map(l => {
                      const phone = l.parent_phone || l.parent_phone_2 || '';
                      const waMsg = `Hello ${l.parent_name || 'Parent'}, this is a note about ${l.full_name} from your class teacher.`;
                      const wa = phone ? buildWaMeLink(phone, waMsg) : null;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.full_name}</TableCell>
                          <TableCell>{l.parent_name || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs font-mono">{phone || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button size="sm" variant="outline" disabled={!phone} onClick={() => phone && sendSms(l.id, phone, l.full_name, l.parent_name)}>
                              <MessageSquare className="h-3 w-3 mr-1" /> SMS
                            </Button>
                            <Button size="sm" variant="outline" asChild disabled={!wa}>
                              <a href={wa || '#'} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3 w-3 mr-1" /> WhatsApp</a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

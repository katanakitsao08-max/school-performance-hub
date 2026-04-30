import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, AlertTriangle } from 'lucide-react';
import { TERMS, getGradeForLevel } from '@/lib/cbc-utils';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useSchoolStreams } from '@/hooks/use-school-streams';
import { useAuth } from '@/contexts/AuthContext';

export default function SmsPage() {
  const { toast } = useToast();
  const { schoolId } = useAuth();
  const dynamicGrades = useSchoolGrades();
  const dynamicStreams = useSchoolStreams();
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedYear] = useState(new Date().getFullYear());
  const [sending, setSending] = useState(false);

  const { data: schoolMeta } = useQuery({
    queryKey: ['school-meta', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: credits } = useQuery({
    queryKey: ['school-sms-credits', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data } = await supabase.from('school_sms_credits' as any).select('*').eq('school_id', schoolId).maybeSingle();
      return data as any;
    },
    enabled: !!schoolId,
  });

  const { data: learners = [] } = useQuery({
    queryKey: ['learners', selectedGrade, selectedStream],
    queryFn: async () => {
      const { data } = await supabase.from('learners').select('*')
        .eq('grade', selectedGrade).eq('stream', selectedStream).eq('is_active', true).order('full_name');
      return data || [];
    },
    enabled: !!selectedGrade && !!selectedStream,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['learning-areas', selectedGrade],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('*').eq('grade', selectedGrade);
      return data || [];
    },
    enabled: !!selectedGrade,
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['scores', selectedGrade, selectedStream, selectedTerm, selectedYear],
    queryFn: async () => {
      const ids = learners.map(l => l.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('scores').select('*')
        .in('learner_id', ids).eq('term', selectedTerm).eq('year', selectedYear);
      return data || [];
    },
    enabled: learners.length > 0,
  });

  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((s: any) => [s.id, s])), [subjects]);

  const smsData = useMemo(() => {
    const results = learners.map((l: any) => {
      const ls = scores.filter((s: any) => s.learner_id === l.id);
      const total = ls.reduce((sum: number, sc: any) => sum + Number(sc.score || 0), 0);
      const mean = ls.length > 0 ? total / ls.length : 0;
      const avgMax = subjects.length > 0 ? subjects.reduce((s: number, sub: any) => s + sub.max_score, 0) / subjects.length : 100;
      const grade = ls.length > 0 ? getGradeForLevel(mean, avgMax, selectedGrade || l.grade || '1') : '-';
      return { ...l, scores: ls, total, mean, grade };
    }).sort((a, b) => b.total - a.total);

    return results.map((l, i) => ({ ...l, position: i + 1 }));
  }, [learners, scores, subjects, selectedGrade]);

  const buildMessage = (l: any) => {
    const subjectLines = (l.scores || []).slice(0, 8).map((s: any) => {
      const subj = subjectMap[s.learning_area_id];
      return subj ? `${subj.name}: ${Number(s.score)}` : null;
    }).filter(Boolean).join('\n');
    const points = Math.round(l.mean / 10);
    return `Dear Parent/Guardian,\n${l.full_name}${l.assessment_number ? ` (Assessment No: ${l.assessment_number})` : ''} results:\n${subjectLines}\nTotal: ${l.total}\nAverage: ${l.mean.toFixed(1)}\nPoints: ${points}\nRank: ${l.position}/${smsData.length}\n- ${schoolMeta?.school_name || 'School'}`;
  };

  const learnersWithPhone = smsData.filter(l => l.parent_phone);
  const balance = credits?.balance ?? 0;
  const enabled = credits?.enabled ?? true;
  const insufficient = balance < learnersWithPhone.length;
  const blocked = !enabled || insufficient;

  const handleBulkSend = async () => {
    if (!schoolId) return;
    if (learnersWithPhone.length === 0) {
      toast({ title: 'No phone numbers', description: 'No parents have phone numbers registered', variant: 'destructive' });
      return;
    }
    if (blocked) {
      toast({ title: 'Cannot send', description: !enabled ? 'SMS disabled by Super Admin' : `Insufficient credits. You have ${balance}, need ${learnersWithPhone.length}.`, variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-v2', {
        body: {
          school_id: schoolId,
          messages: learnersWithPhone.map(l => ({ phone: l.parent_phone, message: buildMessage(l) })),
        },
      });
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      const failed = (data as any)?.failed ?? 0;
      toast({ title: 'SMS dispatched', description: `${sent} sent, ${failed} failed` });
    } catch (error: any) {
      toast({ title: 'SMS Error', description: error?.message || 'Failed to send. Check your SMS configuration in Settings.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Parent SMS Notifications</h1>
            <p className="text-muted-foreground">Send results to parents via SMS</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">Balance: {balance}</Badge>
            <Badge variant="outline">Used: {credits?.used ?? 0}</Badge>
            {!enabled && <Badge variant="destructive">SMS Disabled</Badge>}
            <Button onClick={handleBulkSend} disabled={sending || learnersWithPhone.length === 0 || blocked}>
              <Send className="mr-2 h-4 w-4" /> {sending ? 'Sending...' : `Send to ${learnersWithPhone.length} Parents`}
            </Button>
          </div>
        </div>

        {blocked && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {!enabled ? 'SMS sending has been disabled for your school by the Super Admin.' : `Insufficient SMS credits. Balance: ${balance}, required: ${learnersWithPhone.length}. Please contact your administrator to top up.`}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4 flex-wrap">
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Grade" /></SelectTrigger>
            <SelectContent>{dynamicGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedStream} onValueChange={setSelectedStream}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Stream" /></SelectTrigger>
            <SelectContent>{dynamicStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(selectedTerm)} onValueChange={v => setSelectedTerm(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pos</TableHead>
                  <TableHead>Learner</TableHead>
                  <TableHead>Adm No.</TableHead>
                  <TableHead>Assessment No.</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Mean</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {smsData.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{l.position}</TableCell>
                    <TableCell className="font-medium">{l.full_name}</TableCell>
                    <TableCell className="text-xs">{l.admission_number || '-'}</TableCell>
                    <TableCell className="text-xs">{(l as any).assessment_number || '-'}</TableCell>
                    <TableCell className="text-xs">{l.parent_phone || <span className="text-destructive">No phone</span>}</TableCell>
                    <TableCell className="text-center">{l.mean.toFixed(1)}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline">{l.grade}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

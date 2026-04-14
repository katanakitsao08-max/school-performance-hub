import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send } from 'lucide-react';
import { TERMS, getGradeForLevel } from '@/lib/cbc-utils';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useSchoolStreams } from '@/hooks/use-school-streams';

export default function SmsPage() {
  const { toast } = useToast();
  const dynamicGrades = useSchoolGrades();
  const dynamicStreams = useSchoolStreams();
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sending, setSending] = useState(false);

  const { data: learners = [] } = useQuery({
    queryKey: ['learners', selectedGrade, selectedStream],
    queryFn: async () => {
      const { data } = await supabase.from('learners').select('*')
        .eq('grade', selectedGrade).eq('stream', selectedStream).eq('is_active', true).order('full_name');
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['learning-areas', selectedGrade],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('*').eq('grade', selectedGrade);
      return data || [];
    },
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

  const smsData = useMemo(() => {
    const results = learners.map(l => {
      const ls = scores.filter(s => s.learner_id === l.id);
      const total = ls.reduce((s, sc) => s + sc.score, 0);
      const mean = ls.length > 0 ? total / ls.length : 0;
      const avgMax = subjects.length > 0 ? subjects.reduce((s, sub) => s + sub.max_score, 0) / subjects.length : 100;
      return { ...l, total, mean, grade: ls.length > 0 ? getGrade(mean, avgMax) : '-' };
    }).sort((a, b) => b.total - a.total);

    return results.map((l, i) => ({ ...l, position: i + 1 }));
  }, [learners, scores, subjects]);

  const learnersWithPhone = smsData.filter(l => l.parent_phone);

  const handleBulkSend = async () => {
    if (learnersWithPhone.length === 0) {
      toast({ title: 'No phone numbers', description: 'No parents have phone numbers registered', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          messages: learnersWithPhone.map(l => ({
            phone: l.parent_phone,
            message: `Dear ${l.parent_name || 'Parent'}, ${l.full_name} scored a mean of ${l.mean.toFixed(1)} in Term ${selectedTerm} ${selectedYear}. Position: ${l.position}/${smsData.length}. Grade: ${l.grade}. Thank you.`,
          })),
        },
      });
      if (error) throw error;
      toast({ title: 'SMS Sent', description: `${learnersWithPhone.length} messages queued` });
    } catch (error: any) {
      toast({
        title: 'SMS Error',
        description: 'SMS sending requires Africa\'s Talking API setup. Please configure the edge function.',
        variant: 'destructive',
      });
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
          <Button onClick={handleBulkSend} disabled={sending || learnersWithPhone.length === 0}>
            <Send className="mr-2 h-4 w-4" /> {sending ? 'Sending...' : `Send to ${learnersWithPhone.length} Parents`}
          </Button>
        </div>

        <div className="flex gap-4 flex-wrap">
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Grade" /></SelectTrigger>
            <SelectContent>{dynamicGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedStream} onValueChange={setSelectedStream}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Stream" /></SelectTrigger>
            <SelectContent>{dynamicStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(selectedTerm)} onValueChange={v => setSelectedTerm(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pos</TableHead>
                  <TableHead>Learner</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Mean</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                  <TableHead>SMS Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {smsData.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{l.position}</TableCell>
                    <TableCell className="font-medium">{l.full_name}</TableCell>
                    <TableCell>{l.parent_name || '-'}</TableCell>
                    <TableCell>{l.parent_phone || <span className="text-destructive text-xs">No phone</span>}</TableCell>
                    <TableCell className="text-center">{l.mean.toFixed(1)}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline">{l.grade}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                      {l.parent_phone
                        ? `Dear ${l.parent_name || 'Parent'}, ${l.full_name} scored mean ${l.mean.toFixed(1)}, Pos ${l.position}/${smsData.length}, Grade ${l.grade}`
                        : '-'}
                    </TableCell>
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

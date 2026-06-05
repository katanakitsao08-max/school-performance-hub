import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Send, AlertTriangle, MessageSquare, Eye } from 'lucide-react';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useSchoolStreams } from '@/hooks/use-school-streams';

type Mode = 'individual' | 'class' | 'multi_class' | 'whole_school';
type TemplateKey = 'custom' | 'fees' | 'results' | 'communication' | 'updates';

const TEMPLATE_PRESETS: Record<Exclude<TemplateKey, 'custom'>, { label: string; body: string }> = {
  fees: {
    label: 'Fee Reminder',
    body: 'Dear {parent}, this is a reminder that {name} has an outstanding fee balance. Kindly clear at your earliest convenience. Thank you.',
  },
  results: {
    label: 'Results Notice',
    body: 'Dear {parent}, {name}\'s academic results are now ready. Please visit the school or contact the class teacher for details.',
  },
  communication: {
    label: 'General Communication',
    body: 'Dear {parent}, kindly note the following regarding {name}: ',
  },
  updates: {
    label: 'School Updates',
    body: 'Dear Parent, please note the following school update: ',
  },
};

function segmentsFor(msg: string): number {
  const len = (msg || '').length;
  if (len === 0) return 1;
  return len <= 160 ? 1 : Math.ceil(len / 153);
}

export default function ParentCommunicationPage() {
  const { schoolId } = useAuth();
  const { toast } = useToast();
  const grades = useSchoolGrades();
  const streams = useSchoolStreams();
  const [mode, setMode] = useState<Mode>('class');
  const [message, setMessage] = useState('');
  const [grade, setGrade] = useState('');
  const [stream, setStream] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [individual, setIndividual] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [template, setTemplate] = useState<TemplateKey>('custom');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  const { data: schoolMeta } = useQuery({
    queryKey: ['school-meta', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId!).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });
  const schoolName = schoolMeta?.school_name || 'School';
  const footer = `\n- Ref: ${schoolName} | performtrack.co.ke`;

  const { data: credits } = useQuery({
    queryKey: ['school-sms-credits', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('school_sms_credits').select('*').eq('school_id', schoolId!).maybeSingle();
      return data as any;
    },
    enabled: !!schoolId,
  });

  const { data: learners = [] } = useQuery({
    queryKey: ['comm-learners', schoolId, mode, grade, stream, selectedGrades.join(',')],
    queryFn: async () => {
      let q = supabase.from('learners').select('id, full_name, parent_phone, parent_phone_2, parent_name, grade, stream, admission_number')
        .eq('school_id', schoolId!).eq('is_active', true);
      if (mode === 'class' && grade && stream) q = q.eq('grade', grade).eq('stream', stream);
      else if (mode === 'multi_class' && selectedGrades.length > 0) q = q.in('grade', selectedGrades);
      else if (mode === 'individual') q = q.limit(50);
      const { data } = await q.order('full_name');
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['sms-logs', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sms_logs').select('*').eq('school_id', schoolId!).order('sent_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!schoolId && logsOpen,
  });

  const hasAnyPhone = (l: any) => !!(l.parent_phone || l.parent_phone_2);

  const candidateRecipients = useMemo(() => {
    if (mode === 'individual') {
      const l = learners.find(x => x.id === individual);
      return l && hasAnyPhone(l) ? [l] : [];
    }
    return learners.filter(hasAnyPhone);
  }, [learners, mode, individual]);

  const recipients = useMemo(
    () => candidateRecipients.filter(l => !excludedIds.has(l.id)),
    [candidateRecipients, excludedIds]
  );

  const toggleExcluded = (id: string) => {
    const n = new Set(excludedIds);
    n.has(id) ? n.delete(id) : n.add(id);
    setExcludedIds(n);
  };

  const personalize = (tpl: string, l: any) =>
    tpl.replace(/\{name\}/g, l.full_name).replace(/\{parent\}/g, l.parent_name || 'Parent');
  const composedMessage = (l: any) => `${personalize(message, l)}${footer}`;

  const segments = segmentsFor(message + footer);
  const totalSegments = recipients.length * segments;
  const balance = credits?.balance ?? 0;
  const enabled = credits?.enabled ?? true;
  const blocked = !enabled || totalSegments > balance;

  const filteredIndividual = useMemo(() =>
    learners.filter(l => hasAnyPhone(l) && (
      l.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (l.admission_number || '').toLowerCase().includes(search.toLowerCase())
    )).slice(0, 30),
    [learners, search]
  );

  const applyTemplate = (key: TemplateKey) => {
    setTemplate(key);
    if (key !== 'custom') setMessage(TEMPLATE_PRESETS[key].body);
  };

  const send = async () => {
    if (!schoolId) return;
    if (!message.trim()) { toast({ title: 'Message required', variant: 'destructive' }); return; }
    if (recipients.length === 0) { toast({ title: 'No recipients selected', variant: 'destructive' }); return; }
    if (blocked) {
      toast({ title: 'Cannot send', description: !enabled ? 'SMS disabled' : `Need ${totalSegments} credits, have ${balance}`, variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-v2', {
        body: {
          school_id: schoolId, type: 'CUSTOM',
          messages: recipients.map((l: any) => ({
            phone: l.parent_phone || l.parent_phone_2 || '',
            phone_alt: l.parent_phone_2 || null,
            message: composedMessage(l),
            learner_id: l.id,
          })),
        },
      });
      setLastResponse(error ? { error: error.message } : data);
      if (error) throw error;
      toast({ title: 'Sent', description: `${(data as any)?.sent ?? 0} sent, ${(data as any)?.failed ?? 0} failed` });
      setMessage('');
    } catch (e: any) {
      setLastResponse((prev: any) => prev ?? { error: e?.message || String(e) });
      toast({ title: 'Send failed', description: e?.message || String(e), variant: 'destructive' });
    } finally { setSending(false); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Parent Communication</h1>
            <p className="text-muted-foreground">Send custom SMS to parents — fee reminders, meetings, alerts</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Badge variant="outline">Balance: {balance}</Badge>
            {!enabled && <Badge variant="destructive">SMS Disabled</Badge>}
            <Button variant="outline" size="sm" onClick={() => setLogsOpen(o => !o)}>
              <Eye className="h-4 w-4 mr-1" /> {logsOpen ? 'Hide' : 'View'} Logs
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-5 w-5 text-primary" /> Compose</CardTitle>
              <CardDescription>Use {`{name}`} for learner name and {`{parent}`} for parent name.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Recipients</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid grid-cols-2 gap-2 mt-2">
                  {([['individual', 'Individual'], ['class', 'Specific class'], ['multi_class', 'Multiple grades'], ['whole_school', 'Whole school']] as [Mode, string][]).map(([v, label]) => (
                    <label key={v} className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value={v} /> <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {mode === 'class' && (
                <div className="grid grid-cols-2 gap-2">
                  <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
                    <SelectContent>{grades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={stream} onValueChange={setStream}>
                    <SelectTrigger><SelectValue placeholder="Stream" /></SelectTrigger>
                    <SelectContent>{streams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {mode === 'multi_class' && (
                <div className="grid grid-cols-3 gap-2">
                  {grades.map(g => (
                    <label key={g} className="flex items-center gap-2 border rounded-md px-2 py-2 cursor-pointer">
                      <Checkbox checked={selectedGrades.includes(g)} onCheckedChange={(c) => {
                        setSelectedGrades(prev => c ? [...prev, g] : prev.filter(x => x !== g));
                      }} />
                      <span className="text-sm">Grade {g}</span>
                    </label>
                  ))}
                </div>
              )}

              {mode === 'individual' && (
                <div className="space-y-2">
                  <Input placeholder="Search learner by name or admission no." value={search} onChange={e => setSearch(e.target.value)} />
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {filteredIndividual.map(l => (
                      <button key={l.id} onClick={() => setIndividual(l.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${individual === l.id ? 'bg-primary/10' : ''}`}>
                        <div className="font-medium">{l.full_name}</div>
                        <div className="text-xs text-muted-foreground">{l.grade} {l.stream} · {l.parent_phone}</div>
                      </button>
                    ))}
                    {filteredIndividual.length === 0 && <div className="p-3 text-sm text-muted-foreground">No learners found</div>}
                  </div>
                </div>
              )}

              <div>
                <Label>Message</Label>
                <Textarea rows={6} value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message…" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{message.length} chars · {segments} segment{segments > 1 ? 's' : ''} per recipient</span>
                  <span>Total cost: {totalSegments} credits</span>
                </div>
              </div>

              {blocked && message && recipients.length > 0 && (
                <div className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {!enabled ? 'SMS disabled by Super Admin' : `Insufficient credits (need ${totalSegments}, have ${balance})`}
                </div>
              )}

              <Button onClick={send} disabled={sending || recipients.length === 0 || !message.trim() || blocked} className="w-full">
                <Send className="h-4 w-4 mr-2" /> {sending ? 'Sending…' : `Send to ${recipients.length} parent${recipients.length === 1 ? '' : 's'}`}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>{recipients.length} recipient{recipients.length === 1 ? '' : 's'} will receive this message</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 min-h-[180px] whitespace-pre-wrap text-sm">
                {recipients[0] ? message.replace('{name}', recipients[0].full_name).replace('{parent}', recipients[0].parent_name || 'Parent') : message || <span className="text-muted-foreground">Your message preview…</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Sender ID and provider configured by Super Admin.</p>
            </CardContent>
          </Card>
        </div>

        {logsOpen && (
          <Card>
            <CardHeader><CardTitle className="text-base">Recent SMS Logs</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Time</TableHead><TableHead>Recipient</TableHead><TableHead>Message</TableHead>
                  <TableHead>Status</TableHead><TableHead>Segments</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {logs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{new Date(l.sent_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{l.recipient}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{l.message}</TableCell>
                      <TableCell><Badge variant={l.status === 'sent' ? 'default' : 'destructive'}>{l.status}</Badge></TableCell>
                      <TableCell className="text-xs">{l.segments}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No logs yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {lastResponse && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Provider API Response</CardTitle>
                <CardDescription>Raw response from Olympus SMS gateway</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLastResponse(null)}>Clear</Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap mb-2 text-xs">
                {typeof lastResponse?.sent === 'number' && <Badge variant="default">Sent: {lastResponse.sent}</Badge>}
                {typeof lastResponse?.failed === 'number' && <Badge variant={lastResponse.failed ? 'destructive' : 'secondary'}>Failed: {lastResponse.failed}</Badge>}
                {typeof lastResponse?.segments === 'number' && <Badge variant="outline">Segments: {lastResponse.segments}</Badge>}
              </div>
              <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-auto max-h-96 whitespace-pre-wrap break-all">
{JSON.stringify(lastResponse, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

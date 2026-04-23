import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Loader2, CheckCircle2, XCircle, RefreshCcw, Wifi, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeKePhone } from '@/lib/whatsapp-templates';

interface Recipient {
  learner_id: string;
  full_name: string;
  parent_name: string;
  parent_phone: string;
  grade: string;
  stream: string;
}

interface LogEntry {
  ts: string;
  recipient: string;
  name: string;
  status: 'sent' | 'failed' | 'pending' | 'skipped';
  channel?: string;
  error?: string;
}

interface Props {
  schoolId: string | null;
  schoolName: string;
}

const DEFAULT_BODY =
  '📊 {school_name} — Term Results\n\nDear {parent_name},\n\nResults for {student_name} ({grade}) are ready.\n\nPlease check the report shared.\n\n- {school_name}';

export function LiveComposerTab({ schoolId, schoolName }: Props) {
  const [scope, setScope] = useState<'school' | 'grade' | 'class'>('school');
  const [grade, setGrade] = useState('');
  const [stream, setStream] = useState('');
  const [body, setBody] = useState(DEFAULT_BODY);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ total: 0, done: 0, sent: 0, failed: 0, skipped: 0 });

  const { data: grades = [] } = useQuery({
    queryKey: ['lc-grades', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from('learners')
        .select('grade')
        .eq('school_id', schoolId!)
        .eq('is_active', true);
      return Array.from(new Set((data ?? []).map((d) => d.grade))).sort();
    },
  });

  const { data: recipients = [] } = useQuery<Recipient[]>({
    queryKey: ['lc-recipients', schoolId, scope, grade, stream],
    enabled: !!schoolId,
    queryFn: async () => {
      let q = supabase
        .from('learners')
        .select('id, full_name, parent_name, parent_phone, grade, stream')
        .eq('school_id', schoolId!)
        .eq('is_active', true);
      if (scope !== 'school' && grade) q = q.eq('grade', grade);
      if (scope === 'class' && stream) q = q.eq('stream', stream);
      const { data } = await q;
      return (data ?? []).map((l: any) => ({
        learner_id: l.id,
        full_name: l.full_name,
        parent_name: l.parent_name ?? 'Parent',
        parent_phone: l.parent_phone ?? '',
        grade: l.grade,
        stream: l.stream,
      }));
    },
  });

  const valid = useMemo(
    () => recipients.filter((r) => normalizeKePhone(r.parent_phone)),
    [recipients],
  );
  const skippedCount = recipients.length - valid.length;

  const renderMessage = (r: Recipient): string =>
    body
      .replace(/\{school_name\}/g, schoolName)
      .replace(/\{student_name\}/g, r.full_name)
      .replace(/\{parent_name\}/g, r.parent_name)
      .replace(/\{grade\}/g, `Grade ${r.grade}`);

  const append = (entry: LogEntry) => setLogs((prev) => [entry, ...prev].slice(0, 500));

  const sendOne = async (r: Recipient): Promise<'sent' | 'failed'> => {
    const msg = renderMessage(r);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send-raw', {
        body: { recipient: r.parent_phone, message: msg, learner_id: r.learner_id },
      });
      if (error || !data?.success) {
        append({
          ts: new Date().toISOString(),
          recipient: r.parent_phone,
          name: r.full_name,
          status: 'failed',
          error: data?.error ?? error?.message ?? 'failed',
        });
        return 'failed';
      }
      append({
        ts: new Date().toISOString(),
        recipient: r.parent_phone,
        name: r.full_name,
        status: 'sent',
        channel: data.channel,
      });
      return 'sent';
    } catch (e: any) {
      append({
        ts: new Date().toISOString(),
        recipient: r.parent_phone,
        name: r.full_name,
        status: 'failed',
        error: e.message ?? 'error',
      });
      return 'failed';
    }
  };

  const runQueue = async (queue: Recipient[]) => {
    setStats({ total: queue.length, done: 0, sent: 0, failed: 0, skipped: 0 });
    setRunning(true);
    setPaused(false);

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < queue.length; i++) {
      // pause loop
      while (paused) await new Promise((r) => setTimeout(r, 300));
      const r = queue[i];
      const result = await sendOne(r);
      if (result === 'sent') sent++;
      else failed++;
      setStats({ total: queue.length, done: i + 1, sent, failed, skipped: 0 });
      // 400-800ms jitter
      const delay = 400 + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, delay));
    }
    setRunning(false);
    toast.success(`Done — ${sent} sent · ${failed} failed`);
  };

  const handleStart = () => {
    if (!body.trim()) return toast.error('Message body is required');
    if (!valid.length) return toast.error('No valid recipients');
    setLogs([]);
    runQueue(valid);
  };

  const handleResendFailed = () => {
    const failedPhones = new Set(
      logs.filter((l) => l.status === 'failed').map((l) => l.recipient),
    );
    const queue = valid.filter((v) => failedPhones.has(v.parent_phone));
    if (!queue.length) return toast.error('Nothing failed to resend');
    runQueue(queue);
  };

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,420px]">
      {/* LEFT — composer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-green-600" />
            Live Composer
          </CardTitle>
          <CardDescription>
            Send personalised messages with dynamic variables: <code className="text-[10px]">{'{school_name}'}</code>{' '}
            <code className="text-[10px]">{'{student_name}'}</code>{' '}
            <code className="text-[10px]">{'{parent_name}'}</code>{' '}
            <code className="text-[10px]">{'{grade}'}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Audience</Label>
              <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">Whole school</SelectItem>
                  <SelectItem value="grade">By grade</SelectItem>
                  <SelectItem value="class">Grade + Stream</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope !== 'school' && (
              <div>
                <Label>Grade</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>
                    {grades.map((g) => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {scope === 'class' && (
              <div>
                <Label>Stream</Label>
                <Input value={stream} onChange={(e) => setStream(e.target.value)} placeholder="e.g. BLUE" />
              </div>
            )}
          </div>

          <div>
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              className="font-mono text-xs"
            />
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Audience preview</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{valid.length} valid</Badge>
                {skippedCount > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-600/40">
                    {skippedCount} skipped (no phone)
                  </Badge>
                )}
              </div>
            </div>
            {valid[0] && (
              <pre className="whitespace-pre-wrap font-mono text-[11px] bg-background rounded p-2 max-h-40 overflow-auto">
                {renderMessage(valid[0])}
              </pre>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleStart}
              disabled={running || !valid.length}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to {valid.length}
            </Button>
            {running && (
              <Button variant="outline" onClick={() => setPaused((p) => !p)} className="gap-2">
                {paused ? <><Play className="h-4 w-4" />Resume</> : <><Pause className="h-4 w-4" />Pause</>}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleResendFailed}
              disabled={running || !logs.some((l) => l.status === 'failed')}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Resend Failed
            </Button>
          </div>

          {(running || stats.total > 0) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {stats.done} / {stats.total} processed
                </span>
                <span className="font-mono">{pct}%</span>
              </div>
              <Progress value={pct} />
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded border p-2">
                  <div className="text-lg font-bold text-green-600">{stats.sent}</div>
                  <div className="text-muted-foreground uppercase tracking-wide">Sent</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-lg font-bold text-destructive">{stats.failed}</div>
                  <div className="text-muted-foreground uppercase tracking-wide">Failed</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-lg font-bold">{stats.total - stats.done}</div>
                  <div className="text-muted-foreground uppercase tracking-wide">Pending</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RIGHT — live logs + status */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-600" />
              Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Africa's Talking</span>
              <Badge className="bg-green-600 hover:bg-green-700">Connected</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Sandbox falls back to SMS automatically when WhatsApp is unavailable.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Live Log</CardTitle>
            <CardDescription className="text-xs">{logs.length} events</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[460px]">
              <ul className="divide-y text-xs">
                {logs.length === 0 && (
                  <li className="p-4 text-muted-foreground text-center">No activity yet.</li>
                )}
                {logs.map((l, i) => (
                  <li key={i} className="p-2.5 flex items-start gap-2">
                    {l.status === 'sent' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />}
                    {l.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{l.name}</span>
                        {l.channel && <Badge variant="outline" className="text-[9px] uppercase">{l.channel}</Badge>}
                      </div>
                      <div className="text-muted-foreground font-mono text-[10px] truncate">{l.recipient}</div>
                      {l.error && <div className="text-destructive text-[10px] mt-0.5">{l.error}</div>}
                      <div className="text-muted-foreground text-[10px] mt-0.5">
                        {new Date(l.ts).toLocaleTimeString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

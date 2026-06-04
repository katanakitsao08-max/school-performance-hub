import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { TERMS, getGradeForLevel, getGradePoints } from '@/lib/cbc-utils';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useSchoolStreams } from '@/hooks/use-school-streams';
import { useAuth } from '@/contexts/AuthContext';

type SmsMode = 'detailed' | 'short_link' | 'hybrid';

// Subject abbreviations (e.g. "English Language" -> "ENG")
function abbreviate(name: string): string {
  if (!name) return '';
  const cleaned = name.replace(/[^A-Za-z\s]/g, '').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.map(p => p[0]).join('').slice(0, 4).toUpperCase();
}

function genToken(): string {
  // 32-char base36 token (~165 bits entropy from 32 bytes via crypto)
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 32);
}

export default function SmsPage() {
  const { toast } = useToast();
  const { schoolId, user } = useAuth();
  const dynamicGrades = useSchoolGrades();
  const dynamicStreams = useSchoolStreams();
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedAssessment, setSelectedAssessment] = useState<'opener' | 'mid_term' | 'end_term'>('end_term');
  const [selectedYear] = useState(new Date().getFullYear());
  const [smsMode, setSmsMode] = useState<SmsMode>('hybrid');
  const [sending, setSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);

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
      const { data } = await supabase.from('school_sms_credits').select('*').eq('school_id', schoolId).maybeSingle();
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
    queryKey: ['scores', selectedGrade, selectedStream, selectedTerm, selectedYear, selectedAssessment],
    queryFn: async () => {
      const ids = learners.map(l => l.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('scores').select('*')
        .in('learner_id', ids).eq('term', selectedTerm).eq('year', selectedYear)
        .eq('assessment_type', selectedAssessment);
      return data || [];
    },
    enabled: learners.length > 0,
  });

  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((s: any) => [s.id, s])), [subjects]);

  // Dedupe scores: keep highest per (learner_id, learning_area_id) — guards against legacy duplicates
  const dedupedScores = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of scores as any[]) {
      const key = `${s.learner_id}::${s.learning_area_id}`;
      const existing = map.get(key);
      if (!existing || Number(s.score) > Number(existing.score)) map.set(key, s);
    }
    return Array.from(map.values());
  }, [scores]);

  const smsData = useMemo(() => {
    const results = learners.map((l: any) => {
      const ls = dedupedScores.filter((s: any) => s.learner_id === l.id);
      const total = ls.reduce((sum: number, sc: any) => sum + Number(sc.score || 0), 0);
      const mean = ls.length > 0 ? total / ls.length : 0;
      const avgMax = subjects.length > 0 ? subjects.reduce((s: number, sub: any) => s + sub.max_score, 0) / subjects.length : 100;
      const grade = ls.length > 0 ? getGradeForLevel(mean, avgMax, selectedGrade || l.grade || '1') : '-';
      return { ...l, scores: ls, total, mean, grade };
    }).sort((a, b) => b.total - a.total);
    return results.map((l, i) => ({ ...l, position: i + 1 }));
  }, [learners, dedupedScores, subjects, selectedGrade]);

  const schoolName = schoolMeta?.school_name || 'School';
  const footer = `Ref: ${schoolName} | performtrack.co.ke`;

  const buildDetailedMessage = (l: any): string => {
    // Final dedupe by subject name (in case two learning_area rows share a name)
    const seen = new Set<string>();
    const subjectLines = (l.scores || []).map((s: any) => {
      const subj = subjectMap[s.learning_area_id];
      if (!subj) return null;
      const key = abbreviate(subj.name);
      if (seen.has(key)) return null;
      seen.add(key);
      const score = Math.round(Number(s.score));
      const g = getGradeForLevel(score, subj.max_score, selectedGrade);
      return `${key}-${score}(${g})`;
    }).filter(Boolean).join(', ');
    const points = getGradePoints(l.grade as any) || Math.round(l.mean / 10);
    return `${l.full_name}, Grade ${l.grade} ${l.stream}\n${subjectLines}\nTOTAL: ${l.total} | AVG: ${l.mean.toFixed(2)} | GRADE: ${l.grade} | POINTS: ${points}\n- ${footer}`;
  };

  // Always use production domain in SMS links (avoid lovableproject.com previews leaking to parents)
  const rawOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const origin = /lovableproject\.com|lovable\.app|localhost|127\.0\.0\.1/i.test(rawOrigin)
    ? 'https://www.performtrack.co.ke'
    : rawOrigin;

  const buildShortLinkMessage = (l: any, url: string): string => {
    return `Hello, view results for ${l.full_name}:\n${url}\n- ${footer}`;
  };

  const buildHybridMessage = (l: any, url: string): string => {
    const points = getGradePoints(l.grade as any) || Math.round(l.mean / 10);
    return `${l.full_name}: AVG ${l.mean.toFixed(1)} GRADE ${l.grade} (${points}pts). Full results:\n${url}\n- ${footer}`;
  };

  const learnersWithPhone = smsData.filter(l => l.parent_phone || (l as any).parent_phone_2);
  const balance = credits?.balance ?? 0;
  const enabled = credits?.enabled ?? true;

  const handleBulkSend = async () => {
    if (!schoolId || !user) return;
    if (learnersWithPhone.length === 0) {
      toast({ title: 'No phone numbers', description: 'No parents have phone numbers registered', variant: 'destructive' });
      return;
    }
    if (!enabled) {
      toast({ title: 'SMS disabled', description: 'SMS sending has been disabled by the Super Admin', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      // For modes that need a portal link, generate one per learner first
      let messages: { phone: string; phone_alt?: string | null; message: string; learner_id: string }[] = [];

      if (smsMode === 'detailed') {
        messages = learnersWithPhone.map(l => ({
          phone: l.parent_phone || (l as any).parent_phone_2 || '',
          phone_alt: (l as any).parent_phone_2 || null,
          message: buildDetailedMessage(l), learner_id: l.id,
        }));
      } else {
        // generate portal_links rows in bulk
        const rows = learnersWithPhone.map(l => ({
          school_id: schoolId, learner_id: l.id,
          token: genToken(),
          term: selectedTerm, year: selectedYear, assessment_type: selectedAssessment,
          created_by: user.id,
        }));
        const { data: inserted, error } = await supabase.from('parent_portal_links')
          .insert(rows).select('learner_id, token');
        if (error) throw error;
        const tokenMap = Object.fromEntries((inserted || []).map((r: any) => [r.learner_id, r.token]));

        messages = learnersWithPhone.map(l => {
          const token = tokenMap[l.id];
          const url = `${origin}/p/${token}`;
          const msg = smsMode === 'hybrid' ? buildHybridMessage(l, url) : buildShortLinkMessage(l, url);
          return {
            phone: l.parent_phone || (l as any).parent_phone_2 || '',
            phone_alt: (l as any).parent_phone_2 || null,
            message: msg, learner_id: l.id,
          };
        });
      }

      const { data, error } = await supabase.functions.invoke('send-sms-v2', {
        body: { school_id: schoolId, type: 'RESULT', messages },
      });
      setLastResponse(error ? { error: error.message } : data);
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      const failed = (data as any)?.failed ?? 0;
      toast({ title: 'Result SMS dispatched', description: `${sent} sent, ${failed} failed` });
    } catch (error: any) {
      setLastResponse((prev: any) => prev ?? { error: error?.message || String(error) });
      toast({ title: 'SMS Error', description: error?.message || 'Failed to send.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const previewLearner = learnersWithPhone[0];
  const previewMsg = previewLearner
    ? smsMode === 'detailed'
      ? buildDetailedMessage(previewLearner)
      : smsMode === 'hybrid'
        ? buildHybridMessage(previewLearner, `${origin}/p/EXAMPLE_TOKEN_xxxxxxxxxxxx`)
        : buildShortLinkMessage(previewLearner, `${origin}/p/EXAMPLE_TOKEN_xxxxxxxxxxxx`)
    : '';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Parent Result SMS</h1>
            <p className="text-muted-foreground">Send academic results to parents — detailed text or secure portal link</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">Balance: {balance}</Badge>
            <Badge variant="outline">Used: {credits?.used ?? 0}</Badge>
            {!enabled && <Badge variant="destructive">SMS Disabled</Badge>}
            <Button onClick={handleBulkSend} disabled={sending || learnersWithPhone.length === 0 || !enabled}>
              <Send className="mr-2 h-4 w-4" /> {sending ? 'Sending...' : `Send to ${learnersWithPhone.length} Parents`}
            </Button>
          </div>
        </div>

        {!enabled && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              SMS sending has been disabled for your school by the Super Admin.
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex gap-3 flex-wrap">
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
              <Select value={selectedAssessment} onValueChange={(v) => setSelectedAssessment(v as any)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="opener">Opener</SelectItem>
                  <SelectItem value="mid_term">Mid Term</SelectItem>
                  <SelectItem value="end_term">End Term</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pos</TableHead>
                      <TableHead>Learner</TableHead>
                      <TableHead>Adm</TableHead>
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

          <Card className="h-fit sticky top-4">
            <CardHeader>
              <CardTitle className="text-base">SMS Format</CardTitle>
              <CardDescription>Choose how parents receive results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <RadioGroup value={smsMode} onValueChange={(v) => setSmsMode(v as SmsMode)} className="space-y-2">
                <label className="flex items-start gap-2 border rounded-md p-2 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="detailed" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Detailed</div>
                    <div className="text-xs text-muted-foreground">Full subject scores. May span multiple SMS.</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 border rounded-md p-2 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="hybrid" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Summary + Link <Badge variant="secondary" className="ml-1">Recommended</Badge></div>
                    <div className="text-xs text-muted-foreground">Avg, grade, points + secure portal link.</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 border rounded-md p-2 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="short_link" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Link only <LinkIcon className="h-3 w-3 inline" /></div>
                    <div className="text-xs text-muted-foreground">Cheapest. Single SMS, link expires in 30 days.</div>
                  </div>
                </label>
              </RadioGroup>

              <div>
                <Label className="text-xs">Preview</Label>
                <div className="bg-muted/50 rounded-md p-3 text-xs whitespace-pre-wrap mt-1 max-h-48 overflow-y-auto">
                  {previewMsg || <span className="text-muted-foreground">Select grade & stream</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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

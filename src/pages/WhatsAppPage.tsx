import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Copy, Send, MessageCircle, BadgeCheck, Loader2, AlertTriangle, BarChart3, Clock, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { extractVariableKeys, previewTemplate, statusColor, normalizeKePhone, type WhatsAppTemplate, type TemplateCategory } from '@/lib/whatsapp-templates';
import { LiveComposerTab } from '@/components/whatsapp/LiveComposerTab';

export default function WhatsAppPage() {
  const { schoolId } = useAuth();
  const { data: school } = useQuery({
    queryKey: ['wa-school-name', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId!).maybeSingle();
      return data;
    },
  });
  const schoolName = school?.school_name ?? 'Our School';

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-green-500/10 p-3">
            <MessageCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">WhatsApp Communication</h1>
            <p className="text-sm text-muted-foreground">Live composer, templates, automation and delivery analytics.</p>
          </div>
        </div>

        <SandboxNotice />

        <Tabs defaultValue="composer" className="space-y-4">
          <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full md:w-auto">
            <TabsTrigger value="composer">Live Composer</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="send">Bulk Send</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="composer"><LiveComposerTab schoolId={schoolId} schoolName={schoolName} /></TabsContent>
          <TabsContent value="templates"><TemplatesTab schoolId={schoolId} /></TabsContent>
          <TabsContent value="send"><BulkSendTab schoolId={schoolId} /></TabsContent>
          <TabsContent value="analytics"><AnalyticsTab schoolId={schoolId} /></TabsContent>
          <TabsContent value="settings"><SettingsTab schoolId={schoolId} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function SandboxNotice() {
  return (
    <Alert className="border-amber-500/30 bg-amber-500/5">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle>Sandbox mode</AlertTitle>
      <AlertDescription className="text-xs">
        Africa's Talking sandbox does not deliver real WhatsApp messages. The system automatically falls back to SMS so parents still receive every alert. Upgrade to AT Premium with a registered WhatsApp Business number to enable native WhatsApp delivery.
      </AlertDescription>
    </Alert>
  );
}

/* ============================ TEMPLATES TAB ============================ */

function TemplatesTab({ schoolId }: { schoolId: string | null }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<WhatsAppTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['wa-templates', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('school_id', schoolId!)
        .order('is_system', { ascending: false })
        .order('name');
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Template deleted'); qc.invalidateQueries({ queryKey: ['wa-templates'] }); },
    onError: (e: any) => toast.error(e.message ?? 'Failed to delete'),
  });

  const dup = useMutation({
    mutationFn: async (t: WhatsAppTemplate) => {
      const { error } = await supabase.from('whatsapp_templates').insert({
        school_id: t.school_id,
        name: `${t.name} (copy)`,
        category: t.category,
        language: t.language,
        header_text: t.header_text,
        body_text: t.body_text,
        footer_text: t.footer_text,
        buttons: t.buttons,
        required_vars: t.required_vars,
        is_system: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Duplicated'); qc.invalidateQueries({ queryKey: ['wa-templates'] }); },
    onError: (e: any) => toast.error(e.message ?? 'Failed to duplicate'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Message Templates</h2>
          <p className="text-xs text-muted-foreground">{templates.length} template{templates.length === 1 ? '' : 's'}</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2"><Plus className="h-4 w-4" />New Template</Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <span className="truncate">{t.name}</span>
                      {t.is_system && <Badge variant="outline" className="text-[10px]">System</Badge>}
                    </CardTitle>
                    <CardDescription className="text-xs capitalize mt-1">{t.category} · {t.language}</CardDescription>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${statusColor(t.status)}`}>{t.status}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="bg-muted/50 rounded p-2 text-[11px] whitespace-pre-wrap font-mono max-h-32 overflow-auto">{t.body_text}</pre>
                <div className="flex flex-wrap gap-1">
                  {extractVariableKeys(t.body_text).map(v => (
                    <Badge key={v} variant="secondary" className="text-[10px] font-mono">{`{{${v}}}`}</Badge>
                  ))}
                </div>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => dup.mutate(t)}><Copy className="h-3.5 w-3.5" /></Button>
                  {!t.is_system && (
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete "${t.name}"?`)) del.mutate(t.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <TemplateEditor
          template={editing}
          schoolId={schoolId!}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['wa-templates'] }); setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function TemplateEditor({ template, schoolId, onClose, onSaved }: {
  template: WhatsAppTemplate | null; schoolId: string; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? '');
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? 'utility');
  const [language, setLanguage] = useState(template?.language ?? 'en');
  const [headerText, setHeaderText] = useState(template?.header_text ?? '');
  const [bodyText, setBodyText] = useState(template?.body_text ?? '');
  const [footerText, setFooterText] = useState(template?.footer_text ?? '');
  const [saving, setSaving] = useState(false);

  const vars = extractVariableKeys(bodyText);
  const required = vars.filter(v => v !== 'school_name');

  const sample = previewTemplate(bodyText, {
    school_name: 'Bright Future Academy',
    1: 'John Doe',
    2: 'Mary Doe',
    3: 'https://example.com/r/abc123',
  });

  const save = async () => {
    if (!name.trim() || !bodyText.trim()) { toast.error('Name and body are required'); return; }
    setSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        name: name.trim(),
        category,
        language: language.trim() || 'en',
        header_text: headerText.trim() || null,
        body_text: bodyText,
        footer_text: footerText.trim() || null,
        required_vars: required,
      };
      const res = template
        ? await supabase.from('whatsapp_templates').update(payload).eq('id', template.id)
        : await supabase.from('whatsapp_templates').insert(payload);
      if (res.error) throw res.error;
      toast.success(template ? 'Template updated' : 'Template created');
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'New Template'}</DialogTitle>
          <DialogDescription>Use {'{{1}}, {{2}}'}… for dynamic variables. {'{{school_name}}'} is auto-filled.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Exam Reminder" disabled={template?.is_system} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={v => setCategory(v as TemplateCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="authentication">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Language</Label>
              <Input value={language} onChange={e => setLanguage(e.target.value)} placeholder="en" />
            </div>
            <div>
              <Label>Header (optional)</Label>
              <Input value={headerText} onChange={e => setHeaderText(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Body *</Label>
            <Textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={8} className="font-mono text-xs" />
            <p className="text-[11px] text-muted-foreground mt-1">Variables detected: {vars.length ? vars.map(v => `{{${v}}}`).join(', ') : 'none'}</p>
          </div>
          <div>
            <Label>Footer (optional)</Label>
            <Input value={footerText} onChange={e => setFooterText(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Preview</Label>
            <pre className="bg-muted rounded p-3 text-xs whitespace-pre-wrap font-mono">{sample || '— empty —'}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {template ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ BULK SEND TAB ============================ */

function BulkSendTab({ schoolId }: { schoolId: string | null }) {
  const [templateId, setTemplateId] = useState<string>('');
  const [scope, setScope] = useState<'school' | 'grade' | 'stream' | 'class'>('school');
  const [grade, setGrade] = useState('');
  const [stream, setStream] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; queued: number; total: number } | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ['wa-templates-pick', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from('whatsapp_templates').select('id, name, category').eq('school_id', schoolId!).eq('status', 'approved').order('name');
      return data ?? [];
    },
  });

  const { data: grades = [] } = useQuery({
    queryKey: ['learner-grades', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from('learners').select('grade').eq('school_id', schoolId!).eq('is_active', true);
      return Array.from(new Set((data ?? []).map(d => d.grade))).sort();
    },
  });

  const send = async () => {
    if (!templateId) { toast.error('Pick a template'); return; }
    setSending(true);
    setProgress(null);
    try {
      let q = supabase.from('learners').select('id, full_name, parent_name, parent_phone, grade').eq('school_id', schoolId!).eq('is_active', true);
      if (scope === 'grade' || scope === 'class') q = q.eq('grade', grade);
      if (scope === 'stream' || scope === 'class') q = q.eq('stream', stream);
      const { data: learners, error } = await q;
      if (error) throw error;
      const recipients = (learners ?? [])
        .filter(l => l.parent_phone)
        .map(l => ({
          learner_id: l.id,
          recipient: l.parent_phone!,
          variables: { 1: l.parent_name ?? 'Parent', 2: l.full_name },
        }));
      if (!recipients.length) { toast.error('No learners with parent phone numbers'); return; }
      setProgress({ sent: 0, failed: 0, queued: 0, total: recipients.length });

      const { data, error: sendErr } = await supabase.functions.invoke('whatsapp-send', {
        body: { template_id: templateId, recipients, enqueue: recipients.length > 30 },
      });
      if (sendErr) throw sendErr;
      setProgress({ sent: data.sent ?? 0, failed: data.failed ?? 0, queued: data.queued ?? 0, total: recipients.length });
      toast.success(`Done: ${data.sent} sent · ${data.queued} queued · ${data.failed} failed`);
    } catch (e: any) {
      toast.error(e.message ?? 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bulk WhatsApp Send</CardTitle>
        <CardDescription>Targets are filtered by parent phone availability. Sends &gt; 30 are queued automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="Pick an approved template" /></SelectTrigger>
            <SelectContent>
              {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(v: any) => setScope(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="school">Whole school</SelectItem>
                <SelectItem value="grade">By grade</SelectItem>
                <SelectItem value="class">Grade + Stream</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(scope === 'grade' || scope === 'class') && (
            <div>
              <Label>Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue placeholder="Pick grade" /></SelectTrigger>
                <SelectContent>{grades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {scope === 'class' && (
            <div>
              <Label>Stream</Label>
              <Input value={stream} onChange={e => setStream(e.target.value)} placeholder="e.g. BLUE" />
            </div>
          )}
        </div>
        <Button onClick={send} disabled={sending || !templateId} className="bg-green-600 hover:bg-green-700 text-white gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </Button>
        {progress && (
          <div className="rounded-md border p-3 text-sm grid grid-cols-4 gap-2">
            <Stat label="Total" value={progress.total} />
            <Stat label="Sent" value={progress.sent} className="text-green-600" />
            <Stat label="Queued" value={progress.queued} className="text-amber-600" />
            <Stat label="Failed" value={progress.failed} className="text-destructive" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, className = '' }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${className}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

/* ============================ ANALYTICS TAB ============================ */

function AnalyticsTab({ schoolId }: { schoolId: string | null }) {
  const { data: stats } = useQuery({
    queryKey: ['wa-stats', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from('report_delivery_log').select('status, channel').eq('school_id', schoolId!);
      const rows = data ?? [];
      const sent = rows.filter(r => r.status === 'sent').length;
      const failed = rows.filter(r => r.status === 'failed').length;
      const wa = rows.filter(r => r.channel === 'whatsapp' && r.status === 'sent').length;
      const sms = rows.filter(r => r.channel === 'sms' && r.status === 'sent').length;
      return { total: rows.length, sent, failed, wa, sms };
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ['wa-recent', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from('report_delivery_log')
        .select('id, recipient, channel, status, error_message, created_at')
        .eq('school_id', schoolId!)
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={BarChart3} label="Total" value={stats?.total ?? 0} />
        <StatCard icon={BadgeCheck} label="Sent" value={stats?.sent ?? 0} accent="text-green-600" />
        <StatCard icon={AlertTriangle} label="Failed" value={stats?.failed ?? 0} accent="text-destructive" />
        <StatCard icon={MessageCircle} label="WhatsApp" value={stats?.wa ?? 0} accent="text-green-600" />
        <StatCard icon={MessageCircle} label="SMS fallback" value={stats?.sms ?? 0} accent="text-blue-600" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y text-sm">
            {recent.length === 0 && <div className="p-4 text-muted-foreground">No messages yet.</div>}
            {recent.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs truncate">{r.recipient}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">{r.channel}</Badge>
                  <Badge className={`text-[10px] uppercase ${r.status === 'sent' ? 'bg-green-600 hover:bg-green-700' : ''}`} variant={r.status === 'sent' ? 'default' : 'destructive'}>
                    {r.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = '' }: { icon: any; label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Icon className="h-3.5 w-3.5" />{label}</div>
        <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

/* ============================ SETTINGS TAB ============================ */

function SettingsTab({ schoolId }: { schoolId: string | null }) {
  const qc = useQueryClient();
  const [testPhone, setTestPhone] = useState('');
  const [testTemplateId, setTestTemplateId] = useState('');
  const [testing, setTesting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['wa-settings', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from('whatsapp_settings').select('*').eq('school_id', schoolId!).maybeSingle();
      return data;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['wa-templates-test', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from('whatsapp_templates').select('id, name').eq('school_id', schoolId!).eq('status', 'approved').order('name');
      return data ?? [];
    },
  });

  const update = async (patch: Record<string, any>) => {
    if (!settings?.id) {
      const { error } = await supabase.from('whatsapp_settings').insert({ school_id: schoolId!, ...patch });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('whatsapp_settings').update(patch).eq('id', settings.id);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ['wa-settings'] });
  };

  const sendTest = async () => {
    const phone = normalizeKePhone(testPhone);
    if (!phone) return toast.error('Enter a valid Kenyan phone (e.g. 0712345678)');
    if (!testTemplateId) return toast.error('Pick a template');
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          template_id: testTemplateId,
          recipients: [{ recipient: phone, variables: { 1: 'Test Parent', 2: 'Test Student', 3: 'https://example.com/test' } }],
        },
      });
      if (error) throw error;
      const r = data?.results?.[0];
      if (r?.status === 'sent') toast.success(`Test sent via ${r.channel}`);
      else toast.error(r?.error ?? 'Test failed');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setTesting(false);
    }
  };

  const runWorker = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-queue-worker', { body: {} });
      if (error) throw error;
      toast.success(`Processed ${data?.processed ?? 0}, materialized ${data?.scheduled_materialized ?? 0}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Worker failed');
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding & Automation</CardTitle>
          <CardDescription>School name is auto-injected into every message.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Enforce school branding"
            description="Auto-append school name footer if missing from message body."
            checked={settings?.enforce_school_branding ?? true}
            onCheckedChange={v => update({ enforce_school_branding: v })}
          />
          <ToggleRow
            label="Auto-send report cards"
            description="When enabled, generated report cards trigger WhatsApp delivery."
            checked={settings?.auto_send_report_cards ?? false}
            onCheckedChange={v => update({ auto_send_report_cards: v })}
          />
          <ToggleRow
            label="Auto-send fee reminders"
            description="Notify parents weekly when their child has a balance &gt; 0."
            checked={settings?.auto_send_fee_reminders ?? false}
            onCheckedChange={v => update({ auto_send_fee_reminders: v })}
          />
          <ToggleRow
            label="Auto-send attendance alerts"
            description="Notify parents when their child is marked absent."
            checked={settings?.auto_send_attendance ?? false}
            onCheckedChange={v => update({ auto_send_attendance: v })}
          />
          <div>
            <Label>Daily send limit</Label>
            <Input
              type="number"
              defaultValue={settings?.daily_send_limit ?? 1000}
              onBlur={e => update({ daily_send_limit: Number(e.target.value) || 1000 })}
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Send Test WhatsApp</CardTitle>
          <CardDescription>Sends a single message to validate setup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone number</Label>
              <Input placeholder="0712345678" value={testPhone} onChange={e => setTestPhone(e.target.value)} />
            </div>
            <div>
              <Label>Template</Label>
              <Select value={testTemplateId} onValueChange={setTestTemplateId}>
                <SelectTrigger><SelectValue placeholder="Pick a template" /></SelectTrigger>
                <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={sendTest} disabled={testing} className="bg-green-600 hover:bg-green-700 text-white gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Test
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Queue Worker</CardTitle>
          <CardDescription>The queue worker drains scheduled and bulk messages. It runs automatically every minute.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={runWorker} className="gap-2"><RefreshCcw className="h-4 w-4" />Run worker now</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({ label, description, checked, onCheckedChange }: {
  label: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageSquare } from 'lucide-react';

type TplKey = 'custom' | 'expiry' | 'announcement';

const PRESETS: Record<Exclude<TplKey, 'custom'>, { label: string; body: string }> = {
  expiry: {
    label: 'Subscription Expiry',
    body: 'Hello {admin}, your PerformTrack subscription for {school} ({plan}) expires on {expiry}. Kindly renew to avoid service interruption. - PerformTrack',
  },
  announcement: {
    label: 'Announcement',
    body: 'Hello {admin} ({school}), PerformTrack update: ',
  },
};

type School = {
  id: string;
  school_name: string;
  subscription_status?: string | null;
  subscription_plan?: string | null;
  plan_expires_at?: string | null;
};

function segmentsFor(msg: string): number {
  const len = (msg || '').length;
  if (len === 0) return 1;
  return len <= 160 ? 1 : Math.ceil(len / 153);
}

export default function SuperAdminSmsRemindersSection({ schools }: { schools: School[] }) {
  const { toast } = useToast();
  const [tpl, setTpl] = useState<TplKey>('custom');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const schoolIds = useMemo(() => schools.map(s => s.id), [schools]);

  const { data: admins = [] } = useQuery({
    queryKey: ['sms-school-admins', schoolIds.join(',')],
    queryFn: async () => {
      if (!schoolIds.length) return [];
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').eq('role', 'admin');
      const userIds = (roles || []).map(r => r.user_id);
      if (!userIds.length) return [];
      const { data: profs } = await supabase.from('profiles')
        .select('user_id, full_name, whatsapp_number, school_id')
        .in('user_id', userIds).in('school_id', schoolIds);
      return profs || [];
    },
    enabled: schoolIds.length > 0,
  });

  const adminBySchool = useMemo(() => {
    const map: Record<string, { name: string; phone: string }> = {};
    (admins as any[]).forEach(p => {
      if (!map[p.school_id] && p.whatsapp_number) {
        map[p.school_id] = { name: p.full_name || 'Admin', phone: p.whatsapp_number };
      }
    });
    return map;
  }, [admins]);

  const applyTpl = (k: TplKey) => {
    setTpl(k);
    if (k !== 'custom') setMessage(PRESETS[k].body);
  };

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const selectAll = () => {
    const eligible = schools.filter(s => adminBySchool[s.id]?.phone).map(s => s.id);
    setSelected(new Set(eligible));
  };
  const clearAll = () => setSelected(new Set());

  const personalize = (body: string, s: School) => {
    const a = adminBySchool[s.id];
    return body
      .replace(/\{admin\}/g, a?.name || 'Administrator')
      .replace(/\{school\}/g, s.school_name)
      .replace(/\{plan\}/g, s.subscription_plan || 'your plan')
      .replace(/\{expiry\}/g, s.plan_expires_at ? new Date(s.plan_expires_at).toDateString() : 'soon')
      .replace(/\{status\}/g, s.subscription_status || '');
  };

  const targets = useMemo(
    () => schools.filter(s => selected.has(s.id) && adminBySchool[s.id]?.phone),
    [schools, selected, adminBySchool]
  );

  const send = async () => {
    if (!message.trim()) { toast({ title: 'Message required', variant: 'destructive' }); return; }
    if (targets.length === 0) { toast({ title: 'Select at least one school with admin phone', variant: 'destructive' }); return; }
    setSending(true);
    let sent = 0, failed = 0;
    try {
      for (const s of targets) {
        const a = adminBySchool[s.id];
        const body = personalize(message, s);
        const { data, error } = await supabase.functions.invoke('send-sms-v2', {
          body: {
            school_id: s.id, type: 'CUSTOM',
            messages: [{ phone: a.phone, message: body }],
          },
        });
        if (error) { failed++; continue; }
        sent += (data as any)?.sent ?? 0;
        failed += (data as any)?.failed ?? 0;
      }
      toast({ title: 'Reminders sent', description: `${sent} sent, ${failed} failed` });
      setMessage('');
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: 'Send failed', description: e?.message || String(e), variant: 'destructive' });
    } finally { setSending(false); }
  };

  const segs = segmentsFor(message);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-display font-semibold">
          <MessageSquare className="h-4 w-4 text-primary" /> SMS Reminders to School Admins
        </CardTitle>
        <CardDescription>
          Send custom SMS, subscription expiry alerts, or announcements to school administrators.
          Placeholders: <code className="text-[11px]">{`{admin} {school} {plan} {expiry} {status}`}</code>. Each school is billed from its own SMS credit balance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Template</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {(['custom','expiry','announcement'] as TplKey[]).map(k => (
              <Button key={k} size="sm" type="button"
                variant={tpl === k ? 'default' : 'outline'} onClick={() => applyTpl(k)}>
                {k === 'custom' ? 'Custom' : PRESETS[k].label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs">Message</Label>
          <Textarea value={message} onChange={e => setMessage(e.target.value)} className="min-h-[120px] text-sm" />
          <div className="text-[11px] text-muted-foreground mt-1">{message.length} chars · {segs} segment{segs === 1 ? '' : 's'} per recipient</div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAll}>Select all (with phone)</Button>
            <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
          </div>
          <Badge variant="outline">{targets.length} selected</Badge>
        </div>

        <div className="border rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>School</TableHead>
                <TableHead>Admin Phone</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map(s => {
                const a = adminBySchool[s.id];
                const has = !!a?.phone;
                return (
                  <TableRow key={s.id} className={!has ? 'opacity-50' : ''}>
                    <TableCell>
                      <Checkbox checked={selected.has(s.id)} disabled={!has} onCheckedChange={() => toggle(s.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{s.school_name}</TableCell>
                    <TableCell className="text-xs">{a?.phone || '—'}</TableCell>
                    <TableCell className="capitalize text-xs">{s.subscription_plan || '—'}</TableCell>
                    <TableCell className="text-xs">{s.plan_expires_at ? new Date(s.plan_expires_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        s.subscription_status === 'active' ? 'border-success/40 text-success' :
                        s.subscription_status === 'trial' ? 'border-warning/40 text-warning' :
                        'border-destructive/40 text-destructive'
                      }>
                        {s.subscription_status || 'unknown'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {schools.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No schools yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button onClick={send} disabled={sending || targets.length === 0 || !message.trim()}>
            <Send className="h-4 w-4 mr-2" /> {sending ? 'Sending…' : `Send to ${targets.length} school${targets.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

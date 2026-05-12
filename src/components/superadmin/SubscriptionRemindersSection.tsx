import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Send, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { buildWaMeLink, normalizeWhatsAppPhone } from '@/lib/wa-link';

type School = {
  id: string;
  school_name: string;
  subscription_status?: string | null;
  subscription_plan?: string | null;
  plan_expires_at?: string | null;
};

const STORAGE_MSG = 'subReminderMessages'; // { [schoolId]: string }
const STORAGE_DEFAULT = 'subReminderDefaultMessage';

const DEFAULT_TEMPLATE =
  `Hello {{admin_name}},\n\nThis is a friendly reminder from PerformTrack that {{school_name}}'s subscription ({{plan}}) ` +
  `is due/expiring on {{expiry}}.\n\nKindly renew to keep all premium features active. Reach out if you need any help.\n\n— PerformTrack Team`;

function readJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeJSON<T>(key: string, value: T) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export default function SubscriptionRemindersSection({ schools }: { schools: School[] }) {
  const [defaultTpl, setDefaultTpl] = useState<string>(() => localStorage.getItem(STORAGE_DEFAULT) || DEFAULT_TEMPLATE);
  const [perSchool, setPerSchool] = useState<Record<string, string>>(() => readJSON(STORAGE_MSG, {}));
  const [editOpen, setEditOpen] = useState(false);
  const [editSchool, setEditSchool] = useState<School | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => writeJSON(STORAGE_MSG, perSchool), [perSchool]);
  useEffect(() => { localStorage.setItem(STORAGE_DEFAULT, defaultTpl); }, [defaultTpl]);

  // Fetch admin contacts (profiles linked to admin role) per school
  const schoolIds = useMemo(() => schools.map(s => s.id), [schools]);
  const { data: admins = [] } = useQuery({
    queryKey: ['school-admin-contacts', schoolIds.join(',')],
    queryFn: async () => {
      if (!schoolIds.length) return [];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin');
      const userIds = (roles || []).map(r => r.user_id);
      if (!userIds.length) return [];
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, whatsapp_number, school_id')
        .in('user_id', userIds)
        .in('school_id', schoolIds);
      return profs || [];
    },
    enabled: schoolIds.length > 0,
  });

  const adminBySchool = useMemo(() => {
    const map: Record<string, { name: string; phone: string }> = {};
    (admins as any[]).forEach(p => {
      if (!map[p.school_id] && p.phone) {
        map[p.school_id] = { name: p.full_name || 'Admin', phone: p.phone };
      }
    });
    return map;
  }, [admins]);

  const buildMessage = (school: School) => {
    const tpl = perSchool[school.id] || defaultTpl;
    const admin = adminBySchool[school.id];
    return fillTemplate(tpl, {
      admin_name: admin?.name || 'Administrator',
      school_name: school.school_name,
      plan: school.subscription_plan || 'your plan',
      expiry: school.plan_expires_at ? new Date(school.plan_expires_at).toDateString() : 'soon',
      status: school.subscription_status || '',
    });
  };

  const sendOne = (school: School) => {
    const admin = adminBySchool[school.id];
    if (!admin?.phone) { toast.error(`${school.school_name}: no admin phone on file`); return; }
    const link = buildWaMeLink(admin.phone, buildMessage(school));
    if (!link) { toast.error(`${school.school_name}: invalid phone format`); return; }
    window.open(link, '_blank');
  };

  const sendBulk = () => {
    const targets = schools.filter(s => adminBySchool[s.id]?.phone);
    if (!targets.length) { toast.error('No schools with admin phone numbers'); return; }
    let count = 0;
    targets.forEach((s, i) => {
      const link = buildWaMeLink(adminBySchool[s.id]!.phone, buildMessage(s));
      if (!link) return;
      // Stagger to let browser open multiple tabs reliably
      setTimeout(() => window.open(link, '_blank'), i * 250);
      count++;
    });
    toast.success(`Opening WhatsApp for ${count} school${count === 1 ? '' : 's'}`);
  };

  const openEdit = (school: School) => {
    setEditSchool(school);
    setEditText(perSchool[school.id] || defaultTpl);
    setEditOpen(true);
  };
  const saveEdit = () => {
    if (!editSchool) return;
    setPerSchool(prev => ({ ...prev, [editSchool.id]: editText }));
    toast.success('Custom message saved');
    setEditOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-display font-semibold">
          <MessageCircle className="h-4 w-4 text-primary" /> Subscription Reminders (WhatsApp)
        </CardTitle>
        <CardDescription>
          Send customised renewal reminders to school admins via WhatsApp click-to-send links.
          Variables: <code className="text-[11px]">{`{{admin_name}} {{school_name}} {{plan}} {{expiry}} {{status}}`}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Default Message Template (used when a school has no custom message)</Label>
          <Textarea
            value={defaultTpl}
            onChange={e => setDefaultTpl(e.target.value)}
            className="min-h-[120px] text-sm font-mono"
          />
        </div>

        <div className="flex items-center justify-end">
          <Button onClick={sendBulk} size="sm">
            <Send className="h-4 w-4 mr-2" /> Send to All
          </Button>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Admin Phone</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Custom Msg</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map(s => {
                const admin = adminBySchool[s.id];
                const phoneOk = admin && normalizeWhatsAppPhone(admin.phone);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.school_name}</TableCell>
                    <TableCell className="text-xs">{admin?.phone || '—'}</TableCell>
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
                    <TableCell>
                      {perSchool[s.id]
                        ? <Badge variant="secondary" className="text-[10px]">Custom</Badge>
                        : <span className="text-xs text-muted-foreground">Default</span>}
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button size="sm" disabled={!phoneOk} onClick={() => sendOne(s)}>
                        <Send className="h-3 w-3 mr-1" /> Send
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {schools.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No schools yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customise Reminder</DialogTitle>
            <DialogDescription>{editSchool?.school_name}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            className="min-h-[180px] text-sm font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {`{{admin_name}} {{school_name}} {{plan}} {{expiry}} {{status}}`}
          </p>
          <DialogFooter className="gap-2">
            {editSchool && perSchool[editSchool.id] && (
              <Button variant="ghost" onClick={() => {
                setPerSchool(prev => { const n = { ...prev }; delete n[editSchool.id]; return n; });
                toast.success('Reverted to default');
                setEditOpen(false);
              }}>Use Default</Button>
            )}
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

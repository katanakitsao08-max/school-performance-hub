import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, ShieldCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const ACTIONS = ['all','delete','edit','restore','archive','bulk_upload','replace','disable','login','create'];
const MODULES = ['all','assessment','fees','users','settings','school','sms','attendance'];

export default function AuditLogsPage() {
  const { role, schoolId } = useAuth();
  const isSuper = role === 'super_admin';

  const [action, setAction] = useState('all');
  const [module, setModule] = useState('all');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', action, module, q, from, to, schoolId, isSuper],
    queryFn: async () => {
      let qb = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
      if (!isSuper && schoolId) qb = qb.eq('school_id', schoolId);
      if (action !== 'all') qb = qb.eq('action', action);
      if (module !== 'all') qb = qb.eq('module', module);
      if (from) qb = qb.gte('created_at', from);
      if (to) qb = qb.lte('created_at', `${to}T23:59:59`);
      const { data, error } = await qb;
      if (error) throw error;
      const rows = data || [];
      if (!q.trim()) return rows;
      const needle = q.toLowerCase();
      return rows.filter(r =>
        (r.user_name || '').toLowerCase().includes(needle)
        || (r.record_type || '').toLowerCase().includes(needle)
        || (r.reason || '').toLowerCase().includes(needle)
      );
    },
  });

  const stats = useMemo(() => {
    const m: Record<string, number> = {};
    logs.forEach(l => { m[l.action] = (m[l.action] || 0) + 1; });
    return m;
  }, [logs]);

  const exportCsv = () => {
    const headers = ['When','User','Role','Action','Module','Record Type','Affected','Reason','IP'];
    const rows = logs.map(l => [
      new Date(l.created_at).toISOString(),
      l.user_name || '', l.role || '', l.action, l.module,
      l.record_type || '', l.affected_count, (l.reason || '').replace(/"/g,"'"), l.ip_address || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-logs-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-3 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl md:text-2xl font-display font-bold">Audit Trail</h1>
              <p className="text-xs text-muted-foreground">Immutable record of every sensitive action</p>
            </div>
          </div>
          <Button onClick={exportCsv} variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        <Card>
          <CardContent className="p-3 md:p-4 grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="relative col-span-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search user, record, reason" className="pl-8 h-9" />
            </div>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIONS.map(a => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-1">
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9" />
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(stats).slice(0, 5).map(([k, v]) => (
            <Card key={k}>
              <CardContent className="p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
                <div className="text-2xl font-bold">{v}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">{isLoading ? 'Loading…' : `${logs.length} events`}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {logs.map((l) => (
                <div key={l.id} className="p-3 hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {(l.user_name || 'A').split(' ').map((s: string) => s[0]).slice(0, 2).join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          👤 {l.user_name || 'Unknown'}
                          <Badge variant="outline" className="ml-1 capitalize">{l.role}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          <span className="capitalize font-medium text-foreground">{l.action}</span>
                          {' · '}{l.module}{l.record_type ? ` · ${l.record_type}` : ''}
                          {l.affected_count > 1 && <> · <strong>{l.affected_count}</strong> records</>}
                        </div>
                        {l.reason && <div className="mt-0.5 text-xs italic text-muted-foreground">"{l.reason}"</div>}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      {format(new Date(l.created_at), 'd MMM yyyy · HH:mm')}
                    </div>
                  </div>
                </div>
              ))}
              {!isLoading && logs.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No audit events match these filters.</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

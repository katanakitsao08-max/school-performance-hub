import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, CalendarClock, Activity, MessageSquare, AlertCircle, ChevronRight } from 'lucide-react';

const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;

export default function PlatformMonitoringSection() {
  const start = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString(); }, []);
  const dau = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }, []);
  const in30 = useMemo(() => new Date(Date.now() + 30 * 86400000).toISOString(), []);

  const { data: revenue = 0 } = useQuery({
    queryKey: ['platform-monthly-revenue', start],
    queryFn: async () => {
      const { data } = await supabase.from('billing_payments').select('amount').eq('status', 'approved').gte('created_at', start);
      return (data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    },
  });
  const { data: dauCount = 0 } = useQuery({
    queryKey: ['platform-dau', dau],
    queryFn: async () => {
      const { count } = await supabase.from('user_activity_log').select('user_id', { count: 'exact', head: true }).gte('created_at', dau);
      return count || 0;
    },
  });
  const { data: smsUsed = 0 } = useQuery({
    queryKey: ['platform-sms-used', start],
    queryFn: async () => {
      const { count } = await supabase.from('sms_logs').select('id', { count: 'exact', head: true }).gte('created_at', start);
      return count || 0;
    },
  });
  const { data: renewals = [] } = useQuery({
    queryKey: ['platform-upcoming-renewals'],
    queryFn: async () => {
      const { data } = await supabase.from('schools')
        .select('id, school_name, plan_expires_at, subscription_status')
        .not('plan_expires_at', 'is', null)
        .lte('plan_expires_at', in30)
        .order('plan_expires_at')
        .limit(20);
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Wallet className="h-4 w-4"/>Revenue (Month)</div>
          <div className="text-xl font-bold">{fmt(revenue)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><CalendarClock className="h-4 w-4"/>Upcoming Renewals (30d)</div>
          <div className="text-xl font-bold">{renewals.length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><MessageSquare className="h-4 w-4"/>SMS Sent (Month)</div>
          <div className="text-xl font-bold">{smsUsed.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Activity className="h-4 w-4"/>Daily Active Users</div>
          <div className="text-xl font-bold">{dauCount.toLocaleString()}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2"><AlertCircle className="h-4 w-4 text-warning"/>Upcoming Renewals</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/manage-schools">All schools <ChevronRight className="h-4 w-4"/></Link></Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>School</TableHead><TableHead>Status</TableHead><TableHead>Expires</TableHead><TableHead>Days Left</TableHead></TableRow></TableHeader>
            <TableBody>
              {renewals.map((r: any) => {
                const days = Math.round((new Date(r.plan_expires_at).getTime() - Date.now()) / 86400000);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.school_name}</TableCell>
                    <TableCell><Badge variant={r.subscription_status === 'active' ? 'default' : 'secondary'}>{r.subscription_status}</Badge></TableCell>
                    <TableCell>{new Date(r.plan_expires_at).toLocaleDateString()}</TableCell>
                    <TableCell className={days < 7 ? 'text-destructive font-semibold' : ''}>{days}d</TableCell>
                  </TableRow>
                );
              })}
              {!renewals.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No upcoming renewals in 30 days</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

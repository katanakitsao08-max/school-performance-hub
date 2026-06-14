import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, TrendingUp, AlertTriangle, Building2, Crown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { fetchAllPaged } from '@/lib/fetch-all';
import { isCharge } from '@/lib/fee-row-utils';

const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;

export default function PriceBoardPage() {
  const [search, setSearch] = useState('');

  const { data: schools = [] } = useQuery({
    queryKey: ['priceboard-schools'],
    queryFn: async () => {
      const { data } = await supabase
        .from('schools')
        .select('id, school_name, school_code, county, subscription_status, plan_id, plan_expires_at')
        .order('school_name');
      return data || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['priceboard-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('subscription_plans').select('id, name, price_monthly');
      return data || [];
    },
  });

  const { data: feeRows = [] } = useQuery({
    queryKey: ['priceboard-fees'],
    queryFn: async () => {
      const rows = await fetchAllPaged<any>(() =>
        supabase.from('fee_records').select('school_id, amount_charged, amount_paid, transaction_type, voided_at')
      );
      return rows.filter(r => !r.voided_at && isCharge(r));
    },
  });

  const planMap = useMemo(() => {
    const m: Record<string, { name: string; price: number }> = {};
    plans.forEach((p: any) => { m[p.id] = { name: p.name, price: Number(p.price_monthly) || 0 }; });
    return m;
  }, [plans]);

  const board = useMemo(() => {
    const grouped: Record<string, { charged: number; paid: number }> = {};
    feeRows.forEach((r: any) => {
      const k = r.school_id;
      if (!k) return;
      const cur = grouped[k] || { charged: 0, paid: 0 };
      cur.charged += Number(r.amount_charged);
      cur.paid += Number(r.amount_paid);
      grouped[k] = cur;
    });
    return schools.map((s: any) => {
      const t = grouped[s.id] || { charged: 0, paid: 0 };
      const balance = t.charged - t.paid;
      const collectionRate = t.charged > 0 ? Math.round((t.paid / t.charged) * 100) : 0;
      const plan = s.plan_id ? planMap[s.plan_id] : null;
      const expired = s.plan_expires_at ? new Date(s.plan_expires_at) < new Date() : false;
      return {
        ...s,
        charged: t.charged,
        paid: t.paid,
        balance,
        collectionRate,
        planName: plan?.name || 'Free',
        planPrice: plan?.price || 0,
        planExpired: expired,
      };
    }).sort((a, b) => b.paid - a.paid);
  }, [schools, feeRows, planMap]);

  const filtered = useMemo(() => {
    if (!search) return board;
    const s = search.toLowerCase();
    return board.filter(r => r.school_name.toLowerCase().includes(s) || (r.school_code || '').toLowerCase().includes(s));
  }, [board, search]);

  const totals = useMemo(() => ({
    charged: board.reduce((s, r) => s + r.charged, 0),
    paid: board.reduce((s, r) => s + r.paid, 0),
    balance: board.reduce((s, r) => s + r.balance, 0),
    revenue: board.reduce((s, r) => s + (r.planExpired ? 0 : r.planPrice), 0),
  }), [board]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Price Board</h1>
          <p className="text-muted-foreground text-sm mt-1">Per-school fees activity and platform revenue snapshot</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Billed', value: fmt(totals.charged), icon: Wallet, color: 'text-foreground' },
            { label: 'Total Collected', value: fmt(totals.paid), icon: TrendingUp, color: 'text-success' },
            { label: 'Outstanding', value: fmt(totals.balance), icon: AlertTriangle, color: 'text-destructive' },
            { label: 'Plan Revenue (mo.)', value: fmt(totals.revenue), icon: Crown, color: 'text-primary' },
          ].map(c => (
            <Card key={c.label}>
              <CardContent className="p-4 text-center">
                <c.icon className={`h-5 w-5 mx-auto mb-2 ${c.color}`} />
                <p className={`text-lg md:text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-[11px] text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Schools — Payment Activity</span>
              <Input placeholder="Search school..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs max-w-xs" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">School</TableHead>
                  <TableHead className="text-xs">Plan</TableHead>
                  <TableHead className="text-xs text-right">Billed</TableHead>
                  <TableHead className="text-xs text-right">Collected</TableHead>
                  <TableHead className="text-xs text-right">Balance</TableHead>
                  <TableHead className="text-xs text-right">Rate</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">No schools</TableCell></TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium">
                      {r.school_name}
                      <br /><span className="text-muted-foreground text-[10px]">{r.school_code} · {r.county}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className={r.planExpired ? 'border-destructive/40 text-destructive' : 'border-primary/40 text-primary'}>
                        {r.planName}{r.planExpired ? ' (expired)' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right">{r.charged.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right text-success">{r.paid.toLocaleString()}</TableCell>
                    <TableCell className={`text-xs text-right font-bold ${r.balance > 0 ? 'text-destructive' : 'text-success'}`}>{r.balance.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right">
                      <span className={r.collectionRate >= 70 ? 'text-success' : r.collectionRate >= 40 ? 'text-warning' : 'text-destructive'}>
                        {r.collectionRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className={
                        r.subscription_status === 'active' ? 'border-success/40 text-success' :
                        r.subscription_status === 'trial' ? 'border-warning/40 text-warning' :
                        'border-destructive/40 text-destructive'
                      }>
                        {r.subscription_status}
                      </Badge>
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
